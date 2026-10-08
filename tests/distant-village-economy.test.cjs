const assert = require('node:assert/strict')
const test = require('node:test')
const {
  fixture,
  advance,
  planDistantVillageBuildings,
  setUnitSuspension,
  DAY,
} = require('./helpers/distantEconomyFixture.cjs')

test('shared-map catch-up matches split updates and consumes meals once without creating villagers', () => {
  const whole = fixture()
  const split = fixture()
  advance(whole, 0, DAY)
  for (let i = 0; i < 24; i++) advance(split, (i * DAY) / 24, ((i + 1) * DAY) / 24)
  assert.deepEqual(split.store.inventory, whole.store.inventory)
  assert.deepEqual(split.owner.abstractProductionRemainder, whole.owner.abstractProductionRemainder)
  assert.equal(whole.owner.units.length, 1)
  assert.ok(whole.store.inventory.resources.wheat >= 100)
  assert.equal(whole.store.inventory.resources.wood ?? 0, 0)
  assert.deepEqual(whole.worker.inventory.resources, { wood: 3, wheat: 8 })
})

test('construction completes through runtime lifecycle once and preserves paid costs', () => {
  const f = fixture(true)
  advance(f, 0, DAY)
  assert.equal(f.house.isBuilt, true)
  assert.equal(f.house.hitPoints, 96)
  assert.equal(f.owner.populationMax, 10)
  advance(f, DAY, DAY * 2)
  assert.equal(f.owner.populationMax, 10)
  assert.notEqual(f.worker.work, 'builder')
})

test('planning does not charge a project again on repeated calls in the same day', () => {
  const f = fixture()
  // No affordable/eligible project: the daily checkpoint still persists.
  planDistantVillageBuildings(f.context, f.owner, f.homes)
  const inventory = structuredClone(f.store.inventory)
  planDistantVillageBuildings(f.context, f.owner, f.homes)
  assert.deepEqual(f.store.inventory, inventory)
  assert.equal(f.owner.offlineBuildingPlanDay, 1)
})

test('new live workers are not retroactively credited before being suspended', () => {
  const reference = fixture()
  const f = fixture()
  const newcomer = { ...f.worker, label: 'newcomer', i: 39, inventory: { resources: {} } }
  f.owner.units.push(newcomer)
  f.context.map.grid[39][40].has = newcomer
  advance(reference, 0, DAY)
  advance(f, 0, DAY)
  assert.deepEqual(f.store.inventory, reference.store.inventory)
  assert.deepEqual(newcomer.inventory.resources, {})
})

test('personal interior chest stays outside communal production', () => {
  const f = fixture()
  const chest = {
    label: 'chest',
    type: 'Chest',
    family: 'building',
    i: 3,
    j: 3,
    spaceId: 'interior:home',
    isBuilt: true,
    inventory: { resources: {} },
  }
  f.owner.buildings.push(chest)
  f.store.inventory = undefined
  f.context.map.spaces.set(chest.spaceId, { portals: [{ targetSpaceId: 'outside', targetCell: { i: 36, j: 36 } }] })
  advance(f, 0, DAY)
  assert.deepEqual(chest.inventory.resources, {})
  const stocks = structuredClone(chest.inventory)
  advance(f, DAY, DAY)
  assert.deepEqual(chest.inventory, stocks)
  assert.equal(chest.spaceId, 'interior:home')
  assert.equal(chest.i, 3)
})

test('daily planning creates one unpaid project with a persistent material recipe', () => {
  const f = fixture()
  f.owner.populationMax = 1
  f.owner.config.buildings.House.cost = { wood: 10 }
  f.store.inventory.resources.wood = 100
  const created = []
  f.owner.createBuilding = options => {
    const building = { ...options, family: 'building' }
    f.owner.buildings.push(building)
    created.push(building)
    f.context.map.grid[building.i][building.j].has = building
    return building
  }
  planDistantVillageBuildings(f.context, f.owner, f.homes)
  assert.equal(created.length, 1)
  assert.equal(created[0].type, 'House')
  assert.deepEqual(created[0].constructionMaterials, { cost: { wood: 10 }, delivered: {}, consumed: {} })
  assert.equal(f.store.inventory.resources.wood, 100)
  planDistantVillageBuildings(f.context, f.owner, f.homes)
  assert.equal(created.length, 1)
  assert.equal(f.store.inventory.resources.wood, 100)
})

test('AI project planning does not erase a pending material pickup or the current work checkpoint', () => {
  const f = fixture()
  f.worker.resourceDeliveryState = { building: f.store, pickup: { wood: 2 }, phase: 'toBuilding' }
  f.worker.action = 'delivery'
  f.worker.dest = f.store
  f.worker.offlineWork = { target: 'pickup:center', milliseconds: 500 }
  const pickup = f.worker.resourceDeliveryState
  planDistantVillageBuildings(f.context, f.owner, f.homes)
  assert.equal(f.worker.resourceDeliveryState, pickup)
  assert.equal(f.worker.action, 'delivery')
  assert.equal(f.worker.dest, f.store)
  assert.deepEqual(f.worker.offlineWork, { target: 'pickup:center', milliseconds: 500 })
})

test('player settlements never run AI project decisions', () => {
  const f = fixture()
  f.owner.isPlayed = true
  f.owner.type = 'Human'
  planDistantVillageBuildings(f.context, f.owner, f.homes)
  assert.equal(f.owner.offlineBuildingPlanDay, undefined)
})

test('travelers retain cargo and suspension when their village economy catches up', () => {
  const f = fixture()
  f.worker.roadJourney = { targetLabel: 'elsewhere' }
  setUnitSuspension(f.worker, { reason: 'road-travel', wake() {} })
  const before = structuredClone(f.worker.inventory)
  advance(f, 0, DAY)
  assert.deepEqual(f.worker.inventory, before)
  assert.deepEqual(f.worker.roadJourney, { targetLabel: 'elsewhere' })
})
