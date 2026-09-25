const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { advanceVillageWork } = loadTsModule('app/services/world/VillageWorkSimulation.ts', {
  mocks: {
    'pixi.js': { Assets: { cache: { get: () => ({}) } } },
    '../../classes/map/generation/MapOfflineWorldSimulation': { offlineWorkCycleMs: () => 1000 },
    '../../lib/units/playerTargetKnowledge': { playerSeesTarget: () => true },
    '../../lib/mapSpaces': {
      isOutsideSpaceId: id => !id || id === 'outside',
      getEntitySpaceId: e => e?.spaceId ?? 'outside',
      ensureOutsideMapSpace: map => ({ grid: map.grid }),
      moveEntityToMapSpace(map, unit, _space, cell) {
        if (map.grid[unit.i][unit.j].has === unit) map.grid[unit.i][unit.j].has = null
        Object.assign(unit, { i: cell.i, j: cell.j })
        cell.has = unit
      },
    },
  },
})
function fixture() {
  const grid = Array.from({ length: 90 }, (_, i) =>
    Array.from({ length: 90 }, (_, j) => ({ i, j, category: 'Grass', z: 0 }))
  )
  const home = { id: 'center', i: 40, j: 40, spaceId: 'outside' }
  const store = {
    type: 'TownCenter',
    family: 'building',
    label: 'center',
    i: 36,
    j: 36,
    isBuilt: true,
    inventory: { resources: {} },
  }
  const owner = {
    type: 'AI',
    label: 'owner',
    buildings: [store],
    config: { units: { Villager: { speed: 1.5, gatherAmount: { woodcutter: 1 } } } },
  }
  const context = { map: { grid, revealEverything: true }, players: [owner] }
  const unit = {
    type: 'Villager',
    family: 'unit',
    label: 'worker',
    i: 40,
    j: 40,
    autonomousJob: 'wood',
    villageHome: home,
    owner,
    context,
  }
  const tree = {
    type: 'Tree',
    family: 'resource',
    label: 'tree',
    i: 40,
    j: 42,
    quantity: 3,
    hitPoints: 0,
    die() {
      this.isDestroyed = true
      grid[this.i][this.j].has = null
    },
  }
  for (const entity of [unit, tree, store]) grid[entity.i][entity.j].has = entity
  return { context, home, owner, unit, tree, store }
}
test('distant work depletes real nodes and commits only real stock once', () => {
  const { context, home, owner, unit, tree, store } = fixture()
  advanceVillageWork(context, home, owner, [unit], 60000)
  assert.equal(tree.quantity, 0)
  assert.equal(tree.isDestroyed, true)
  assert.equal(store.inventory.resources.wood, 3)
  advanceVillageWork(context, home, owner, [unit], 60000)
  assert.equal(store.inventory.resources.wood, 3)
})
test('resources outside the village and inaccessible resources cannot feed distant production', () => {
  for (const blocked of [false, true]) {
    const { context, home, owner, unit, tree, store } = fixture()
    if (!blocked) {
      context.map.grid[tree.i][tree.j].has = null
      tree.j = 71
      context.map.grid[tree.i][tree.j].has = tree
    } else {
      for (let i = 0; i < 90; i++) context.map.grid[i][41].category = 'Water'
    }
    advanceVillageWork(context, home, owner, [unit], 60000)
    assert.equal(tree.quantity, 3)
    assert.equal(store.inventory.resources.wood ?? 0, 0)
  }
})
test('short simulation slices retain travel progress and reach the same finite harvest', () => {
  const { context, home, owner, unit, tree, store } = fixture()
  for (let i = 0; i < 60; i++) advanceVillageWork(context, home, owner, [unit], 1000)
  assert.equal(tree.quantity, 0)
  assert.equal(store.inventory.resources.wood, 3)
})

test('competing workers cannot duplicate a finite node; blocked stores receive nothing', () => {
  const { context, home, owner, unit, tree, store } = fixture()
  store.villagerDeliveriesBlocked = true
  const second = { ...unit, label: 'second', i: 39, inventory: { resources: {} } }
  context.map.grid[39][40].has = second
  advanceVillageWork(context, home, owner, [unit, second], 60000)
  assert.equal(tree.quantity, 0)
  assert.equal(store.inventory.resources.wood ?? 0, 0)
  assert.equal((unit.inventory?.resources?.wood ?? 0) + (second.inventory?.resources?.wood ?? 0), 3)
})

test('player offline work preserves the assigned target and consumes finite resources', () => {
  const { context, home, owner, unit, tree, store } = fixture()
  owner.isPlayed = true
  owner.type = 'Human'
  unit.work = 'woodcutter'
  unit.action = 'chopwood'
  unit.dest = tree
  tree.quantity = 100
  const nearer = { ...tree, label: 'nearer', j: 41, quantity: 100 }
  context.map.grid[40][41].has = nearer
  advanceVillageWork(context, home, owner, [unit], 20000, 0)
  assert.ok(tree.quantity < 100)
  assert.equal(nearer.quantity, 100)
  assert.equal(unit.dest, tree)
  const consumed = 100 - tree.quantity
  assert.equal((store.inventory.resources.wood ?? 0) + (unit.inventory?.resources?.wood ?? 0), consumed)
})

test('player offline construction commits completion once and respects its queue', () => {
  const { context, home, owner, unit } = fixture()
  owner.isPlayed = true
  owner.type = 'Human'
  owner.config.buildings = { House: { totalHitPoints: 100, constructionTime: 10 } }
  let completions = 0
  const house = {
    label: 'house',
    type: 'House',
    family: 'building',
    i: 43,
    j: 43,
    hitPoints: 1,
    totalHitPoints: 100,
    isBuilt: false,
    updateHitPoints() {
      if (this.hitPoints >= 100 && !this.isBuilt) {
        this.isBuilt = true
        completions++
      }
    },
  }
  owner.buildings.push(house)
  context.map.grid[43][43].has = house
  unit.work = 'builder'
  unit.action = 'build'
  unit.autonomousJob = 'construction'
  unit.dest = house
  unit.buildQueue = [house]
  advanceVillageWork(context, home, owner, [unit], 60000, 0)
  assert.equal(house.hitPoints, 100)
  assert.equal(completions, 1)
  assert.deepEqual(unit.buildQueue, [])
  advanceVillageWork(context, home, owner, [unit], 60000, 60000)
  assert.equal(completions, 1)
})

test('player offline work respects night schedules and does not replay daily upkeep', () => {
  const { context, home, owner, unit, tree, store } = fixture()
  owner.isPlayed = true
  owner.type = 'Human'
  unit.work = 'woodcutter'
  unit.action = 'chopwood'
  unit.dest = tree
  store.inventory.resources.berry = 20
  // World begins at 07:30; +13 hours is 20:30.
  advanceVillageWork(context, home, owner, [unit], 60000, 13 * 60000)
  assert.equal(tree.quantity, 3)
  assert.equal(store.inventory.resources.berry, 20)
})
