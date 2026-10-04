const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const {
  createConstructionMaterials,
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
  hitPoints: 1,
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

test('construction progresses in proportion to supplied materials, with exact final costs', () => {
  const building = site()
  const stock = { wood: 20, stone: 5 }
  applyConstructionWork(building, advanceMaterialConstruction(building, 101, [stock]))
  assert.equal(building.hitPoints, 51)
  assert.deepEqual(building.constructionMaterials.consumed, { wood: 20, stone: 5 })
  assert.equal(advanceMaterialConstruction(building, 101, [stock]), 50.5)
  Object.assign(stock, { wood: 20, stone: 5 })
  applyConstructionWork(building, advanceMaterialConstruction(building, 101, [stock]))
  assert.equal(building.hitPoints, 101)
  assert.deepEqual(stock, { wood: 0, stone: 0 })
  assert.deepEqual(building.constructionMaterials.consumed, { wood: 40, stone: 10 })
})

test('a builder keeps unused ingredients and consumes only each hit fraction', () => {
  const building = site('TownCenter', { wood: 100 })
  building.totalHitPoints = 501
  const bag = { wood: 20, stone: 7 }
  applyConstructionWork(building, advanceMaterialConstruction(building, 5, [bag]))
  assert.deepEqual(bag, { wood: 19, stone: 7 })
  assert.deepEqual(building.constructionMaterials.delivered, {})
  applyConstructionWork(building, advanceMaterialConstruction(building, 501, [bag]))
  assert.equal(building.hitPoints, 101)
  assert.equal(bag.wood, 0)
  assert.equal(bag.stone, 7)
})

test('old deposited materials remain usable without taking new materials from a bag', () => {
  const building = site()
  building.constructionMaterials.delivered = { wood: 40, stone: 10 }
  const bag = { wood: 20, stone: 20 }
  assert.equal(advanceMaterialConstruction(building, 101, [bag]), 101)
  assert.deepEqual(bag, { wood: 20, stone: 20 })
})

test('wood and stone independently advance their share, without substituting for each other', () => {
  const building = site('House', { wood: 100, stone: 100 })
  const bag = { wood: 120 }
  applyConstructionWork(building, advanceMaterialConstruction(building, 101, [bag]))
  assert.equal(building.hitPoints, 51)
  assert.equal(bag.wood, 20)
  assert.equal(advanceMaterialConstruction(building, 101, [bag]), 50.5)
  assert.deepEqual(constructionBagNeeds(building, bag, 10), { stone: 10 })
  bag.stone = 100
  applyConstructionWork(building, advanceMaterialConstruction(building, 101, [bag]))
  assert.equal(building.hitPoints, 101)
  assert.deepEqual(bag, { wood: 20, stone: 0 })
  assert.deepEqual(building.constructionMaterials.consumed, { wood: 100, stone: 100 })
})

test('many small hits consume exactly the recipe even after a reload', () => {
  let building = site('House', { wood: 17, stone: 3 })
  const bag = { wood: 20, stone: 10 }
  for (let hp = 2; hp <= 101; hp++) {
    applyConstructionWork(building, advanceMaterialConstruction(building, hp, [bag]))
    if (hp === 50) building = JSON.parse(JSON.stringify(building))
  }
  assert.equal(building.hitPoints, 101)
  assert.deepEqual(bag, { wood: 3, stone: 7 })
  assert.deepEqual(building.constructionMaterials.consumed, { wood: 17, stone: 3 })
})

test('construction never charges legacy prepaid sites again', () => {
  const old = { hitPoints: 40, totalHitPoints: 100, isBuilt: false }
  assert.equal(advanceMaterialConstruction(old, 80), 80)
})

test('materials survive reload and repairing damage does not charge consumed materials again', () => {
  let building = site()
  applyConstructionWork(building, advanceMaterialConstruction(building, 50.5, [{ wood: 40, stone: 10 }]))
  building = JSON.parse(JSON.stringify(building))
  building.hitPoints = 11
  assert.equal(advanceMaterialConstruction(building, 50.5), 50.5)
  assert.deepEqual(building.constructionMaterials.consumed, { wood: 25 })
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
  const a = { type: 'Villager', i: 11, j: 10, inventory: { resources: { wood: 10, wheat: 12 } } }
  const b = { type: 'Villager', i: 12, j: 10, inventory: { resources: { wheat: 12 } } }
  const owner = { populationMax: 2, buildings: [center(8, { wheat: 100 }), first, second], units: [a, b] }
  const plan = planCollectiveTasks(owner, [a, b])
  assert.equal(plan.get(a).job, 'construction')
  assert.equal(plan.get(a).site, first)
  assert.ok(![...plan.values()].some(task => task.job === 'stone' || task.job === 'wood'))
})

test('camp meals consume carried food and leave the personal chest untouched', () => {
  const unit = { type: 'Villager', i: 10, j: 10, inventory: { resources: { berry: 6 } } }
  const chest = { ...center(10, { wheat: 100 }), type: 'Chest' }
  assert.deepEqual(consumeVillageFood({ units: [unit], buildings: [chest] }), { needed: 4, consumed: 4 })
  assert.equal(unit.inventory.resources.berry, 2)
  assert.equal(chest.inventory.resources.wheat, 100)
})

test('an idle villager founds the first center from local resources during a three-day absence', () => {
  const building = site('TownCenter', { wood: 6, stone: 4 })
  const unit = {
    type: 'Villager',
    label: 'founder',
    i: 7,
    j: 7,
    hitPoints: 18,
    inactif: true,
    inventory: { resources: { berry: 8 } },
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
  assert.equal(advanceMaterialConstruction(building, 101, [stock, stock]), 50.5)
  assert.equal(building.constructionMaterials.consumed.wood, 5)
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
  const a = { type: 'Villager', i: 10, j: 10, inactif: true, inventory: { resources: { wheat: 12, wood: 9 } } }
  const b = { ...a, i: 11, inventory: { resources: { wheat: 12, stone: 9 } } }
  const owner = { units: [a, b], buildings: [building] }
  const plan = planCollectiveTasks(owner, [a, b])
  assert.equal(plan.get(a).job, 'construction')
  assert.equal(plan.get(b).job, 'construction')
})

test('an unattended trap site gathers fiber and finishes identically across save-sized simulation steps', () => {
  const building = site('Trap', { wood: 5, fiber: 2 })
  const unit = {
    type: 'Villager',
    label: 'founder',
    i: 7,
    j: 7,
    hitPoints: 18,
    inactif: true,
    inventory: { resources: { berry: 8 } },
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
