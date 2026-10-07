const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const moduleCache = new Map()
const { planCollectiveTasks, collectiveHarvestBudget } = loadTsModule('app/lib/economy/collectiveTasks.ts', {
  moduleCache,
})
const { settlementStockGoals } = loadTsModule('app/lib/economy/collectiveStock.ts', { moduleCache })
const { allowsVillagerDeliveries, storageAcceptsResource } = loadTsModule('app/lib/resources/storagePolicy.ts')
const { depositChestResources } = loadTsModule('app/lib/resources/playerResourceTotals.ts')
function fixture(count = 6) {
  const center = {
    type: 'TownCenter',
    label: 'home',
    isBuilt: true,
    i: 10,
    j: 10,
    inventory: { resources: {} },
  }
  const pit = { type: 'StoragePit', label: 'pit', isBuilt: true, i: 12, j: 10, inventory: { resources: {} } }
  const granary = {
    type: 'Granary',
    label: 'grain',
    isBuilt: true,
    i: 14,
    j: 10,
    inventory: { resources: { wheat: 300 } },
  }
  const units = Array.from({ length: count }, (_, i) => ({
    type: 'Villager',
    label: `worker-${i}`,
    i: 11,
    j: 11,
    inactif: true,
    inventory: { resources: { wheat: 12 } },
  }))
  const owner = {
    type: 'Human',
    label: 'owner',
    age: 1,
    population: count,
    populationMax: count,
    units,
    buildings: [center, pit, granary],
  }
  return { owner, units, center, pit, granary }
}
test('reserve goals use the capacity of each completed depot', () => {
  const { owner, units, pit, granary } = fixture(1)
  owner.forgeUpgrades = { pickaxes: 2 }
  const goals = settlementStockGoals(owner, units[0])
  assert.deepEqual(goals, { wood: 150, stone: 90, gold: 30, copper: 15, tin: 6, iron: 9, wheat: 300, food: 8 })
  owner.buildings.push({ ...pit, label: 'second' })
  assert.deepEqual(settlementStockGoals(owner, units[0]), {
    ...goals,
    wood: 300,
    stone: 180,
    gold: 60,
    copper: 30,
    tin: 12,
    iron: 18,
  })
  owner.buildings = owner.buildings.filter(b => b.type === 'TownCenter')
  assert.deepEqual(settlementStockGoals(owner, units[0]), { food: 8 })
  owner.buildings.push({ ...pit, isBuilt: false }, { ...granary, isBuilt: false })
  assert.deepEqual(settlementStockGoals(owner, units[0]), { food: 8 })
})
test('idle human workers divide stock deficits into bounded claims', () => {
  const { owner, units } = fixture(10)
  const jobs = [...planCollectiveTasks(owner, units).values()].map(task => task.job)
  // The depot needs 150 wood; each provisioned bag has 18 free slots.
  assert.deepEqual(jobs, [...Array(9).fill('wood'), 'stone'])
  assert.equal(jobs.filter(job => job === 'wood').length, Math.ceil(150 / 18))
})
test('five missing wood claims one worker; cargo and manual assignments prevent duplicate work', () => {
  const { owner, units, pit } = fixture()
  pit.inventory.resources = { wood: 145, stone: 90, gold: 30, copper: 15, tin: 6, iron: 9 }
  assert.equal(planCollectiveTasks(owner, units).size, 1)
  units[0].inventory.resources.wood = 5
  assert.equal(planCollectiveTasks(owner, units).size, 0)
  units[0].inventory.resources = { wheat: 12 }
  units[0].autonomousJob = 'wood'
  units[0].inactif = false
  assert.equal(planCollectiveTasks(owner, units.slice(1), units).size, 0)
})
test('ongoing useful jobs retain their worker when earlier workers finish another task', () => {
  const { owner, units, pit } = fixture(2)
  pit.inventory.resources = { wood: 145, stone: 90, gold: 30, copper: 15, tin: 6, iron: 9 }
  units[0].collectiveTask = 'food'
  units[1].collectiveTask = 'wood'
  const plan = planCollectiveTasks(owner, units)
  assert.equal(plan.get(units[1]).job, 'wood')
  assert.equal(plan.has(units[0]), false)
})
test('construction replaces comfort goals and new food deficits take priority', () => {
  const { owner, units, center } = fixture(1)
  const site = {
    type: 'House',
    label: 'site',
    i: 11,
    j: 12,
    isBuilt: false,
    hitPoints: 1,
    totalHitPoints: 101,
    constructionMaterials: { cost: { stone: 4 }, delivered: {}, consumed: {} },
  }
  owner.buildings.push(site)
  assert.equal(planCollectiveTasks(owner, units).get(units[0]).job, 'stone')
  center.inventory.resources.wheat = 0
  owner.buildings.find(b => b.type === 'Granary').inventory.resources = {}
  units[0].collectiveTask = 'stone'
  units[0].inventory.resources = {}
  assert.equal(planCollectiveTasks(owner, units).get(units[0]).job, 'food')
})
test('harvest caps match reserve goals and ignore other villages', () => {
  const { owner, units, pit } = fixture(1)
  pit.inventory.resources.wood = 147
  units[0].collectiveTask = 'wood'
  owner.buildings.push({
    type: 'TownCenter',
    label: 'remote',
    i: 500,
    j: 500,
    isBuilt: true,
    inventory: { resources: { wood: 999 } },
  })
  assert.equal(collectiveHarvestBudget(owner, units[0], 'wood'), 3)
  units[0].inventory.resources.wood = 3
  assert.equal(collectiveHarvestBudget(owner, units[0], 'wood'), 0)
})
test('iron reserves unlock with suitable tools, not before', () => {
  const { owner, units } = fixture(1)
  owner.age = 0
  assert.equal(settlementStockGoals(owner, units[0]).iron, 0)
  units[0].inventory.equipment = ['pickaxe_bronze']
  assert.equal(settlementStockGoals(owner, units[0]).iron, 9)
})
test('automatic deliveries enforce depot roles and ignore legacy block flags', () => {
  const { owner, center, pit, granary } = fixture(1)
  center.inventory.resources = { wheat: 100 }
  for (const parent of [center, pit, granary]) {
    const chest = {
      type: 'Chest',
      label: `interior:owner:${parent.label}:default:storage-chest`,
      spaceId: `interior:owner:${parent.label}`,
      i: 1,
      j: 1,
      isBuilt: true,
      villagerDeliveriesBlocked: true,
      inventory: { resources: {} },
    }
    owner.buildings.push(chest)
    assert.equal(allowsVillagerDeliveries(chest, owner), parent !== center)
  }
  assert.equal(allowsVillagerDeliveries(center), false)
  assert.equal(allowsVillagerDeliveries({ type: 'Chest' }, owner), false)
  assert.equal(storageAcceptsResource('StoragePit', 'wheat'), false)
  assert.equal(storageAcceptsResource('Granary', 'wood'), false)
  assert.equal(depositChestResources(owner, { wood: 7, stone: 3, wheat: 5 }, { automaticDelivery: true }), true)
  assert.deepEqual(center.inventory.resources, { wheat: 100 })
  assert.deepEqual(
    owner.buildings.find(b => b.label === 'interior:owner:pit:default:storage-chest').inventory.resources,
    { wood: 7, stone: 3 }
  )
  assert.deepEqual(
    owner.buildings.find(b => b.label === 'interior:owner:grain:default:storage-chest').inventory.resources,
    { wheat: 5 }
  )
})

