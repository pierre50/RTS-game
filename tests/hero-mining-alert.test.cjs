const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function attemptMining({ type = 'Copper', age = 0, touching = false, quantity = 10 } = {}) {
  const messages = []
  const target = { type, family: 'resource', quantity }
  const hero = {
    type: 'Hero',
    controlMode: 'hero',
    owner: { age, isPlayed: true },
    context: { menu: { showMessage: (...args) => messages.push(args) } },
    getAction: action => {
      hero.startedAction = action
    },
  }
  const { getResourceActionConditions } = loadTsModule('app/lib/combat/resourceActionConditions.ts')
  const { performContextActionAt } = loadTsModule('app/lib/hero/heroContextActions.ts', {
    mocks: {
      'pixi.js': { Assets: { cache: { get: () => null } } },
      '../actions/contactActions': { canReachActionTarget: () => touching },
      '../contact/contactGeometry': { getContactAimDegree: () => 0 },
      '../units/actionVisualSheet': { getActionVisualSheetKey: () => 'action' },
      '../combat': {
        getActionCondition: (actor, resource, action) => getResourceActionConditions(actor, resource)[action]?.(),
      },
      '../grid/visibility': { findInstancesInSight: (_hero, predicate) => [target].filter(predicate) },
      '../units/unitEnergy': { hasEnergyForAction: () => true },
      '../../classes/unit/UnitResourceDeliveryCommands': { applyWorkForAction: () => {} },
      './heroTargeting': { CLICK_TARGET_SEARCH_RANGE: 15, getDirectionalTargets: (_hero, targets) => targets },
    },
  })
  return { result: performContextActionAt(hero), messages, hero }
}

test('copper and iron start a mining swing without an immediate warning', () => {
  for (const [type, age, action] of [
    ['Copper', 0, 'minecopper'],
    ['Iron', 0, 'mineiron'],
  ]) {
    const { result, messages, hero } = attemptMining({ type, age, touching: true })
    assert.equal(result, 'triggered')
    assert.equal(hero.startedAction, action)
    assert.deepEqual(messages, [])
  }
})

test('out-of-reach mines do not start a mining swing', () => {
  const { result, messages, hero } = attemptMining()
  assert.equal(result, 'miss')
  assert.equal(hero.startedAction, undefined)
  assert.deepEqual(messages, [])
})

test('copper can be mined at contact in the Bronze Age', () => {
  const { result, messages, hero } = attemptMining({ touching: true, age: 1 })
  assert.equal(result, 'triggered')
  assert.equal(hero.startedAction, 'minecopper')
  assert.deepEqual(messages, [])
})

test('holding interact repeats locked mining swings and releasing stops them', () => {
  let swings = 0
  let stops = 0
  const { finishManualHeroWorkSwing } = loadTsModule('app/classes/unit/UnitManualHeroWork.ts', {
    mocks: {
      '../../lib/graphics': { onSpriteLoopAtFrame: () => {} },
      '../../lib/entities/slashRecoveryAnimation': { logHeroSlashFrame: () => {} },
      '../../lib/animations/actionFrameSequences': { hasConfiguredActionFrameSequence: () => true },
    },
  })
  const unit = {
    type: 'Hero',
    controlMode: 'hero',
    owner: { age: 0 },
    action: 'mineiron',
    dest: { type: 'Iron', quantity: 10 },
    context: { controls: { heroActionHeld: true } },
    sprite: { currentFrame: 4 },
    getActionCondition: () => false,
    getAction: () => {
      swings++
    },
    stop: () => {
      stops++
    },
    affectNewDest: () => assert.fail('insufficient pickaxe should not interrupt held mining'),
  }
  finishManualHeroWorkSwing(unit, 4, 4)
  assert.equal(swings, 1)
  unit.context.controls.heroActionHeld = false
  finishManualHeroWorkSwing(unit, 4, 4)
  assert.equal(swings, 1)
  assert.equal(stops, 1)
})
