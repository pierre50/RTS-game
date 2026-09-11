const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { advanceCampaignEconomy, encodeEconomyTerrain, materializeInitialEconomy } = loadTsModule(
  'app/services/world/WorldEconomy.ts'
)
const { villageBuildingNeeds } = loadTsModule('app/ai/AIDevelopmentPolicy.ts')
const buildings = require('../public/assets/data/gameplay/buildings.json')
const units = require('../public/assets/data/gameplay/units.json')
const DAY = 1440000

function fixture(difficulty = 'medium') {
  const state = {
    config: { difficulty },
    world: { worldRegionId: 'away', size: 50 },
    runtime: { dayNightElapsedMs: 0 },
    resources: [],
    animals: [],
    players: [
      {
        type: 'AI',
        label: 'ai',
        factionId: 'faction',
        age: 0,
        population: 5,
        populationMax: 10,
        units: [
          ...Array.from({ length: 4 }, (_, i) => ({
            type: 'Villager',
            label: `worker-${i}`,
            i: 25 + i,
            j: 25,
            hitPoints: 18,
          })),
          { type: 'Chief', label: 'chief', i: 24, j: 25, hitPoints: 45 },
        ],
        buildings: [
          {
            type: 'TownCenter',
            label: 'home',
            i: 20,
            j: 20,
            isBuilt: true,
            size: 3,
            inventory: { resources: { wood: 200, wheat: 200, stone: 150 } },
          },
        ],
      },
    ],
  }
  const terrain = Array.from({ length: 51 }, () => Array.from({ length: 51 }, () => ({ category: 'Land' })))
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
  const rules = () => ({
    abstractVillages: true,
    planBuildings: true,
    buildingConfig: (_i, type) => buildings[type] ?? {},
    unitConfig: (_i, type) => units[type] ?? {},
    buildingCapacity: (_i, type) => buildings[type]?.increasePopulation ?? 0,
    cycleMs: () => 1000,
    wheatMatureFrame: 5,
  })
  return { campaign, rules }
}

test('J1, J5 and J10 villages develop without leather nodes or detailed harvesting', () => {
  const { campaign, rules } = fixture()
  const stages = []
  for (const day of [1, 5, 10]) {
    advanceCampaignEconomy(campaign, day * DAY, 'here', rules)
    const state = campaign.economy.regions.away.initialState
    stages.push(state.players[0].buildings.filter(b => b.isBuilt).length)
    assert.equal(state.resources.length, 0)
  }
  assert.ok(stages[1] > stages[0], JSON.stringify(stages))
  assert.ok(stages[2] > stages[1], JSON.stringify(stages))
  const state = campaign.economy.regions.away.initialState
  assert.ok(state.players[0].buildings.some(b => b.type === 'Granary' && b.isBuilt))
  assert.ok(state.players[0].populationMax > 10)
  const arrived = materializeInitialEconomy(
    { ...state, players: [{ isPlayed: true }, { factionId: 'faction' }] },
    state,
    DAY * 10
  )
  assert.deepEqual(arrived.players[1], state.players[0])
})

test('daily runs and catch-up preserve stock totals and training identities through reload', () => {
  const { campaign, rules } = fixture('hard')
  const daily = structuredClone(campaign)
  advanceCampaignEconomy(campaign, 15 * DAY, 'here', rules)
  for (let day = 1; day <= 15; day++) advanceCampaignEconomy(daily, day * DAY, 'here', rules)
  const summary = campaign.economy.regions.away.summaries.faction
  assert.deepEqual(daily.economy.regions.away.summaries, campaign.economy.regions.away.summaries)
  assert.ok((summary.military.Fantassin ?? 0) > 0, JSON.stringify(summary))
  const restored = JSON.parse(JSON.stringify(campaign))
  const before = structuredClone(restored)
  advanceCampaignEconomy(restored, 15 * DAY, 'here', rules)
  assert.deepEqual(restored, before)
  const player = restored.economy.regions.away.initialState.players[0]
  const labels = [
    ...player.units.map(u => u.label),
    ...player.buildings.flatMap(b => b.trainingQueue ?? []).map(e => e.trainee.label),
  ]
  assert.equal(new Set(labels).size, labels.length)
  assert.equal(player.population, labels.length)
})

test('active regions and human settlements do not receive abstract supplies', () => {
  const { campaign, rules } = fixture()
  const before = structuredClone(campaign)
  advanceCampaignEconomy(campaign, DAY, 'away', rules)
  assert.deepEqual(campaign, before)
  campaign.economy.regions.away.initialState.players[0].type = 'Human'
  advanceCampaignEconomy(campaign, DAY, 'here', rules)
  const player = campaign.economy.regions.away.initialState.players[0]
  assert.equal(player.abstractProductionRemainder, undefined)
  assert.equal(player.buildings[0].inventory.resources.wood, 200)
})

test('shared building policy does not reserve a second house or a premature market', () => {
  const input = { population: 9, populationMax: 10, age: 0, phase: 'economy', desiredBarracks: 0, buildings: [] }
  assert.equal(villageBuildingNeeds(input).House, true)
  assert.equal(villageBuildingNeeds(input).Market, false)
  input.buildings.push({ type: 'House', isBuilt: false })
  assert.equal(villageBuildingNeeds(input).House, false)
})
