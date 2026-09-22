const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function harness() {
  let impact
  const calls = []
  const target = { type: 'Deer', family: 'animal', isDead: true }
  const unit = {
    dest: target,
    action: 'takemeat',
    sprite: {},
    touching: true,
    getActionCondition: () => true,
    isUnitAtDest: () => true,
    setTextures: () => {},
    sendToDelivery: () => {
      calls.push('deliver')
      return true
    },
    sendToEvt: () => calls.push('approach'),
    stop: () => calls.push('stop'),
  }
  const { UnitDirectedActions } = loadTsModule('app/classes/unit/UnitDirectedActions.ts', {
    mocks: {
      '../Projectile': { Projectile: class {} },
      '../../lib': {
        onSpriteLoopAtFrame: (_sprite, _frame, callback) => {
          impact = callback
        },
        showResourceGainFeedback() {},
      },
      '../../lib/actions/contactActions': { isActionTouchingTarget: unit => unit.touching },
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
  return { unit, calls, impact: () => impact() }
}

test('hunter picks up one load at contact then starts delivery', () => {
  const h = harness()
  assert.deepEqual(h.calls, [])
  h.impact()
  assert.deepEqual(h.calls, ['loot', 'deliver'])
})

test('interrupted hunting animation cannot loot and lost contact triggers a new approach', () => {
  const h = harness()
  h.unit.action = 'delivery'
  h.impact()
  assert.deepEqual(h.calls, [])
  h.unit.action = 'takemeat'
  h.unit.touching = false
  h.impact()
  assert.deepEqual(h.calls, ['approach'])
})
