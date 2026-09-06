const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadUnitResourceActions() {
  return loadTsModule('app/classes/unit/UnitResourceActions.ts', {
    mocks: {
      '../../constants': {
        LOADING_TYPES: {
          berry: 'berry',
          fiber: 'fiber',
          herb: 'herb',
          toxicHerb: 'toxicHerb',
          wheat: 'wheat',
          wood: 'wood',
        },
        MENU_INFO_IDS: {},
        MINING_RESOURCE_CONFIG: {},
        RESOURCE_GATHER_SWINGS: {},
        RESOURCE_TYPES: {
          berrybush: 'Berrybush',
          fiberPlant: 'FiberPlant',
          medicinalHerb: 'MedicinalHerb',
          toxicHerb: 'ToxicHerb',
          wheat: 'Wheat',
        },
        RESOURCE_STOCKPILE_TYPES: {
          Berrybush: 'berry',
          FiberPlant: 'fiber',
          MedicinalHerb: 'herb',
          ToxicHerb: 'toxicHerb',
        },
        WILDGRASS_RESOURCE_TYPES: new Set(['MedicinalHerb', 'ToxicHerb', 'FiberPlant']),
        SHEET_TYPES: { action: 'actionSheet' },
        SOUND_CUES: {
          villager: {
            forageBerry: 'berry-gathering',
            gatherFood: 'farming-3',
          },
        },
      },
      '../../lib': {
        SLASH_IMPACT_FRAME: 4,
        onSpriteLoopAtFrame: () => {},
        playAudibleSoundCue: () => {},
        showDamageFeedback: () => {},
        showHitPointGainFeedback: () => {},
        showResourceGainFeedback: () => {},
      },
      '../../lib/animations/actionFrameSequences': {
        getActionAnimationReleaseFrame: (_unit, _action, impactFrame) => impactFrame,
      },
      '../../lib/entities/entityHealthDisplay': { syncEntityHealthDisplay: () => {} },
      '../../lib/entities/workImpactFragments': { spawnWorkImpactFragments: () => {} },
      '../../lib/resources/resourceDelivery': {
        getResourceKeyForLoadingType: loadingType => loadingType,
        getUnitResourceCapacityRemaining: () => 10,
        unitShouldDeliverResource: () => false,
      },
      '../../lib/units/unitControl': { isHeroControlled: () => false },
      '../../lib/units/unitEnergy': { spendOrWaitForEnergy: () => true },
      '../../lib/units/unitExperience': {
        LOADING_XP_CATEGORY: {},
        XP_BUILD_TICK: 1,
        XP_CATEGORIES: {},
        XP_FELL_TREE_TICK: 1,
        getBuildRateXpMultiplier: () => 1,
        getGatherXpBonus: () => 0,
        grantUnitXp: () => {},
      },
      '../../lib/lang': { t: key => key },
      './UnitBuildVisuals': { shouldSyncBuildHealthDisplay: () => false },
      './UnitGatherVisualDebug': { logGatherVisualState: () => {} },
      './UnitManualHeroWork': {
        finishManualHeroWorkSwing: () => {},
        lockManualHeroAction: () => {},
        restartManualHeroActionAnimation: () => {},
        stopManualHeroAction: () => {},
      },
    },
  }).UnitResourceActions
}

function captureForageSound(targetType) {
  const UnitResourceActions = loadUnitResourceActions()
  const action = new UnitResourceActions({
    dest: { family: 'resource', quantity: 2, type: targetType },
    sounds: { work: {} },
  })
  let captured
  action.startGathering = (_loadingType, soundId) => {
    captured = soundId
  }

  action.handleForageBerryAction()

  return captured
}

test('wildgrass forage uses the wheat contact sound', () => {
  assert.equal(captureForageSound('MedicinalHerb'), 'farming-3')
  assert.equal(captureForageSound('ToxicHerb'), 'farming-3')
  assert.equal(captureForageSound('FiberPlant'), 'farming-3')
})

test('berrybush forage keeps the berry gathering sound', () => {
  assert.equal(captureForageSound('Berrybush'), 'berry-gathering')
})
