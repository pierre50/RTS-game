const { workerInventory } = require('./helpers/workerInventory.cjs')
const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const {
  createConstructionMaterials,
  deliverConstructionMaterials,
  constructionMaterialsReady,
  constructionBagNeeds,
  advanceMaterialConstruction,
  applyConstructionWork,
  remainingConstructionMaterials,
} = loadTsModule('app/lib/economy/constructionMaterials.ts')
const { constructionStores } = loadTsModule('app/lib/economy/constructionStores.ts')
const { planCollectiveTasks } = loadTsModule('app/lib/economy/collectiveTasks.ts')
const { consumeVillageFood } = loadTsModule('app/lib/economy/villageFood.ts')
const { simulateOfflineWorld } = loadTsModule('app/services/world/offline/OfflineWorldSimulation.ts')
const site = (type = 'House', cost = { wood: 40, stone: 10 }) => ({
  type,
  label: 'site',
  i: 10,
  j: 10,
  isBuilt: false,
  hitPoints: 101,
  constructionTime: 101,
  constructionWorkRequired: 101,
  constructionProgress: 0,
  totalHitPoints: 101,
  constructionMaterials: createConstructionMaterials(cost),
})
const center = (i, stock) => ({
  type: 'TownCenter',
  label: `center-${i}`,
  i,
  j: 10,
  isBuilt: true,
  inventory: { resources: stock },
})

test('partial and complete deliveries never advance work; the complete recipe unlocks building', () => {
  const building = site()
  const stock = { wood: 20, stone: 5 }
  deliverConstructionMaterials(building, [stock])
  assert.equal(building.constructionProgress, 0)
  assert.deepEqual(building.constructionMaterials.delivered, { wood: 20, stone: 5 })
  assert.deepEqual(building.constructionMaterials.consumed, {})
  assert.equal(advanceMaterialConstruction(building, 101), 0)
  applyConstructionWork(building, 101)
  assert.equal(building.constructionProgress, 0, 'direct work cannot bypass incomplete supplies')
  Object.assign(stock, { wood: 20, stone: 5 })
  deliverConstructionMaterials(building, [stock])
  assert.equal(building.constructionProgress, 0)
  assert.equal(constructionMaterialsReady(building), true)
  applyConstructionWork(building, advanceMaterialConstruction(building, 1))
  assert.equal(building.constructionProgress, 1 / 101)
  assert.deepEqual(building.constructionMaterials.consumed, { wood: 40, stone: 10 })
  applyConstructionWork(building, advanceMaterialConstruction(building, 101))
  assert.equal(building.constructionProgress, 1)
  assert.deepEqual(stock, { wood: 0, stone: 0 })
})

test('a partially supplied project survives a save without completing or repaying work', () => {
  let building = site()
  deliverConstructionMaterials(building, [{ wood: 30, stone: 5 }])
  building = JSON.parse(JSON.stringify(building))
  assert.deepEqual(remainingConstructionMaterials(building), { wood: 10, stone: 5 })
  assert.equal(advanceMaterialConstruction(building, 101), 0)
  const bag = { wood: 20, stone: 10 }
  deliverConstructionMaterials(building, [bag])
  assert.deepEqual(bag, { wood: 10, stone: 5 })
  assert.equal(building.constructionProgress, 0)
  applyConstructionWork(building, advanceMaterialConstruction(building, 1))
  assert.equal(building.constructionProgress, 1 / 101)
})

test('delivery reserves only missing recipe ingredients and leaves excess cargo in the bag', () => {
  const building = site('House', { wood: 100, stone: 100 })
  const bag = { wood: 120, fiber: 7 }
  deliverConstructionMaterials(building, [bag])
  assert.deepEqual(bag, { wood: 20, fiber: 7 })
  assert.equal(advanceMaterialConstruction(building, 101), 0)
  assert.deepEqual(constructionBagNeeds(building, bag, 10), { stone: 10 })
  bag.stone = 120
  deliverConstructionMaterials(building, [bag])
  assert.equal(building.constructionProgress, 0)
  applyConstructionWork(building, advanceMaterialConstruction(building, 101))
  assert.deepEqual(bag, { wood: 20, stone: 20, fiber: 7 })
  assert.deepEqual(building.constructionMaterials.consumed, { wood: 100, stone: 100 })
})

