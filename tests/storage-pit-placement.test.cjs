const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { findStoragePitSite, needsStoragePit } = loadTsModule('app/lib/grid/storagePitPlacement.ts')
const { planOfflineBuildings } = loadTsModule('app/services/world/OfflineWorldBuildingPlanner.ts')
const { OfflineWorldSpatial } = loadTsModule('app/services/world/OfflineWorldSpatial.ts')
const { handleAIBuildingActions } = loadTsModule('app/ai/AIStrategyBuilding.ts', {
  mocks: {
    '../lib': { canAfford: () => true, getPositionInGridAroundInstance: () => null },
    '../lib/buildings/passageCells': { createReservedPassageCellLookup: () => ({ has: cell => cell.reservedPassage }) },
  },
})

function fixture() {
  const home = {
    type: 'TownCenter',
    i: 20,
    j: 20,
    size: 3,
    isBuilt: true,
    inventory: { resources: { wood: 1000, stone: 1000, wheat: 1000 } },
  }
  const resources = Array.from({ length: 8 }, (_, n) => ({
    type: 'Tree',
    i: 36 + (n % 4),
    j: 20 + Math.floor(n / 4),
    quantity: 500,
  }))
  const terrain = Array.from({ length: 71 }, (_, i) =>
    Array.from({ length: 71 }, (_, j) => ({ i, j, category: 'Land', z: 0 }))
  )
  const buildings = [home]
  const options = {
    home,
    size: 3,
    resources,
    buildings,
    terrainAt: p => terrain[p.i]?.[p.j],
    isFree: p =>
      !resources.some(r => r.i === p.i && r.j === p.j) &&
      !buildings.some(b => !b.isDestroyed && Math.abs(b.i - p.i) <= 2 && Math.abs(b.j - p.j) <= 2),
  }
  return { home, resources, terrain, buildings, options }
}
const distance = (a, b) => Math.hypot(a.i - b.i, a.j - b.j)

test('no depot for absent, depleted, interior or already served resources', () => {
  const { options, home } = fixture()
  for (const resources of [
    [],
    [{ type: 'Wheat', i: 36, j: 20, quantity: 1000 }],
    [{ type: 'Tree', i: 36, j: 20, quantity: 0 }],
    [{ type: 'Gold', i: 36, j: 20, quantity: 500, spaceId: 'cave' }],
    [{ type: 'Tree', i: home.i + 5, j: home.j, quantity: 500 }],
  ]) {
    assert.equal(needsStoragePit(resources, options.buildings), false)
    assert.equal(findStoragePitSite({ ...options, resources }), null)
  }
})

test('a forest outranks an isolated tree and input ordering cannot change the result', () => {
  const { options, resources } = fixture()
  resources.unshift({ type: 'Tree', i: 20, j: 30, quantity: 500 })
  const point = findStoragePitSite(options)
  assert.ok(point)
  assert.ok(resources.slice(1).filter(r => distance(point, r) <= 8).length >= 4)
  assert.deepEqual(findStoragePitSite({ ...options, resources: [...resources].reverse() }), point)
})

test('copper, iron and felled trees use the same placement policy', () => {
  for (const type of ['Copper', 'Iron', 'Tree']) {
    const { options, resources } = fixture()
    resources.forEach(r => Object.assign(r, { type, hitPoints: 0 }))
    assert.equal(needsStoragePit(resources, options.buildings), true)
    assert.ok(findStoragePitSite(options), type)
  }
})

test('pending and completed depots prevent redundant construction', () => {
  const { options, buildings } = fixture()
  const point = findStoragePitSite(options)
  assert.ok(point)
  buildings.push({ ...point, type: 'StoragePit', isBuilt: false })
  assert.equal(findStoragePitSite(options), null)
  buildings[1].isBuilt = true
  assert.equal(findStoragePitSite(options), null)
  buildings[1].isDestroyed = true
  assert.deepEqual(findStoragePitSite(options), point)
})

test('unreachable resources, blocked lots and elevation seams do not attract a depot', () => {
  const { options, terrain } = fixture()
  for (const row of terrain) row[27].category = 'Water'
  // The river cuts across j, so move the resources onto its far side.
  const resources = [{ type: 'Gold', i: 20, j: 36, quantity: 1000 }]
  assert.equal(findStoragePitSite({ ...options, resources }), null)
  assert.equal(findStoragePitSite({ ...options, isFree: () => false }), null)
  for (const row of terrain)
    for (const cell of row) {
      cell.category = 'Land'
      cell.z = cell.i % 2
    }
  assert.equal(findStoragePitSite(options), null)
})