test('three days away replenish within full-capacity targets and never deposit into the town center', () => {
  const { simulateOfflineWorld } = loadTsModule('app/services/world/offline/OfflineWorldSimulation.ts')
  const { owner, center, pit } = fixture()
  const state = {
    world: { size: 40 },
    runtime: { dayNightElapsedMs: 0 },
    players: [owner],
    animals: [],
    resources: ['Tree', 'Stone', 'Gold', 'Copper', 'Tin', 'Iron', 'Berrybush'].map((type, index) => ({
      type,
      label: type,
      i: 20 + index,
      j: 20,
      hitPoints: type === 'Tree' ? 0 : 10,
      quantity: 1000,
      totalQuantity: 1000,
    })),
  }
  const day = 1440000
  const options = {
    fromElapsedMs: 0,
    toElapsedMs: 3 * day,
    terrain: Array.from({ length: 41 }, () => Array.from({ length: 41 }, () => ({ category: 'Grass' }))),
    unitConfig: () => ({ speed: 1.5, gatherAmount: { woodcutter: 1, stoneminer: 1, goldminer: 1, forager: 1 } }),
    buildingConfig: () => ({}),
    buildingCapacity: () => 0,
    cycleMs: () => 1000,
    wheatMatureFrame: 5,
  }
  const report = simulateOfflineWorld(state, options)
  for (const [key, value] of Object.entries({ wood: 150, stone: 90, gold: 30, copper: 15, tin: 6, iron: 9 })) {
    assert.ok((report.gathered[key] ?? 0) <= value, key)
    assert.equal(pit.inventory.resources[key] ?? 0, report.gathered[key] ?? 0, key)
    assert.equal(center.inventory.resources[key] ?? 0, 0, key)
  }
  assert.equal(report.foodShortage, 0)
  assert.equal(report.foodConsumed, 6 * 4 * 3)
  const again = simulateOfflineWorld(state, { ...options, fromElapsedMs: 3 * day, toElapsedMs: 4 * day })
  assert.equal(again.gathered.wood ?? 0, 0)
  assert.equal(again.gathered.stone ?? 0, 0)
})