test('complete deposited materials permit work without withdrawing from another bag', () => {
  const building = site()
  building.constructionMaterials.delivered = { wood: 40, stone: 10 }
  const bag = { wood: 20, stone: 20 }
  assert.deepEqual(deliverConstructionMaterials(building, [bag]), {})
  assert.equal(advanceMaterialConstruction(building, 101), 101)
  assert.deepEqual(bag, { wood: 20, stone: 20 })
})

test('funded construction takes its full independent work budget and survives reload', () => {
  let building = site('House', { wood: 17, stone: 3 })
  const bag = { wood: 20, stone: 10 }
  deliverConstructionMaterials(building, [bag])
  for (let work = 1; work <= 101; work++) {
    applyConstructionWork(building, advanceMaterialConstruction(building, work))
    assert.equal(building.constructionProgress, work / 101)
    if (work === 50) building = JSON.parse(JSON.stringify(building))
  }
  assert.deepEqual(bag, { wood: 3, stone: 7 })
  assert.deepEqual(building.constructionMaterials.consumed, { wood: 17, stone: 3 })
})

test('construction never charges legacy prepaid sites again', () => {
  const old = { hitPoints: 40, totalHitPoints: 100, constructionTime: 100, isBuilt: false }
  assert.equal(advanceMaterialConstruction(old, 80), 80)
})

test('partially consumed legacy recipes retain progress and require only unpaid materials', () => {
  const building = site()
  building.constructionProgress = 0.5
  building.constructionMaterials.consumed = { wood: 25 }
  const bag = { wood: 15, stone: 10 }
  assert.deepEqual(remainingConstructionMaterials(building), bag)
  assert.equal(advanceMaterialConstruction(building, 101), 50.5)
  deliverConstructionMaterials(building, [bag])
  assert.equal(building.constructionProgress, 0.5)
  applyConstructionWork(building, advanceMaterialConstruction(building, 101))
  assert.deepEqual(building.constructionMaterials.consumed, { wood: 40, stone: 10 })
})

test('a distant village and personal chest cannot finance this construction', () => {
  const local = center(10, { wood: 5 })
  const distant = center(500, { wood: 999 })
  const chest = { ...center(12, { wood: 999 }), type: 'Chest' }
  const depot = { ...center(12, { wood: 5 }), type: 'StoragePit' }
  const owner = { buildings: [local, distant, chest, depot] }
  assert.deepEqual(constructionStores(owner, site()), [depot.inventory.resources])
  assert.deepEqual(constructionStores({ buildings: [site('TownCenter'), distant] }, site()), [])
})

test('collective work protects the first project and accounts for cargo already in transit', () => {
  const first = site('House', { wood: 10 })
  const second = { ...site('House', { stone: 10 }), label: 'second', i: 15 }
  const a = {
    type: 'Villager',
    i: 11,
    j: 10,
    inventory: { ...workerInventory('hammer_ceramic'), resources: { wood: 10, wheat: 12 } },
  }
  const b = {
    type: 'Villager',
    i: 12,
    j: 10,
    inventory: { ...workerInventory('hammer_ceramic'), resources: { wheat: 12 } },
  }
  const owner = { populationMax: 2, buildings: [center(8, { wheat: 100 }), first, second], units: [a, b] }
  const plan = planCollectiveTasks(owner, [a, b])
  assert.equal(plan.get(a).job, 'construction')
  assert.equal(plan.get(a).site, first)
  assert.ok(![...plan.values()].some(task => task.job === 'wood'), 'in-flight cargo covers the first project')
  assert.equal(plan.get(b).job, 'stone')
  assert.equal(plan.get(b).site, second, 'other workers can supply the second project')
})

