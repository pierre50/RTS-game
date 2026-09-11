const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { economyReport } = loadTsModule('app/dev-console/actions/economy.ts')

function fixture() {
  const summary = {
    population: 6,
    populationMax: 10,
    stocks: { wood: 300 },
    military: { Chief: 1 },
    buildings: { TownCenter: 1 },
    constructionProjects: 2,
    trainingProjects: 3,
  }
  const economy = {
    regions: {
      home: { regionId: 'home', worldId: 'world-home', simulatedUntilMs: 0, summaries: { 'civ-nord': summary } },
      away: { regionId: 'away', simulatedUntilMs: 1440000, summaries: { 'civ-hellas': summary } },
    },
  }
  return {
    players: [
      {
        factionId: 'civ-nord',
        civ: 'Nord',
        population: 5,
        populationMax: 10,
        units: [],
        buildings: [{ type: 'TownCenter', isBuilt: true, inventory: { resources: { wood: 123 } } }],
      },
    ],
    getCampaignEconomy: () => economy,
    getCampaignFactions: () => ({ 'civ-hellas': { civilization: 'Hellas' } }),
    getCurrentWorldId: () => 'world-home',
    dayNight: { getElapsedMs: () => 2160000 },
  }
}

test('economy uses live stores for active players and excludes stale active summaries', () => {
  const rows = JSON.parse(economyReport(['--json'], fixture()).message)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].stocks.wood, 123)
  assert.equal(rows[0].population, 5)
  assert.equal(rows[0].mode, 'live')
  assert.equal(rows[1].trainingProjects, 3)
})

test('economy filters case-insensitively and reports pending simulation without mutating data', () => {
  const context = fixture()
  const before = JSON.stringify(context.getCampaignEconomy())
  const result = economyReport(['HELLAS'], context)
  assert.equal(result.ok, true)
  assert.match(result.message, /offscreen \/ unvisited/)
  assert.match(result.message, /pending: 0.50 days/)
  assert.doesNotMatch(result.message, /Nord/)
  assert.equal(JSON.stringify(context.getCampaignEconomy()), before)
  assert.equal(economyReport(['unknown'], context).ok, false)
  assert.equal(economyReport(['one', 'two'], context).ok, false)
})

test('economy remains usable without a campaign', () => {
  const context = fixture()
  delete context.getCampaignEconomy
  assert.equal(economyReport([], context).ok, true)
  context.players = []
  assert.equal(economyReport([], context).ok, false)
})
