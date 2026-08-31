const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadNaturalRegrowthSystem(calls) {
  return loadTsModule('app/services/NaturalRegrowthSystem.ts', {
    mocks: {
      '../constants': {
        RESOURCE_TYPES: {
          berrybush: 'Berrybush',
          wheat: 'Wheat',
        },
        SHEET_TYPES: { standing: 'standingSheet' },
        UNIT_TYPES: { villager: 'Villager' },
      },
      '../config/gameplay': {
        NATURAL_REGROWTH_CONFIG: {
          berryRegrowRatioPerDay: 0.2,
          wheatGrowthFramesPerDay: 1,
          wheatRegrowRatioPerDay: 0.2,
        },
      },
      '../lib': {
        getGaiaAnimals: gaia => gaia?.animals ?? [],
        getInstanceZIndex: () => 0,
        isWheatMature: () => false,
        updateInstanceVisibility: () => null,
      },
      '../lib/units/villagerSchedule': {
        isVillagerSleepTime: context => {
          const hour = context?.dayNight?.state?.hour ?? 12
          return hour >= 18 || hour < 8
        },
      },
      '../lib/units/villagerTaskRecovery': {
        resumeStrictVillagerAutonomy: (unit, job, options) => {
          calls.push(['resumeAutonomy', unit.label, job, options])
          return true
        },
      },
    },
  }).NaturalRegrowthSystem
}

test('daily natural regrowth resumes idle strict autonomous villagers after resources return', () => {
  const calls = []
  const NaturalRegrowthSystem = loadNaturalRegrowthSystem(calls)
  const unit = {
    action: null,
    autonomousJob: 'gold',
    dest: null,
    isDead: false,
    isDestroyed: false,
    label: 'gold-miner',
    path: [],
    type: 'Villager',
  }
  const context = {
    dayNight: { state: { hour: 8 } },
    map: {
      gaia: { animals: [] },
      naturalResourceRespawnSlots: [{ i: 2, j: 2, type: 'Gold' }],
      resources: new Set(),
      respawnNaturalResource: () => true,
    },
    menu: {
      isMiniMapActive: () => true,
      updateResourcesMiniMap: () => calls.push(['updateResourcesMiniMap']),
    },
    players: [{ units: [unit] }],
  }

  new NaturalRegrowthSystem(context).applyDailyRegrowth()

  assert.deepEqual(calls, [
    ['updateResourcesMiniMap'],
    ['resumeAutonomy', 'gold-miner', 'gold', { exploreWhenNoTarget: false }],
  ])
  assert.deepEqual(context.map.naturalResourceRespawnSlots, [])
})
