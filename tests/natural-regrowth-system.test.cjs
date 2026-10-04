const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadNaturalRegrowthSystem(calls, moduleCache = new Map()) {
  return loadTsModule('app/services/NaturalRegrowthSystem.ts', {
    moduleCache,
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
      '../lib/units/village/villagerSchedule': {
        shouldVillagerWork: () => true,
        isVillagerSleepTime: context => {
          const hour = context?.dayNight?.state?.hour ?? 12
          return hour >= 18 || hour < 8
        },
      },
      '../lib/units/autonomy/villagerTaskRecovery': {
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

  assert.deepEqual(calls, [['updateResourcesMiniMap']])
  assert.deepEqual(context.map.naturalResourceRespawnSlots, [])
})

test('regrowth never steals training, energy recovery or player-controlled villagers', () => {
  const calls = []
  const NaturalRegrowthSystem = loadNaturalRegrowthSystem(calls)
  const units = [
    { trainingTargetType: 'Archer' },
    { waitingForEnergyAction: 'farm' },
    { controlMode: 'hero' },
    { actionLocked: true },
    { pendingOrder: {} },
  ].map((extra, index) => ({ type: 'Villager', label: `unit-${index}`, autonomousJob: 'food', ...extra }))
  const context = {
    map: {
      gaia: { animals: [] },
      resources: new Set(),
      naturalResourceRespawnSlots: [{ depletedDay: 1, i: 2, j: 2, type: 'Gold' }],
      respawnNaturalResource: () => true,
    },
    menu: {},
    players: [{ units }],
  }
  new NaturalRegrowthSystem(context).applyDailyRegrowth({ day: 20 })
  assert.deepEqual(calls, [])
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

test('depleted compact berries regrow offscreen while intact berries stay compact', () => {
  const moduleCache = new Map()
  const { CompactResourceSet } = loadTsModule('app/classes/resources/CompactResourceSet.ts', { moduleCache })
  const NaturalRegrowthSystem = loadNaturalRegrowthSystem([], moduleCache)
  let created = 0
  const resources = new CompactResourceSet(
    2,
    100,
    'world',
    () => ({ totalQuantity: 50, totalHitPoints: 4 }),
    state => {
      created++
      return { ...state }
    },
    {}
  )
  resources.addState({ i: 1, j: 1, type: 'Berrybush', textureName: '000_resources/berrybush', quantity: 0 })
  resources.addState({ i: 2, j: 2, type: 'Berrybush', textureName: '002_resources/berrybush', quantity: 50 })
  const context = { map: { gaia: { animals: [] }, resources }, menu: {}, players: [] }
  new NaturalRegrowthSystem(context).applyDailyRegrowth({ day: 2, previousDay: 1 })
  assert.equal(created, 1)
  assert.equal(resources.byLabel('world:101').quantity, 10)
  assert.deepEqual(
    [...resources.readValues()].map(resource => resource.quantity),
    [10, 50]
  )
  assert.equal(created, 1)
})

test('daily renewal is batched and saving flushes pending changes exactly once', () => {
  const cache = new Map()
  const NaturalRegrowthSystem = loadNaturalRegrowthSystem([], cache)
  const { flushNaturalGrowth } = loadTsModule('app/services/NaturalGrowthQueue.ts', { moduleCache: cache })
  const callbacks = new Map()
  let restored = 0
  const context = {
    map: {
      resources: new Set(),
      naturalResourceRespawnSlots: Array.from({ length: 100 }, (_, i) => ({ type: 'Gold', i, j: 1, depletedDay: 1 })),
      respawnNaturalResource: () => {
        restored++
        return true
      },
    },
    players: [],
    scheduler: {
      add: fn => {
        callbacks.set(1, fn)
        return 1
      },
      remove: id => callbacks.delete(id),
    },
  }
  const system = new NaturalRegrowthSystem(context)
  system.handleDailyWorldEvent({ day: 15 })
  assert.equal(restored, 0)
  callbacks.get(1)()
  assert.equal(restored, 32)
  flushNaturalGrowth(context.map)
  assert.equal(restored, 100)
  assert.equal(callbacks.size, 0)
  assert.equal(context.map.naturalResourceRespawnSlots.length, 0)
  system.applyDailyRegrowth({ day: 16 })
  assert.equal(restored, 100)
  system.destroy()
})
