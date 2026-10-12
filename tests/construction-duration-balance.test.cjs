const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const buildings = require('../public/assets/data/gameplay/buildings.json')
const units = require('../public/assets/data/gameplay/units.json')
const { DAY_NIGHT_CONFIG } = loadTsModule('app/config/gameplay.ts')
const { getVillagerWorkingMinutes } = loadTsModule('app/lib/units/village/villagerSchedule.ts')
const { getWorkCycleMs } = loadTsModule('app/lib/economy/workTiming.ts')
const { getWorkToolTier } = loadTsModule('app/lib/equipment/workTools.ts')
const { getBuildRateXpMultiplier } = loadTsModule('app/lib/units/unitExperience.ts')
const { getBuildingConfigForLevel } = loadTsModule('app/lib/buildings/buildingLevel.ts')
const { getRepairGain } = loadTsModule('app/lib/economy/workRules.ts')
const { buildingInventory } = require('../tools/economy/model.cjs')

// Two novice builders, normal difficulty, all ingredients and replacement tools ready.
// Fix the representative schedule to avoid individual +/-20 minute meal/wake offsets.
const worker = {
  type: 'Villager',
  i: 0,
  j: 0,
  inventory: { activeWeapons: { tool: 'hammer_bronze' } },
  dailySchedule: {
    bedMinute: 1320,
    wakeMinute: 360,
    workStartMinute: 420,
    workEndMinute: 1080,
    lunchStartMinute: 720,
    lunchEndMinute: 780,
  },
}
const workingMinutes = getVillagerWorkingMinutes(worker, 0, DAY_NIGHT_CONFIG.hoursPerDay * 60)
const dayWork =
  ((2 * workingMinutes * (DAY_NIGHT_CONFIG.dayLengthMs / 1440)) / getWorkCycleMs(units.Villager, 'builder')) *
  getBuildRateXpMultiplier(worker) *
  (1 + getWorkToolTier(worker) * 0.25)
const targets = {
  House: [1, 3],
  Granary: [2, 3],
  StoragePit: [2],
  Barracks: [3, 5],
  ArcheryRange: [3],
  Stable: [3, 4],
  WatchTower: [2, 4],
  Market: [3],
  Forge: [4],
  Temple: [3, 5],
  TownCenter: [4, 6],
}

test('all upgrades take the intended number of working days for two novice bronze builders', () => {
  assert.equal(workingMinutes, 600)
  for (const [type, days] of Object.entries(targets)) {
    for (const [index, targetDays] of days.entries()) {
      const config = getBuildingConfigForLevel(buildings[type], index + 1)
      const actual = config.constructionWorkRequired / dayWork
      assert.ok(Math.abs(actual - targetDays) < targetDays * 0.02, `${type} level ${index + 1}: ${actual} days`)
      assert.ok(config.constructionWorkRequired > buildings[type].constructionWorkRequired)
    }
  }
  assert.deepEqual(
    Object.keys(buildings)
      .filter(type => buildings[type].levelStats)
      .sort(),
    Object.keys(targets).sort()
  )
})

test('base structures remain shorter than a working day even with two stone builders', () => {
  const stoneDayWork = dayWork / 1.5
  for (const [type, config] of Object.entries(buildings)) {
    if (!(config.constructionTime > 0)) continue
    const work = config.constructionWorkRequired ?? config.constructionTime
    assert.ok(work / stoneDayWork < 1, `${type} base is too slow`)
  }
  assert.ok(buildings.House.constructionWorkRequired / stoneDayWork < 0.15)
  assert.equal(buildings.Farm.constructionTime, 1)
  for (const type of ['Chest', 'FireCamp', 'Trap', 'CampBrazier']) assert.equal(buildings[type].constructionTime, 4)
})

test('repair speed remains viable and the audit reads the actual construction budget at every level', () => {
  const inventory = buildingInventory(buildings)
  for (const row of inventory.buildings) {
    const config = getBuildingConfigForLevel(buildings[row.type], row.level)
    assert.equal(row.constructionWork, config.constructionWorkRequired ?? config.constructionTime ?? null)
    if (config.constructionTime > 0) assert.ok(getRepairGain(config.totalHitPoints, config.constructionTime) > 0)
  }
  for (const row of inventory.upgrades) {
    assert.equal(row.constructionWork, buildings[row.type].levelStats[row.toLevel].constructionWorkRequired)
  }
})

test('duration estimates use game time and distinguish short builds from multi-day upgrades', () => {
  const { estimateConstructionDuration } = loadTsModule('app/lib/buildings/constructionDuration.ts')
  const { constructionDurationDescription } = loadTsModule('app/ui/ConstructionDurationDescription.ts')
  assert.equal(estimateConstructionDuration(0), null)
  assert.equal(estimateConstructionDuration(undefined), null)
  assert.equal(estimateConstructionDuration(NaN), null)
  assert.equal(estimateConstructionDuration(Infinity), null)
  const base = estimateConstructionDuration(buildings.House.constructionWorkRequired)
  assert.equal(base.unit, 'hours')
  assert.equal(base.value, 1)
  assert.equal(base.toolMaterial, 'stone')
  const forge = estimateConstructionDuration(buildings.Forge.levelStats[1].constructionWorkRequired, 1)
  assert.equal(forge.unit, 'days')
  assert.equal(forge.value, 4)
  assert.equal(forge.toolMaterial, 'bronze')
  assert.equal(estimateConstructionDuration(buildings.Chest.constructionWorkRequired).unit, 'hours')
  assert.equal(constructionDurationDescription({ constructionTime: 0 }), '')
  assert.match(constructionDurationDescription(buildings.House), /1 h de jeu/)
  assert.match(constructionDurationDescription(buildings.Forge.levelStats[1], 1), /4 jours de jeu/)
  assert.match(constructionDurationDescription(buildings.Forge.levelStats[1], 1, 48), /1 h de jeu/)
})

test('all report estimates match the shared menu calculation for each selected level', () => {
  const { estimateConstructionDuration } = loadTsModule('app/lib/buildings/constructionDuration.ts')
  const inventory = buildingInventory(buildings)
  for (const row of inventory.buildings) {
    assert.deepEqual(row.constructionDuration, estimateConstructionDuration(row.constructionWork, row.level))
  }
  for (const row of inventory.upgrades) {
    assert.deepEqual(row.constructionDuration, estimateConstructionDuration(row.constructionWork, row.toLevel))
  }
})
