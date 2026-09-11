const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { planOfflineBuildings, restoreOfflineBuilders } = loadTsModule(
  'app/services/world/OfflineWorldBuildingPlanner.ts'
)
const { advanceCampaignEconomy, encodeEconomyTerrain, materializeInitialEconomy } = loadTsModule(
  'app/services/world/WorldEconomy.ts'
)
const DAY = 1440000
const realBuildings = require('../public/assets/data/gameplay/buildings.json')

function fixture() {
  const player = {
    type: 'AI',
    label: 'ai',
    factionId: 'civ-hellas',
    age: 0,
    population: 5,
    populationMax: 10,
    units: Array.from({ length: 4 }, (_, i) => ({
      type: 'Villager',
      label: `worker-${i}`,
      i: 15 + i,
      j: 15,
      autonomousJob: i ? 'food' : 'wood',
    })),
    buildings: [
      {
        type: 'TownCenter',
        label: 'center',
        i: 12,
        j: 12,
        isBuilt: true,
        inventory: { resources: { wood: 1000, wheat: 1000, stone: 500 } },
      },
    ],
  }
  const state = {
    config: { difficulty: 'medium' },
    world: { worldRegionId: 'away', size: 40 },
    runtime: { dayNightElapsedMs: 0 },
    players: [player],
    resources: [{ type: 'Tree', label: 'tree', i: 20, j: 20, quantity: 10000, hitPoints: 0 }],
    animals: [],
  }
  const terrain = Array.from({ length: 41 }, () => Array.from({ length: 41 }, () => ({ category: 'Land' })))
  const rules = {
    planBuildings: true,
    unitConfig: () => ({ speed: 1.5, gatherAmount: { woodcutter: 1 } }),
    buildingConfig: () => ({ size: 2, totalHitPoints: 96, constructionTime: 48, cost: { wood: 50 } }),
    buildingCapacity: (_index, type) => (type === 'House' ? 5 : 0),
    cycleMs: () => 1000,
    wheatMatureFrame: 5,
  }
  const campaign = {
    currentWorldId: 'here',
    worlds: {},
    economy: {
      version: 1,
      regions: {
        away: {
          regionId: 'away',
          initialState: state,
          terrain: encodeEconomyTerrain(terrain),
          summaries: {},
          simulatedUntilMs: 0,
        },
      },
    },
  }
  return { player, state, terrain, rules, campaign }
}

test('four days launch and finish real buildings before the first visit', () => {
  const { campaign, rules } = fixture()
  advanceCampaignEconomy(campaign, 4 * DAY, 'here', () => rules)
  const state = campaign.economy.regions.away.initialState
  const buildings = state.players[0].buildings
  for (const type of ['StoragePit', 'Granary', 'Market'])
    assert.ok(
      buildings.some(b => b.type === type && b.isBuilt),
      type
    )
  const generated = {
    ...structuredClone(state),
    players: [
      { isPlayed: true, label: 'hero', units: [] },
      { factionId: 'civ-hellas', buildings: [] },
    ],
  }
  const arrived = materializeInitialEconomy(generated, state, 4 * DAY)
  assert.deepEqual(arrived.players.find(p => p.factionId === 'civ-hellas').buildings, buildings)
  assert.equal(new Set(buildings.map(b => b.label)).size, buildings.length)
})

test('actual building costs allow funded infrastructure and expose missing leather instead of inventing it', () => {
  for (const leather of [0, 100]) {
    const { campaign, player, rules } = fixture()
    player.buildings[0].inventory.resources.leather = leather
    rules.buildingConfig = (_index, type) => realBuildings[type] ?? {}
    advanceCampaignEconomy(campaign, 4 * DAY, 'here', () => rules)
    const region = campaign.economy.regions.away
    const saved = region.initialState.players[0]
    assert.ok(saved.buildings.some(b => b.type === 'StoragePit' && b.isBuilt))
    if (leather) assert.ok(saved.buildings.some(b => b.type === 'Granary' && b.isBuilt))
    else {
      assert.equal(saved.buildings.some(b => b.type === 'Granary'), false)
      assert.match(region.summaries['civ-hellas'].constructionDecision, /leather/)
    }
  }
})

test('daily ticks, batched catch-up and JSON reload produce the same projects and costs', () => {
  const { campaign, rules } = fixture()
  const daily = structuredClone(campaign)
  advanceCampaignEconomy(campaign, 4 * DAY, 'here', () => rules)
  for (let day = 1; day <= 4; day++) advanceCampaignEconomy(daily, day * DAY, 'here', () => rules)
  assert.deepEqual(daily, campaign)
  const reloaded = JSON.parse(JSON.stringify(daily))
  advanceCampaignEconomy(reloaded, 4 * DAY, 'here', () => rules)
  assert.deepEqual(reloaded, JSON.parse(JSON.stringify(daily)))
})

test('one paid project per day borrows a worker and restores their job at completion', () => {
  const { player, state, terrain, rules } = fixture()
  planOfflineBuildings(state, 1, terrain, rules)
  assert.equal(player.buildings.length, 2)
  assert.equal(player.buildings[0].inventory.resources.wood, 950)
  const worker = player.units.find(unit => unit.offlineBuilderJob)
  assert.equal(worker.autonomousJob, 'construction')
  planOfflineBuildings(state, 1, terrain, rules)
  assert.equal(player.buildings.length, 2)
  player.buildings[1].isBuilt = true
  restoreOfflineBuilders(state)
  assert.equal(worker.autonomousJob, 'wood')
  assert.equal(worker.offlineBuilderJob, undefined)
})

test('invalid terrain, insufficient stocks, unmet conditions and human owners cannot buy a building', () => {
  for (const reason of ['terrain', 'stocks', 'conditions', 'human']) {
    const { player, state, terrain, rules } = fixture()
    if (reason === 'terrain') terrain.forEach(row => row.fill(null))
    if (reason === 'stocks') player.buildings[0].inventory.resources.wood = 0
    if (reason === 'conditions')
      rules.buildingConfig = () => ({
        size: 2,
        totalHitPoints: 96,
        constructionTime: 48,
        cost: { wood: 50 },
        conditions: [{ op: '>=', key: 'age', value: 5 }],
      })
    if (reason === 'human') player.type = 'Human'
    const before = structuredClone(player.buildings[0].inventory.resources)
    planOfflineBuildings(state, 1, terrain, rules)
    assert.equal(player.buildings.length, 1, reason)
    assert.deepEqual(player.buildings[0].inventory.resources, before)
  }
})