test('camp meals consume carried food and leave the personal chest untouched', () => {
  const unit = {
    type: 'Villager',
    i: 10,
    j: 10,
    inventory: { ...workerInventory('hammer_ceramic'), resources: { berry: 6 } },
  }
  const chest = { ...center(10, { wheat: 100 }), type: 'Chest' }
  assert.deepEqual(consumeVillageFood({ units: [unit], buildings: [chest] }), { needed: 4, consumed: 4 })
  assert.equal(unit.inventory.resources.berry, 2)
  assert.equal(chest.inventory.resources.wheat, 100)
})

test('an idle villager founds the first center from local resources during a three-day absence', () => {
  const building = { ...site('TownCenter', { wood: 6, stone: 4 }), constructionWorkRequired: 4, constructionTime: 4 }
  const unit = {
    type: 'Villager',
    label: 'founder',
    i: 7,
    j: 7,
    hitPoints: 18,
    inactif: true,
    inventory: { ...workerInventory('hammer_ceramic'), resources: { berry: 8 } },
  }
  const player = {
    type: 'Human',
    label: 'human',
    population: 1,
    populationMax: 1,
    buildings: [building],
    units: [unit],
  }
  const state = {
    players: [player],
    resources: [
      { type: 'Tree', label: 'wood', i: 7, j: 12, quantity: 100, hitPoints: 0 },
      { type: 'Stone', label: 'stone', i: 13, j: 7, quantity: 100, hitPoints: 10 },
      { type: 'Berrybush', label: 'berries', i: 5, j: 6, quantity: 500, totalQuantity: 500, hitPoints: 10 },
    ],
    animals: [],
    world: { size: 30 },
  }
  const options = {
    fromElapsedMs: 0,
    toElapsedMs: 3 * 1440000,
    terrain: Array.from({ length: 31 }, () => Array.from({ length: 31 }, () => ({ category: 'Grass' }))),
    unitConfig: () => ({ speed: 1.5, totalHitPoints: 18, gatherAmount: { woodcutter: 1, stoneminer: 1, forager: 1 } }),
    buildingConfig: () => ({ size: 2, totalHitPoints: 101, constructionTime: 20 }),
    buildingCapacity: () => 0,
    cycleMs: () => 1000,
    wheatMatureFrame: 5,
    dailyFactors: () => ({ workEfficiency: 1, arrivalsAllowed: false }),
  }
  const split = structuredClone(state)
  const report = simulateOfflineWorld(state, options)
  for (let day = 0; day < 3; day++)
    simulateOfflineWorld(split, { ...options, fromElapsedMs: day * 1440000, toElapsedMs: (day + 1) * 1440000 })
  assert.equal(building.isBuilt, true, JSON.stringify({ report, unit, building }))
  assert.deepEqual(building.constructionMaterials.consumed, { wood: 6, stone: 4 })
  assert.equal(report.foodShortage, 0)
  assert.equal(report.gathered.wood, 6)
  assert.equal(report.gathered.stone, 4)
  assert.deepEqual(split.players, state.players)
})

test('the synthetic chest of a communal depot remains shared, while a house chest is private', () => {
  const depot = { ...center(10, {}), type: 'StoragePit' }
  const town = center(8, {})
  const home = { type: 'House', label: 'house', i: 15, j: 10, isBuilt: true }
  const communal = {
    type: 'Chest',
    label: 'interior:owner:center-10:default:storage-chest',
    spaceId: 'interior:owner:center-10',
    i: 2,
    j: 2,
    isBuilt: true,
    inventory: { resources: { wood: 40 } },
  }
  const personal = {
    ...communal,
    label: 'interior:owner:house:default:storage-chest',
    spaceId: 'interior:owner:house',
    inventory: { resources: { wood: 999 } },
  }
  const owner = { label: 'owner', buildings: [town, depot, home, communal, personal] }
  assert.deepEqual(constructionStores(owner, site()), [depot.inventory.resources, communal.inventory.resources])
})

test('one shared inventory reference cannot be charged or counted twice', () => {
  const building = site('House', { wood: 10 })
  const stock = { wood: 5 }
  deliverConstructionMaterials(building, [stock, stock])
  assert.equal(advanceMaterialConstruction(building, 101), 0)
  assert.equal(building.constructionMaterials.delivered.wood, 5)
  assert.equal(stock.wood, 0)
})

