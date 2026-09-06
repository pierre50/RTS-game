const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadUnitDirectedActions(overrides = {}) {
  const feedback = []
  return {
    feedback,
    ...loadTsModule('app/classes/unit/UnitDirectedActions.ts', {
      mocks: {
        '../../constants': {
          ACTION_TYPES: {},
          FAMILY_TYPES: { building: 'building' },
          LOADING_TYPES: { meat: 'meat' },
          SHEET_TYPES: {},
          SOUND_CUES: { villager: { takeMeat: 'take-meat' } },
        },
        '../../lib': {
          BOW_SHOOT_RELEASE_FRAME: 8,
          HUNTING_PROJECTILE: 'hunt-arrow',
          onSpriteLoopAtFrame: () => {},
          playerCanSeeInstance: () => true,
          showHealingFeedback: () => {},
          showResourceGainFeedback: (unit, amount, label) => feedback.push({ unit, amount, label }),
          syncMovedActionTarget: () => {},
        },
        '../../lib/entities/entityHealthDisplay': { syncEntityHealthDisplay: () => {} },
        '../../lib/lpc': { refreshBakedLpcUnitAssets: () => {} },
        '../../lib/projectiles': { attachProjectileToMapSpace: () => {} },
        '../../lib/units/unitExperience': {
          getHealingXpBonus: () => 0,
          grantUnitXp: () => {},
          XP_CATEGORIES: {},
        },
        '../../lib/units/unitControl': { isHeroControlled: () => false },
        '../../lib/units/unitEnergy': { spendOrWaitForEnergy: () => true },
        '../../lib/lang': { t: key => ({ feather: 'feather', leather: 'leather', sinew: 'sinew' })[key] ?? key },
        '../Projectile': { Projectile: function Projectile() {} },
        './UnitManualHeroWork': { stopManualHeroAction: () => {} },
        './UnitResourceGathering': {
          addGatheredResource: overrides.addGatheredResource ?? ((unit, resource, amount) => {
            unit.inventory = unit.inventory ?? {}
            unit.inventory.resources = unit.inventory.resources ?? {}
            unit.inventory.resources[resource] = (unit.inventory.resources[resource] ?? 0) + amount
            return amount
          }),
        },
      },
    }),
  }
}

test('black grouse meat gathering can drop a named feather resource', () => {
  const { UnitDirectedActions, feedback } = loadUnitDirectedActions()
  const unit = { context: { map: { random: () => 0.1 } }, sounds: { work: {} } }
  const directedActions = new UnitDirectedActions(unit, () => {})
  let gatherOptions

  directedActions.startTakeMeatGathering((_loadingType, _soundId, options) => {
    gatherOptions = options
  })
  gatherOptions.onGathered({ type: 'BlackGrouse' })

  assert.deepEqual(unit.inventory.resources, { feather: 1 })
  assert.deepEqual(feedback, [{ unit, amount: 1, label: 'feather' }])
})

test('black grouse feather drops stay rare and animal-specific', () => {
  const { UnitDirectedActions, feedback } = loadUnitDirectedActions()
  const unit = { context: { map: { random: () => 0.9 } }, sounds: { work: {} } }
  const directedActions = new UnitDirectedActions(unit, () => {})
  let gatherOptions

  directedActions.startTakeMeatGathering((_loadingType, _soundId, options) => {
    gatherOptions = options
  })
  gatherOptions.onGathered({ type: 'BlackGrouse' })
  gatherOptions.onGathered({ type: 'Deer' })

  assert.equal(unit.inventory, undefined)
  assert.deepEqual(feedback, [])
})

test('mammal meat gathering can drop named leather', () => {
  const { UnitDirectedActions, feedback } = loadUnitDirectedActions()
  const rolls = [0.01, 0.9]
  const unit = { context: { map: { random: () => rolls.shift() ?? 0.9 } }, sounds: { work: {} } }
  const directedActions = new UnitDirectedActions(unit, () => {})
  let gatherOptions

  directedActions.startTakeMeatGathering((_loadingType, _soundId, options) => {
    gatherOptions = options
  })
  gatherOptions.onGathered({ type: 'Deer' })

  assert.deepEqual(unit.inventory.resources, { leather: 1 })
  assert.deepEqual(feedback, [{ unit, amount: 1, label: 'leather' }])
})

test('strong mammal meat gathering can drop named sinew', () => {
  const { UnitDirectedActions, feedback } = loadUnitDirectedActions()
  const rolls = [0.9, 0.01]
  const unit = { context: { map: { random: () => rolls.shift() ?? 0.9 } }, sounds: { work: {} } }
  const directedActions = new UnitDirectedActions(unit, () => {})
  let gatherOptions

  directedActions.startTakeMeatGathering((_loadingType, _soundId, options) => {
    gatherOptions = options
  })
  gatherOptions.onGathered({ type: 'Wolf' })

  assert.deepEqual(unit.inventory.resources, { sinew: 1 })
  assert.deepEqual(feedback, [{ unit, amount: 1, label: 'sinew' }])
})
