const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { isTutorialActive } = loadTsModule('app/services/tutorial/TutorialState.ts')

test('tutorial gate survives every current quest stage and ends with the camp conversation', () => {
  assert.equal(isTutorialActive(null), false)
  assert.equal(isTutorialActive({ introduction: { status: 'prepared' } }), false)
  for (const stage of ['sleeping', 'dialogue', 'wood-requested']) {
    assert.equal(isTutorialActive({ tutorial: { stage } }), true)
    assert.equal(isTutorialActive({ tutorial: { stage }, introduction: { status: 'completed' } }), false)
  }
})

test('daily handlers stay suspended during the tutorial while remote clocks are checkpointed', () => {
  let active = true
  let checkpoints = 0
  let events = 0
  const { DailyWorldEventSystem } = loadTsModule('app/services/DailyWorldEventSystem.ts', {
    mocks: {
      './DailyWorldReport': {
        DailyWorldReport: class {
          flush() {}
        },
      },
      './world/EconomicKnowledgeUpdates': { invalidateEconomicKnowledge() {} },
      './NaturalRegrowthSystem': { NaturalRegrowthSystem: class {} },
      './world/TrapHarvestSystem': { TrapHarvestSystem: class {} },
      './world/MarketRestockSystem': { MarketRestockSystem: class {} },
      './world/VillagerUpkeepSystem': { VillagerUpkeepSystem: class {} },
      './world/VillagerArrivalSystem': { VillagerArrivalSystem: class {} },
    },
  })
  const runtime = {
    context: { isTutorialActive: () => active, updateWorldEconomy: () => checkpoints++ },
    handlers: [{ handleDailyWorldEvent: () => events++ }],
  }
  DailyWorldEventSystem.prototype.handleDayChange.call(runtime, { day: 8, previousDay: 1 })
  assert.equal(events, 0)
  assert.equal(checkpoints, 1)
  active = false
  DailyWorldEventSystem.prototype.handleDayChange.call(runtime, { day: 9, previousDay: 8 })
  assert.equal(events, 1)
  assert.equal(checkpoints, 2)
})

test('day changes do not add housing or storage alerts to the daily report', () => {
  const entries = []
  let flushes = 0
  const { DailyWorldEventSystem } = loadTsModule('app/services/DailyWorldEventSystem.ts', {
    mocks: {
      '../lib/world/regionAlerts': {
        getActiveColonyAlerts: () => [
          { regionId: 'village', type: 'populationCapped' },
          { regionId: 'village', type: 'storageFull' },
        ],
      },
      './DailyWorldReport': {
        DailyWorldReport: class {
          add(entry) {
            entries.push(entry)
          }
          flush() {
            flushes++
          }
        },
      },
      '../lib/units/villageActivity': { flushVillageSimulation() {}, planDistantVillages() {} },
      './NaturalRegrowthSystem': { NaturalRegrowthSystem: class {} },
      './world/TrapHarvestSystem': { TrapHarvestSystem: class {} },
      './world/MarketRestockSystem': { MarketRestockSystem: class {} },
      './world/VillagerUpkeepSystem': { VillagerUpkeepSystem: class {} },
      './world/VillagerArrivalSystem': { VillagerArrivalSystem: class {} },
    },
  })
  const runtime = { context: { player: { isPlayed: true, label: 'p1' } }, handlers: [] }
  for (const day of [2, 3]) {
    DailyWorldEventSystem.prototype.handleDayChange.call(runtime, { day, previousDay: day - 1 })
  }
  assert.deepEqual(entries, [])
  assert.equal(flushes, 2)
})
