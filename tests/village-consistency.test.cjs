const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { depositChestResources, getPlayerResourceTotals, withdrawChestResources } = loadTsModule(
  'app/lib/resources/playerResourceTotals.ts'
)
const { storageAcceptsResource } = loadTsModule('app/lib/resources/storagePolicy.ts')
const { invalidateEconomicKnowledge, shouldRefreshEconomicKnowledge } = loadTsModule(
  'app/services/world/EconomicKnowledgeUpdates.ts'
)
const { populateVillageBase } = loadTsModule('app/services/world/VillageBaseState.ts')
const { OfflineWorldSpatial } = loadTsModule('app/services/world/OfflineWorldSpatial.ts')
const { applyVillageStartingState } = loadTsModule('app/services/world/VillageStartingState.ts')
const { advanceCampaignEconomy, encodeEconomyTerrain, materializeInitialEconomy, captureEconomyRegion } = loadTsModule(
  'app/services/world/WorldEconomy.ts'
)
const { savedResourceOwner } = loadTsModule('app/services/world/OfflineWorldWork.ts')
const buildings = require('../public/assets/data/gameplay/buildings.json')
const units = require('../public/assets/data/gameplay/units.json')
const rules = {
  buildingConfig: (_i, type) => buildings[type] ?? {},
  unitConfig: (_i, type) => units[type] ?? {},
  buildingCapacity: (_i, type) => buildings[type]?.shelterCapacity ?? buildings[type]?.increasePopulation ?? 0,
  cycleMs: () => 1000,
  wheatMatureFrame: 5,
  abstractVillages: true,
  planBuildings: true,
}

test('food and materials reach distinct stores before and after interiors are created', () => {
  const center = { label: 'tc', type: 'TownCenter', isBuilt: true, inventory: { resources: { wood: 20 } } }
  const granary = { label: 'gr', type: 'Granary', isBuilt: true }
  const pit = { label: 'pit', type: 'StoragePit', isBuilt: true }
  const owner = { label: 'owner', buildings: [center, pit, granary], units: [] }
  assert.equal(depositChestResources(owner, { food: 60, wood: 80, iron: 5 }), true)
  assert.equal(granary.inventory.resources.wheat, 60)
  assert.equal(pit.inventory.resources.wood, 80)
  assert.equal(center.inventory.resources.wood, 20)
  const chest = { label: 'chest', type: 'Chest', spaceId: 'interior:owner:gr', inventory: granary.inventory }
  granary.inventory = { resources: {} }
  owner.buildings.push(chest)
  depositChestResources(owner, { wheat: 10, stone: 20 })
  assert.equal(chest.inventory.resources.wheat, 70)
  assert.equal(pit.inventory.resources.stone, 20)
  assert.equal(getPlayerResourceTotals(owner).food, 70)
  const restored = JSON.parse(JSON.stringify(owner))
  assert.deepEqual(getPlayerResourceTotals(restored), getPlayerResourceTotals(owner))
  assert.equal(withdrawChestResources(restored, { food: 70, wood: 100 }), true)
  assert.equal(getPlayerResourceTotals(restored).food, 0)
  assert.equal(getPlayerResourceTotals(restored).wood, 0)
  assert.equal(storageAcceptsResource('Granary', 'wood'), false)
  assert.equal(storageAcceptsResource('StoragePit', 'wheat'), false)
  const isolated = { buildings: [{ type: 'Granary', isBuilt: true }] }
  assert.equal(depositChestResources(isolated, { wheat: 10, wood: 10 }), false)
  assert.equal(isolated.buildings[0].inventory, undefined, 'a failed mixed deposit is atomic')
})

test('economic scans skip unchanged decisions and resume after events, exploration or timeout', () => {
  const owner = {},
    map = {},
    other = {}
  assert.equal(shouldRefreshEconomicKnowledge(owner, map, 0, 5), true)
  assert.equal(shouldRefreshEconomicKnowledge(owner, map, 4000, 5), false)
  invalidateEconomicKnowledge(map)
  assert.equal(shouldRefreshEconomicKnowledge(owner, map, 5000, 5), true)
  assert.equal(shouldRefreshEconomicKnowledge(owner, map, 6000, 6), true)
  assert.equal(shouldRefreshEconomicKnowledge(owner, map, 21000, 6), true)
  assert.equal(shouldRefreshEconomicKnowledge(owner, other, 21001, 6), true)
})

