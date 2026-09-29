const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function harness(overrides = {}) {
  const calls = []
  const target = { type: 'Deer', family: 'animal', isDead: true }
  const unit = {
    dest: target,
    action: 'takemeat',
    sprite: {},
    touching: true,
    getActionCondition: () => true,
    isUnitAtDest: () => true,
    setTextures: sheet => calls.push(sheet),
    sendToDelivery: () => {
      calls.push('deliver')
      return true
    },
    sendToEvt: () => calls.push('approach'),
    stop: () => calls.push('stop'),
    ...overrides,
  }
  const { UnitDirectedActions } = loadTsModule('app/classes/unit/UnitDirectedActions.ts', {
    mocks: {
      '../Projectile': { Projectile: class {} },
      '../../lib': {
        SLASH_IMPACT_FRAME: 5,
        onSpriteLoopAtFrame: (sprite, frame, callback) => {
          sprite.onFrameChange = current => {
            if (current >= frame) callback()
          }
        },
        showResourceGainFeedback: (_unit, amount) => calls.push(['feedback', amount]),
      },
      '../../lib/actions/contactActions': { isActionTouchingTarget: unit => unit.touching },
      '../../lib/contact/contactGeometry': { getContactAimDegree: () => 90 },
      '../../lib/equipment/animalCorpseLoot': {
        takeAnimalLootForDelivery: () => {
          calls.push('loot')
          return 10
        },
      },
      '../../lib/units/unitControl': { isHeroControlled: () => false },
    },
  })
  new UnitDirectedActions(unit, () => {}).takeAnimalLoot()
  return { unit, calls }
}

test('hunter plays one slash, picks up on impact, then finishes before delivery', () => {
  const h = harness()
  assert.deepEqual(h.calls, ['harvestSheet'])
  assert.equal(h.unit.sprite.loop, false)
  assert.equal(h.unit.degree, 90)
  h.unit.sprite.onFrameChange(4)
  assert.deepEqual(h.calls, ['harvestSheet'])
  h.unit.sprite.onFrameChange(5)
  h.unit.sprite.onFrameChange(6)
  assert.deepEqual(h.calls, ['harvestSheet', 'loot', ['feedback', 10]])
  const complete = h.unit.sprite.onComplete
  complete()
  complete()
  assert.deepEqual(h.calls, ['harvestSheet', 'loot', ['feedback', 10], 'standingSheet', 'deliver'])
})

test('hunter returns to idle after the slash when there is no delivery', () => {
  const h = harness({ sendToDelivery: () => false })
  h.unit.sprite.onFrameChange(5)
  h.unit.sprite.onComplete()
  assert.deepEqual(h.calls, ['harvestSheet', 'loot', ['feedback', 10], 'standingSheet', 'stop'])
  assert.equal(h.unit.sprite.onFrameChange, undefined)
  assert.equal(h.unit.sprite.onComplete, undefined)
})

test('interrupted slash cannot collect food or override a new order', () => {
  for (const change of [
    unit => {
      unit.action = 'attack'
    },
    unit => {
      unit.isDead = true
    },
    unit => {
      unit.dest = {}
    },
  ]) {
    const h = harness()
    change(h.unit)
    h.unit.sprite.onFrameChange(5)
    h.unit.sprite.onComplete()
    assert.deepEqual(h.calls, ['harvestSheet'])
  }
})

test('contact lost during the slash does not collect food', () => {
  const h = harness({ sendToDelivery: () => false })
  h.unit.touching = false
  h.unit.sprite.onFrameChange(5)
  h.unit.sprite.onComplete()
  assert.deepEqual(h.calls, ['harvestSheet', 'standingSheet', 'stop'])
})

test('inactive or dead hunters cannot loot', () => {
  for (const overrides of [{ action: 'delivery' }, { isDead: true }, { isDestroyed: true }]) {
    assert.deepEqual(harness(overrides).calls, [])
  }
})

test('lost contact triggers a new approach without taking loot', () => {
  const h = harness({ touching: false })
  assert.deepEqual(h.calls, ['approach'])
})

test('a valid carcass outside precise reach is approached instead of reselected recursively', () => {
  const h = harness({
    isUnitAtDest: () => false,
    affectNewDest: () => assert.fail('must approach the current carcass'),
  })
  assert.deepEqual(h.calls, ['approach'])
})

test('hunter retargeting routes a nearby carcass through the precise work approach', () => {
  const carcass = { type: 'Deer', family: 'animal', isDead: true }
  const calls = []
  const { UnitCombat } = loadTsModule('app/classes/unit/UnitCombat.ts', {
    mocks: {
      '../Projectile': { Projectile: class {} },
      '../../lib': {
        findInstancesInSight: () => [carcass],
        getClosestInstanceWithPath: () => ({ instance: carcass, path: [] }),
        instanceContactInstance: () => true,
      },
      '../../lib/units/villagerAutonomyTargeting': { isVillagerWorkTargetRejected: () => false },
      '../../services/BuildingInteriorSpaceSystem': {},
    },
  })
  const unit = {
    action: 'hunt',
    getActionCondition: () => true,
    getAction: () => assert.fail('grid proximity must not start loot directly'),
    setPath: () => assert.fail('an empty grid path must not leave a walking unit'),
    sendToEvt: (...args) => calls.push(args),
  }
  assert.equal(new UnitCombat(unit).tryHunterTarget('takemeat'), true)
  assert.deepEqual(calls, [[carcass, 'takemeat', { forceRepath: true, preserveAutonomy: true }]])
})