test('regional gathering without depots consumes only what fits and never banks future production', () => {
  const { simulateOfflineWorld } = loadTsModule('app/services/world/offline/OfflineWorldSimulation.ts')
  const { owner, units, center } = fixture(1)
  owner.type = 'AI'
  owner.buildings = [center]
  center.inventory.resources = {}
  units[0].collectiveTask = 'food'
  units[0].inventory.resources = {}
  units[0].inventory.equipment = Array(29).fill('hammer')
  const berry = { type: 'Berrybush', label: 'berries', i: 15, j: 15, quantity: 100, hitPoints: 10 }
  const report = simulateOfflineWorld(
    { players: [owner], resources: [berry], animals: [] },
    {
      abstractVillages: true,
      fromElapsedMs: 0,
      toElapsedMs: 60000,
      terrain: Array.from({ length: 31 }, () => Array.from({ length: 31 }, () => ({ category: 'Grass' }))),
      unitConfig: () => ({ speed: 1.5, gatherAmount: { forager: 1 } }),
      buildingConfig: () => ({}),
      buildingCapacity: () => 0,
      cycleMs: () => 1000,
      wheatMatureFrame: 5,
      runtimeOwnsMeals: true,
    }
  )
  assert.equal(units[0].inventory.resources.berry, 1)
  assert.equal(berry.quantity, 99)
  assert.deepEqual(center.inventory.resources, {})
  assert.equal(owner.abstractProductionRemainder, undefined)
  assert.equal(report.gathered.berry, 1)
})

test('a provisioned starting companion chooses the new chantier instead of food gathering', () => {
  const { startingVillagerInventory } = loadTsModule('app/lib/economy/startingProvisions.ts')
  const unit = { type: 'Villager', i: 10, j: 10, inactif: true, inventory: startingVillagerInventory() }
  const site = {
    type: 'TownCenter',
    i: 12,
    j: 10,
    isBuilt: false,
    hitPoints: 1,
    totalHitPoints: 101,
    constructionMaterials: { cost: { wood: 10 }, delivered: {}, consumed: {} },
  }
  const owner = { type: 'Human', units: [unit], buildings: [site], population: 1, populationMax: 1 }
  assert.equal(planCollectiveTasks(owner, [unit]).get(unit).job, 'wood')
  unit.inventory.resources.wood = 10
  assert.equal(planCollectiveTasks(owner, [unit]).get(unit).job, 'construction')
  site.isBuilt = true
  assert.equal(planCollectiveTasks(owner, [unit]).size, 0)
})