test('saved communal depot chests accept deliveries without runtime owner references', () => {
  const { depositChestResources } = loadTsModule('app/lib/resources/playerResourceTotals.ts')
  const home = center(10, {})
  const depot = { ...center(12, {}), type: 'StoragePit' }
  const chest = {
    type: 'Chest',
    label: 'interior:owner:center-12:default:storage-chest',
    spaceId: 'interior:owner:center-12',
    i: 1,
    j: 1,
    isBuilt: true,
    inventory: { resources: {} },
  }
  const owner = { label: 'owner', buildings: [home, depot, chest] }
  assert.equal(depositChestResources(owner, { wood: 5 }, { automaticDelivery: true }), true)
  assert.equal(chest.inventory.resources.wood, 5)
})

test('builders holding different ingredients can both work on the same site', () => {
  const building = site('TownCenter', { wood: 100, stone: 100 })
  const a = {
    type: 'Villager',
    i: 10,
    j: 10,
    inactif: true,
    inventory: { ...workerInventory('hammer_ceramic'), resources: { wheat: 12, wood: 9 } },
  }
  const b = { ...a, i: 11, inventory: { ...workerInventory('hammer_ceramic'), resources: { wheat: 12, stone: 9 } } }
  const owner = { units: [a, b], buildings: [building] }
  const plan = planCollectiveTasks(owner, [a, b])
  assert.equal(plan.get(a).job, 'construction')
  assert.equal(plan.get(b).job, 'construction')
})

test('an unattended trap site gathers fiber and finishes identically across save-sized simulation steps', () => {
  const building = { ...site('Trap', { wood: 5, fiber: 2 }), constructionWorkRequired: 4, constructionTime: 4 }
  const unit = {
    type: 'Villager',
    label: 'founder',
    i: 7,
    j: 7,
    hitPoints: 18,
    inactif: true,
    inventory: { ...workerInventory('hammer_ceramic'), resources: { berry: 8 } },
  }
  const player = {
    type: 'Human',
    label: 'human',
    population: 1,
    populationMax: 1,
    buildings: [building],
    units: [unit],
  }
  const state = {
    players: [player],
    resources: [
      { type: 'Tree', label: 'wood', i: 7, j: 12, quantity: 100, hitPoints: 0 },
      { type: 'FiberPlant', label: 'fiber', i: 13, j: 7, quantity: 100, hitPoints: 10 },
      { type: 'Berrybush', label: 'berries', i: 5, j: 6, quantity: 500, totalQuantity: 500, hitPoints: 10 },
    ],
    animals: [],
    world: { size: 30 },
  }
  const options = {
    fromElapsedMs: 0,
    toElapsedMs: 3 * 1440000,
    terrain: Array.from({ length: 31 }, () => Array.from({ length: 31 }, () => ({ category: 'Grass' }))),
    unitConfig: () => ({ speed: 1.5, totalHitPoints: 18, gatherAmount: { woodcutter: 1, stoneminer: 1, forager: 1 } }),
    buildingConfig: () => ({ size: 2, totalHitPoints: 101, constructionTime: 4 }),
    buildingCapacity: () => 0,
    cycleMs: () => 1000,
    wheatMatureFrame: 5,
    dailyFactors: () => ({ workEfficiency: 1, arrivalsAllowed: false }),
  }
  const split = structuredClone(state)
  const report = simulateOfflineWorld(state, options)
  for (let day = 0; day < 3; day++)
    simulateOfflineWorld(split, { ...options, fromElapsedMs: day * 1440000, toElapsedMs: (day + 1) * 1440000 })
  assert.equal(building.isBuilt, true, JSON.stringify({ report, unit, building }))
  assert.deepEqual(building.constructionMaterials.consumed, { wood: 5, fiber: 2 })
  assert.equal(report.foodShortage, 0)
  assert.equal(report.gathered.wood, 5)
  assert.equal(report.gathered.fiber, 2)
  assert.deepEqual(split.players, state.players)
})
