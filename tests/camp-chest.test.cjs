const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { tryCreateCampChest } = loadTsModule('app/lib/grid/campChestPlacement.ts')
const { planOfflineBuildings } = loadTsModule('app/services/world/OfflineWorldBuildingPlanner.ts')
const { simulateOfflineWorld } = loadTsModule('app/services/world/OfflineWorldSimulation.ts')
const definitions = require('../public/assets/data/gameplay/buildings.json')

function fixture() {
  const worker = {
    type: 'Villager',
    label: 'worker',
    i: 10,
    j: 10,
    autonomousJob: 'wood',
    inventory: { resources: { wood: 10 } },
  }
  const resource = { type: 'Tree', label: 'tree', i: 12, j: 12, quantity: 200, hitPoints: 0 }
  const buildings = []
  const terrain = Array.from({ length: 31 }, () => Array.from({ length: 31 }, () => ({ category: 'Land', z: 0 })))
  const options = {
    workers: [worker],
    resources: [resource],
    buildings,
    stocks: [],
    woodCost: 10,
    terrainAt: p => terrain[p.i]?.[p.j],
    isFree: p => !(p.i === resource.i && p.j === resource.j) && !(p.i === worker.i && p.j === worker.j),
    create: point => {
      buildings.push({ ...point, type: 'Chest', isBuilt: true })
      return true
    },
  }
  const player = { type: 'AI', label: 'ai', units: [worker], buildings, population: 1, populationMax: 4 }
  const state = {
    players: [player],
    resources: [resource],
    animals: [],
    config: {},
    world: {},
    runtime: { dayNightElapsedMs: 0 },
  }
  const rules = {
    planBuildings: true,
    buildingConfig: (_i, t) => definitions[t] ?? {},
    unitConfig: () => ({ speed: 1.5, gatherAmount: { woodcutter: 1 } }),
    buildingCapacity: () => 0,
    cycleMs: () => 1000,
    wheatMatureFrame: 5,
  }
  return { worker, options, player, state, terrain, rules }
}

test('camp crafting consumes carried wood only after a successful placement and creates no duplicate', () => {
  const { worker, options } = fixture()
  assert.equal(tryCreateCampChest({ ...options, create: () => false }), false)
  assert.equal(worker.inventory.resources.wood, 10)
  assert.equal(tryCreateCampChest(options), true)
  assert.equal(worker.inventory.resources.wood, 0)
  worker.inventory.resources.wood = 10
  assert.equal(tryCreateCampChest(options), false)
  assert.equal(worker.inventory.resources.wood, 10)
})

test('insufficient materials, unreachable work areas and existing depots prevent chest spam', () => {
  for (const reason of ['funds', 'terrain', 'depot', 'blockedChest']) {
    const { options, worker } = fixture()
    if (reason === 'funds') worker.inventory.resources.wood = 9
    if (reason === 'terrain') options.terrainAt = () => null
    if (reason === 'depot') options.buildings.push({ type: 'StoragePit', i: 14, j: 14, isBuilt: true })
    if (reason === 'blockedChest')
      options.buildings.push({ type: 'Chest', i: 14, j: 14, isBuilt: true, villagerDeliveriesBlocked: true })
    assert.equal(tryCreateCampChest(options), false, reason)
  }
})

test('offline camp bootstrap works with one worker and survives a first visit and saved return', () => {
  const { options, state, terrain, rules } = fixture()
  assert.equal(tryCreateCampChest(options), true)
  const expected = options.buildings[0]
  const saved = structuredClone(state)
  saved.players[0].buildings = []
  saved.players[0].units[0].inventory.resources.wood = 10
  planOfflineBuildings(saved, 1, terrain, rules)
  const chest = saved.players[0].buildings[0]
  assert.equal(chest.type, 'Chest')
  assert.deepEqual({ i: chest.i, j: chest.j }, { i: expected.i, j: expected.j })
  assert.equal(saved.players[0].units[0].inventory.resources.wood, 0)
  const restored = JSON.parse(JSON.stringify(saved))
  planOfflineBuildings(restored, 4, terrain, rules)
  assert.equal(restored.players[0].buildings.filter(b => b.type === 'Chest').length, 1)
})

test('an empty camp gathers its first wood and pays for its chest without invented supplies', () => {
  const { state, terrain, rules, worker } = fixture()
  worker.inventory.resources.wood = 0
  const report = simulateOfflineWorld(state, { ...rules, terrain, fromElapsedMs: 0, toElapsedMs: 2 * 1440000 })
  const chest = state.players[0].buildings.find(b => b.type === 'Chest')
  assert.ok(chest)
  const carried = worker.inventory.resources.wood ?? 0
  const stored = chest.inventory.resources.wood ?? 0
  assert.equal(report.gathered.wood, carried + stored + 10)
})

test('a camp can develop a permanent storage pit from its chest stocks', () => {
  const { state, terrain, rules } = fixture()
  state.players[0].buildings.push({
    type: 'Chest',
    label: 'camp',
    i: 8,
    j: 8,
    size: 1,
    isBuilt: true,
    inventory: { resources: { wood: 60, stone: 20 } },
  })
  planOfflineBuildings(state, 2, terrain, rules)
  assert.ok(state.players[0].buildings.some(b => b.type === 'StoragePit'))
})

test('the live AI uses the same paid camp placement as the offline planner', () => {
  const { handleAIBuildingActions } = loadTsModule('app/ai/AIStrategyBuilding.ts', {
    mocks: {
      '../lib': { canAfford: () => true, getPositionInGridAroundInstance: () => null },
      '../lib/buildings/passageCells': { createReservedPassageCellLookup: () => ({ has: () => false }) },
    },
  })
  const live = fixture(),
    offline = fixture()
  const grid = live.terrain.map((row, i) =>
    row.map((cell, j) => ({ ...cell, i, j, solid: !live.options.isFree({ i, j }) }))
  )
  const ai = {
    ...live.player,
    age: 0,
    phase: 'economy',
    config: { buildings: { Chest: definitions.Chest } },
    context: { map: { grid } },
    foundedResources: { Tree: new Set(live.state.resources) },
    getHomeAnchor: () => live.worker,
    hasNotReachBuildingLimit: () => true,
    buyBuilding: (i, j, type, options) => {
      assert.equal(options.alreadyPaid, true)
      live.player.buildings.push({ i, j, type, isBuilt: true })
      return true
    },
  }
  const snapshot = {
    map: { grid },
    towncenters: [],
    otherPlayers: [],
    maxVillagers: 1,
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
  const strategy = { ai, canSpendWithReserve: () => true, getDesiredBarracksCount: () => 0 }
  handleAIBuildingActions(strategy, snapshot)
  planOfflineBuildings(offline.state, 1, offline.terrain, offline.rules)
  const chest = offline.player.buildings[0]
  assert.deepEqual(live.player.buildings[0], { i: chest.i, j: chest.j, type: 'Chest', isBuilt: true })
  assert.equal(live.worker.inventory.resources.wood, 0)
  assert.equal(offline.worker.inventory.resources.wood, 0)
})
