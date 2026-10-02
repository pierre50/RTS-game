const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { planCollectiveTasks } = loadTsModule('app/lib/economy/collectiveTasks.ts')
const { withdrawDepotResources } = loadTsModule('app/lib/economy/depotPickup.ts')
const { consumeVillageFood } = loadTsModule('app/lib/economy/villageFood.ts')
function fixture() {
  const unit = {
    type: 'Villager',
    label: 'worker',
    i: 10,
    j: 10,
    inactif: true,
    inventory: { resources: { wheat: 12 } },
  }
  const center = { type: 'TownCenter', label: 'center', i: 6, j: 6, isBuilt: true, inventory: { resources: {} } }
  const pit = {
    type: 'StoragePit',
    label: 'pit',
    i: 8,
    j: 6,
    isBuilt: true,
    inventory: { resources: { wood: 20, stone: 10 } },
  }
  const grain = { type: 'Granary', label: 'grain', i: 6, j: 8, isBuilt: true, inventory: { resources: { wheat: 100 } } }
  const site = {
    type: 'House',
    label: 'house',
    i: 15,
    j: 15,
    isBuilt: false,
    hitPoints: 1,
    totalHitPoints: 101,
    constructionMaterials: { cost: { wood: 20, stone: 10 }, delivered: {}, consumed: {} },
  }
  const owner = {
    type: 'Human',
    label: 'human',
    population: 1,
    populationMax: 1,
    units: [unit],
    buildings: [center, pit, grain, site],
  }
  return { owner, unit, pit, grain, site }
}
test('construction schedules a bounded physical pickup without spending depot stock', () => {
  const { owner, unit, pit, site } = fixture()
  const task = planCollectiveTasks(owner, [unit]).get(unit)
  assert.equal(task.pickup.building, pit)
  assert.deepEqual(task.pickup.resources, { wood: 18 })
  assert.equal(pit.inventory.resources.wood, 20)
  assert.deepEqual(site.constructionMaterials.delivered, {})
  withdrawDepotResources(unit, pit.inventory.resources, task.pickup.resources)
  assert.equal(unit.inventory.resources.wood, 18)
  assert.equal(pit.inventory.resources.wood, 2)
  assert.equal(planCollectiveTasks(owner, [unit]).get(unit).site, site)
})
test('provisions are fetched from the granary and daily meals never borrow other inventories', () => {
  const { owner, unit, grain } = fixture()
  unit.inventory.resources = { wheat: 1 }
  const task = planCollectiveTasks(owner, [unit]).get(unit)
  assert.equal(task.pickup.building, grain)
  assert.deepEqual(task.pickup.resources, { food: 3 })
  assert.equal(consumeVillageFood(owner).consumed, 1)
  assert.equal(grain.inventory.resources.wheat, 100)
  withdrawDepotResources(unit, grain.inventory.resources, task.pickup.resources)
  assert.equal(grain.inventory.resources.wheat, 97)
  assert.equal(consumeVillageFood(owner).consumed, 3)
  assert.equal(unit.inventory.resources.wheat, 0)
})
test('concurrent withdrawals conserve scarce stocks and respect bag capacity', () => {
  const { unit } = fixture()
  const other = structuredClone(unit)
  const stock = { wood: 20 }
  assert.equal(withdrawDepotResources(unit, stock, { wood: 30 }), 18)
  assert.equal(withdrawDepotResources(other, stock, { wood: 30 }), 2)
  assert.equal(stock.wood, 0)
})
test('offline builders fetch depot materials before using them at the site', () => {
  const { simulateOfflineWorld } = loadTsModule('app/services/world/offline/OfflineWorldSimulation.ts')
  const { owner, pit, site } = fixture()
  const state = { camera: { x: 0, y: 0 }, world: { size: 30 }, players: [owner], resources: [], animals: [] }
  const options = {
    fromElapsedMs: 0,
    toElapsedMs: 8 * 60000,
    terrain: Array.from({ length: 31 }, () => Array.from({ length: 31 }, () => ({ category: 'Grass' }))),
    unitConfig: () => ({ speed: 1.5 }),
    buildingConfig: () => ({ size: 1, constructionTime: 20, totalHitPoints: 101 }),
    buildingCapacity: () => 0,
    cycleMs: () => 1000,
    wheatMatureFrame: 5,
  }
  const report = simulateOfflineWorld(state, options)
  assert.equal(report.buildingsCompleted, 1)
  assert.equal(site.isBuilt, true)
  assert.deepEqual(site.constructionMaterials.consumed, { wood: 20, stone: 10 })
  assert.equal(pit.inventory.resources.wood, 0)
  assert.equal(pit.inventory.resources.stone, 0)
})

test('a pickup already in transit reserves its load against another builder', () => {
  const { owner, unit, pit, site } = fixture()
  site.constructionMaterials.cost = { wood: 10 }
  const carrier = {
    ...structuredClone(unit),
    label: 'carrier',
    resourceDeliveryState: { building: pit, pickup: { wood: 10 } },
  }
  owner.units.push(carrier)
  const task = planCollectiveTasks(owner, [unit], owner.units).get(unit)
  assert.equal(task?.pickup, undefined)
  assert.equal(pit.inventory.resources.wood, 20)
})

test('legacy town-center stock does not prevent gathering materials that cannot be withdrawn', () => {
  const { owner, unit, pit } = fixture()
  pit.inventory.resources = {}
  owner.buildings[0].inventory.resources.wood = 1000
  const task = planCollectiveTasks(owner, [unit]).get(unit)
  assert.equal(task.job, 'wood')
  assert.equal(task.pickup, undefined)
})