test('profile, ten offline days, first arrival and saved return preserve economy without double advancement', () => {
  const terrain = Array.from({ length: 61 }, () => Array.from({ length: 61 }, () => ({ category: 'Land' })))
  let state = {
    world: { worldRegionId: 'home' },
    config: { difficulty: 'medium' },
    runtime: { dayNightElapsedMs: 0 },
    players: [{ type: 'AI', civ: 'Hellas', factionId: 'civ-hellas', label: 'ai', age: 0 }],
    resources: [],
    animals: [],
    camera: { x: 0, y: 0 },
  }
  populateVillageBase(state.players[0], 0, { i: 30, j: 30 }, new OfflineWorldSpatial(terrain, state, () => 2), rules, {
    wood: 200,
    food: 200,
    stone: 150,
  })
  state = applyVillageStartingState(
    state,
    { Hellas: { age: 0, buildings: { Granary: 1, StoragePit: 1 }, units: { Villager: 8 }, wallRadius: 22 } },
    terrain,
    rules
  )
  const campaign = {
    currentWorldId: 'away',
    worlds: {},
    economy: {
      version: 1,
      regions: {
        home: {
          regionId: 'home',
          terrain: encodeEconomyTerrain(terrain),
          initialState: state,
          simulatedUntilMs: 0,
          summaries: {},
        },
      },
    },
  }
  const time = 10 * 1440000
  advanceCampaignEconomy(campaign, time, 'away', () => rules)
  const generated = { ...state, players: [] }
  const arrived = materializeInitialEconomy(generated, campaign.economy.regions.home.initialState, time)
  const totals = getPlayerResourceTotals(savedResourceOwner(arrived.players[0], arrived.players))
  campaign.currentWorldId = 'home'
  campaign.worlds.home = { id: 'home', state: arrived }
  captureEconomyRegion(campaign, arrived, terrain)
  const saved = JSON.parse(JSON.stringify(campaign))
  advanceCampaignEconomy(saved, time, 'away', () => rules)
  assert.deepEqual(
    getPlayerResourceTotals(savedResourceOwner(saved.worlds.home.state.players[0], saved.worlds.home.state.players)),
    totals
  )
  assert.deepEqual(saved.worlds.home.state, arrived)
  assert.equal(saved.economy.regions.home.initialState, undefined)
  const p = arrived.players[0]
  assert.equal(p.population, p.units.length + p.buildings.flatMap(b => b.trainingQueue ?? []).length)
  assert.equal(new Set([...p.units, ...p.buildings].map(e => e.label)).size, p.units.length + p.buildings.length)

  // Check actual cardinal paths through the final building footprints, including walls.
  const occupied = new Set()
  for (const b of p.buildings) {
    const radius = Math.ceil((b.size ?? buildings[b.type]?.size ?? 2) / 2)
    for (let i = b.i - radius; i <= b.i + radius; i++)
      for (let j = b.j - radius; j <= b.j + radius; j++) occupied.add(`${i}:${j}`)
  }
  const root = p.buildings.find(b => b.type === 'TownCenter')
  const start = { i: root.i - 3, j: root.j - 3 }
  const visited = new Set([`${start.i}:${start.j}`]),
    queue = [start]
  for (const point of queue)
    for (const [di, dj] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const next = { i: point.i + di, j: point.j + dj },
        key = `${next.i}:${next.j}`
      if (!terrain[next.i]?.[next.j] || visited.has(key) || occupied.has(key)) continue
      visited.add(key)
      queue.push(next)
    }
  assert.ok(
    queue.some(point => point.i === 0 || point.j === 0),
    'village keeps an exit through its walls'
  )
  for (const b of p.buildings.filter(b => b.type !== 'SmallWall')) {
    const radius = Math.ceil((b.size ?? buildings[b.type]?.size ?? 2) / 2) + 1
    assert.ok(
      queue.some(point => Math.max(Math.abs(point.i - b.i), Math.abs(point.j - b.j)) <= radius),
      `${b.type} remains accessible`
    )
  }
})
