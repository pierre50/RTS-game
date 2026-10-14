const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { planVillagerArrivals } = loadTsModule('app/lib/population/villagerArrivals.ts')
const { calculateVillagerArrivals } = loadTsModule('app/lib/buildings/townCenter.ts')
const { getBuildingCombatProfile, getBuildingAttackRange } = loadTsModule('app/lib/buildings/towerCombat.ts')
const { getStorageCapacity } = loadTsModule('app/lib/resources/storagePolicy.ts')
function village(level, offset = 0, population = 20, food = 1000) {
  const center = {
    type: 'TownCenter',
    label: `tc-${offset}`,
    i: offset,
    j: 0,
    isBuilt: true,
    buildingLevel: level,
    inventory: { resources: { wheat: food } },
  }
  const houses = Array.from({ length: population + 3 }, (_, i) => ({
    type: 'House',
    label: `house-${offset}-${i}`,
    i: offset + 1,
    j: i % 10,
    isBuilt: true,
    interiorBuildings: Array.from({ length: 1 }, (_, b) => ({
      type: 'CampBedroll',
      label: `bed-${offset}-${i}-${b}`,
      isBuilt: true,
    })),
  }))
  const units = Array.from({ length: population }, (_, i) => ({
    type: 'Villager',
    label: `v-${offset}-${i}`,
    i: offset + 1,
    j: 0,
    homeHouseLabel: houses[i].label,
  }))
  return { label: 'owner', population, populationMax: population + 3, units, buildings: [center, ...houses] }
}

test('town center profiles combine restrained defense and immigration without extra storage', () => {
  for (const [buildingLevel, expected] of [1, 2, 3].entries()) {
    const building = { type: 'TownCenter', buildingLevel }
    assert.equal(calculateVillagerArrivals({ population: 20, populationMax: 30, buildingLevel }), expected)
    assert.equal(getBuildingCombatProfile(building).power, [2, 3, 4][buildingLevel])
    assert.equal(getBuildingCombatProfile(building).targets, [1, 1, 2][buildingLevel])
    assert.equal(getBuildingAttackRange(building), [4, 4.5, 5][buildingLevel])
    assert.equal(getStorageCapacity(building), 300)
    assert.equal(planVillagerArrivals(village(buildingLevel))[0].count, expected)
  }
})

test('food gates arrivals at the exact local reserve threshold without spending resources', () => {
  const owner = village(2, 0, 20, 259)
  const stocks = owner.buildings[0].inventory.resources
  assert.equal(planVillagerArrivals(owner)[0].count, 0)
  assert.equal(planVillagerArrivals(owner)[0].reason, 'villageReportNoFood')
  stocks.wheat = 260
  assert.equal(planVillagerArrivals(owner)[0].count, 1)
  stocks.wheat = 300
  assert.equal(planVillagerArrivals(owner)[0].count, 3)
  assert.equal(stocks.wheat, 300)
})

test('overlapping centers share the best allowance and remote towns cannot lend provisions', () => {
  const owner = village(0)
  owner.buildings.push({ type: 'TownCenter', label: 'upgraded', i: 5, j: 0, isBuilt: true, buildingLevel: 2 })
  assert.equal(planVillagerArrivals(owner).length, 1)
  assert.equal(planVillagerArrivals(owner)[0].food, 1000)
  assert.equal(planVillagerArrivals(owner)[0].count, 3)
  const remote = village(2, 1000, 20, 0)
  owner.units.push(...remote.units)
  owner.buildings.push(...remote.buildings)
  owner.population += remote.population
  owner.populationMax += remote.populationMax
  const plans = planVillagerArrivals(owner)
  assert.deepEqual(
    plans.map(plan => plan.count),
    [3, 0]
  )
})

test('saved centers keep their level and hero food never substitutes communal provisions', () => {
  const owner = village(2, 0, 20, 0)
  owner.units.push({ type: 'Hero', label: 'hero', i: 0, j: 0, inventory: { resources: { wheat: 10000 } } })
  const saved = JSON.parse(JSON.stringify(owner))
  assert.equal(planVillagerArrivals(saved)[0].count, 0)
  saved.buildings[0].inventory.resources.wheat = 300
  assert.equal(planVillagerArrivals(saved)[0].count, 3)
})

test('live and detached arrivals honor the same plan and assign homes without duplication', () => {
  const { VillagerArrivalSystem } = loadTsModule('app/services/world/VillagerArrivalSystem.ts')
  const owner = village(2)
  owner.type = 'Human'
  const center = owner.buildings[0]
  center.placeUnit = (type, extra) => {
    owner.units.push({ type, label: `new-${owner.population}`, i: 0, j: 0, ...extra })
    owner.population++
    return true
  }
  const count = planVillagerArrivals(JSON.parse(JSON.stringify(owner)))[0].count
  const report = []
  new VillagerArrivalSystem({ players: [owner], map: { random: () => 0.5 } }).handleDailyWorldEvent({
    day: 2,
    report: { add: entry => report.push(entry.count) },
  })
  assert.deepEqual(report, [count])
  assert.equal(owner.population, 23)
  assert.equal(new Set(owner.units.slice(20).map(unit => unit.homeHouseLabel)).size, 3)
  assert.equal(planVillagerArrivals(owner)[0].count, 0)
})

test('three arrivals can share the three remaining beds of one upgraded house', () => {
  const { VillagerArrivalSystem } = loadTsModule('app/services/world/VillagerArrivalSystem.ts')
  const owner = village(2)
  owner.type = 'Human'
  owner.buildings.splice(-3)
  const house = owner.buildings[1]
  house.buildingLevel = 2
  house.interiorBuildings.push(
    ...Array.from({ length: 3 }, (_, index) => ({
      type: 'CampBedroll',
      label: `extra-${index}`,
      isBuilt: true,
    }))
  )
  const plan = planVillagerArrivals(JSON.parse(JSON.stringify(owner)))[0]
  assert.equal(plan.count, 3)
  assert.equal(new Set(plan.homes.map(entry => entry.home.label)).size, 1)
  assert.equal(new Set(plan.homes.map(entry => entry.bed)).size, 3)
  owner.buildings[0].placeUnit = (type, extra) => {
    owner.units.push({ type, label: `new-${owner.population}`, i: 0, j: 0, ...extra })
    owner.population++
    return true
  }
  new VillagerArrivalSystem({ players: [owner], map: { random: () => 0.5 } }).handleDailyWorldEvent({
    day: 2,
    report: { add() {} },
  })
  assert.equal(owner.population, 23)
  assert.ok(owner.units.slice(20).every(unit => unit.homeHouseLabel === house.label))
  assert.equal(
    new Set(owner.units.filter(unit => unit.homeHouseLabel === house.label).map(unit => unit.homeBedLabel)).size,
    4
  )
  assert.equal(planVillagerArrivals(owner)[0].count, 0)
})