test('live construction and offline first-visit/return planning choose the same lot', () => {
  const { home, resources, terrain } = fixture()
  const config = { size: 3, cost: { wood: 180, stone: 100 }, totalHitPoints: 350, constructionTime: 72 }
  const player = {
    type: 'AI',
    label: 'ai',
    age: 0,
    phase: 'economy',
    population: 4,
    populationMax: 20,
    buildings: [home],
    units: [0, 1, 2, 3].map(n => ({ type: 'Villager', i: 23 + n, j: 23, label: `worker-${n}` })),
  }
  const state = { players: [player], resources, animals: [], config: {}, world: {} }
  const rules = { buildingConfig: (_index, type) => (type === 'StoragePit' ? config : {}) }
  const spatial = new OfflineWorldSpatial(terrain, state, () => 3)
  const grid = terrain.map(row =>
    row.map(cell => ({
      ...cell,
      solid: !spatial.storageSiteFree(cell, false),
      reservedPassage: !spatial.storageSiteFree(cell, true),
    }))
  )
  const bought = []
  const ai = {
    ...player,
    config: { buildings: { StoragePit: config } },
    context: { map: { grid } },
    foundedTrees: new Set(resources),
    buyBuilding: (i, j, type) => {
      bought.push({ i, j, type })
      return true
    },
    hasNotReachBuildingLimit: () => true,
  }
  const snapshot = {
    map: { grid },
    towncenters: [home],
    otherPlayers: [],
    maxVillagers: 4,
    houses: [],
    farms: [],
    barracks: [],
    granarys: [],
    storagepits: [],
    markets: [],
    archeryRanges: [],
    stables: [],
    watchTowers: [],
    temples: [],
    notBuiltHouses: [],
  }
  handleAIBuildingActions({ ai, canSpendWithReserve: () => true, getDesiredBarracksCount: () => 0 }, snapshot)
  assert.equal(bought.length, 1)
  for (const day of [1, 4]) {
    const saved = structuredClone(state)
    planOfflineBuildings(saved, day, terrain, rules)
    const pit = saved.players[0].buildings.find(b => b.type === 'StoragePit')
    assert.ok(pit)
    assert.deepEqual({ i: pit.i, j: pit.j, type: pit.type }, bought[0])
    planOfflineBuildings(saved, day + 1, terrain, rules)
    assert.equal(saved.players[0].buildings.filter(b => b.type === 'StoragePit').length, 1)
  }
})

test('live village adds one forge after core infrastructure and does not duplicate it', () => {
  const { handleAIBuildingActions: build } = loadTsModule('app/ai/AIStrategyBuilding.ts', {
    mocks: {
      '../lib': { canAfford: () => true, getBuildingPlacementSearchSize: size => size, getPositionInGridAroundInstance: () => ({ i: 10, j: 10 }) },
      '../lib/buildings/passageCells': { createReservedPassageCellLookup: () => new Set() },
    },
  })
  const buildings = ['TownCenter', 'Granary', 'Market', 'Barracks'].map(type => ({ type, isBuilt: true, i: 20, j: 20 }))
  const ai = {
    age: 0, population: 5, populationMax: 20, phase: 'economy', buildings, units: [],
    config: { buildings: { Forge: require('../public/assets/data/gameplay/buildings.json').Forge } },
    context: { map: { grid: [] } }, foundedResources: {},
    hasNotReachBuildingLimit: (_type, existing) => existing.length < 1,
    buyBuilding: (i, j, type) => { buildings.push({ type, i, j, isBuilt: false }); return true },
  }
  const snapshot = {
    map: ai.context.map, towncenters: [buildings[0]], granarys: [buildings[1]], markets: [buildings[2]], barracks: [buildings[3]],
    otherPlayers: [], maxVillagers: 4, houses: [], farms: [], storagepits: [], archeryRanges: [], stables: [], watchTowers: [], temples: [], notBuiltHouses: [],
  }
  const strategy = { ai, canSpendWithReserve: () => true, getDesiredBarracksCount: () => 1 }
  assert.equal(build(strategy, snapshot), 1)
  assert.equal(build(strategy, snapshot), 0)
  buildings.at(-1).isBuilt = true
  assert.equal(build(strategy, snapshot), 0)
  assert.equal(buildings.filter(building => building.type === 'Forge').length, 1)
})
