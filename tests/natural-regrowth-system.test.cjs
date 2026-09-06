const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadNaturalRegrowthSystem(calls) {
  return loadTsModule('app/services/NaturalRegrowthSystem.ts', {
    mocks: {
      '../constants': {
        RESOURCE_TYPES: {
          berrybush: 'Berrybush',
          copper: 'Copper',
          wheat: 'Wheat',
          gold: 'Gold',
          iron: 'Iron',
          stone: 'Stone',
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
        NATURAL_RESOURCE_REGROWTH_BY_TYPE: {
          Berrybush: { respawnDelayDays: 3, respawnQuantityRatio: 0.5 },
          Wheat: { respawnDelayDays: 2, respawnQuantityRatio: 0.5 },
          Stone: { respawnDelayDays: 7, respawnQuantityRatio: 0.2 },
          Gold: { respawnDelayDays: 14, respawnQuantityRatio: 0.15 },
          Copper: { respawnDelayDays: 10, respawnQuantityRatio: 0.15 },
          Iron: { respawnDelayDays: 14, respawnQuantityRatio: 0.15 },
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

test('daily natural regrowth waits for mineral respawn delays before resources return', () => {
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
      naturalResourceRespawnSlots: [{ depletedDay: 3, i: 2, j: 2, totalQuantity: 4, type: 'Gold' }],
      resources: new Set(),
      respawnNaturalResource: () => true,
    },
    menu: {
      isMiniMapActive: () => true,
      updateResourcesMiniMap: () => calls.push(['updateResourcesMiniMap']),
    },
    players: [{ units: [unit] }],
  }

  const system = new NaturalRegrowthSystem(context)

  system.applyDailyRegrowth({ day: 16, previousDay: 15 })

  assert.deepEqual(calls, [])
  assert.equal(context.map.naturalResourceRespawnSlots.length, 1)

  system.applyDailyRegrowth({ day: 17, previousDay: 16 })

  assert.deepEqual(calls, [
    ['updateResourcesMiniMap'],
    ['resumeAutonomy', 'gold-miner', 'gold', { exploreWhenNoTarget: false }],
  ])
  assert.deepEqual(context.map.naturalResourceRespawnSlots, [])
})

test('daily natural regrowth starts legacy mineral slots from the current day', () => {
  const calls = []
  const NaturalRegrowthSystem = loadNaturalRegrowthSystem(calls)
  const slot = { i: 2, j: 2, totalQuantity: 4, type: 'Gold' }
  const context = {
    dayNight: { state: { hour: 8 } },
    map: {
      gaia: { animals: [] },
      naturalResourceRespawnSlots: [slot],
      resources: new Set(),
      respawnNaturalResource: () => {
        calls.push(['respawn'])
        return true
      },
    },
    menu: {
      isMiniMapActive: () => true,
      updateResourcesMiniMap: () => calls.push(['updateResourcesMiniMap']),
    },
    players: [],
  }

  new NaturalRegrowthSystem(context).applyDailyRegrowth({ day: 4, previousDay: 3 })

  assert.deepEqual(calls, [])
  assert.equal(slot.depletedDay, 4)
  assert.deepEqual(context.map.naturalResourceRespawnSlots, [slot])
})
