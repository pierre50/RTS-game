const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { advanceCampaignEconomy, captureEconomyRegion, encodeEconomyTerrain, economyAfterWorldSave } = loadTsModule(
  'app/services/world/WorldEconomy.ts'
)
const DAY = 1440000
const { materializeInitialEconomy } = loadTsModule('app/services/world/WorldEconomy.ts')
const { validateWorldEconomy } = loadTsModule('app/serialization/WorldEconomyValidation.ts')
const { worldEconomyFactors } = loadTsModule('app/config/worldEconomyBalance.ts')
const rules = () => ({
  unitConfig: () => ({ speed: 1.5, totalHitPoints: 18, gatherAmount: { woodcutter: 1, forager: 1 } }),
  buildingConfig: () => ({ size: 2, constructionTime: 48, totalHitPoints: 96 }),
  buildingCapacity: (_i, type) => (type === 'House' ? 5 : 0),
  cycleMs: () => 1000,
  wheatMatureFrame: 5,
})

test('daily random factors remain identical across daily ticks, catch-up and reload', () => {
  const { campaign } = fixture()
  const daily = structuredClone(campaign)
  const catchup = structuredClone(campaign)
  const variedRules = () => ({ ...rules(), dailyFactors: (_index, day) => worldEconomyFactors('easy', 'faction', day) })
  for (let day = 1; day <= 3; day++) advanceCampaignEconomy(daily, day * DAY, undefined, variedRules)
  advanceCampaignEconomy(catchup, 3 * DAY, undefined, variedRules)
  assert.deepEqual(daily, catchup)
  const reloaded = JSON.parse(JSON.stringify(daily))
  advanceCampaignEconomy(reloaded, 3 * DAY, undefined, variedRules)
  assert.deepEqual(reloaded, JSON.parse(JSON.stringify(daily)))
})

function fixture() {
  const state = {
    camera: { x: 0, y: 0 },
    world: { worldRegionId: 'remote', size: 30 },
    runtime: { dayNightElapsedMs: 0 },
    animals: [],
    resources: [{ type: 'Tree', label: 'tree', i: 10, j: 12, quantity: 1000, totalQuantity: 1000 }],
    players: [
      {
        type: 'AI',
        factionId: 'faction',
        label: 'ai',
        population: 1,
        populationMax: 10,
        units: [{ type: 'Villager', label: 'worker', i: 10, j: 10, autonomousJob: 'wood' }],
        buildings: [
          { type: 'TownCenter', label: 'center', i: 6, j: 6, isBuilt: true, inventory: { resources: { wheat: 200 } } },
        ],
      },
    ],
  }
  const terrain = Array.from({ length: 31 }, () => Array.from({ length: 31 }, () => ({ category: 'Land' })))
  const region = {
    regionId: 'remote',
    terrain: encodeEconomyTerrain(terrain),
    simulatedUntilMs: 0,
    initialState: state,
    summaries: {},
  }
  const campaign = { currentWorldId: 'home', worlds: {}, economy: { version: 1, regions: { remote: region } } }
  return { campaign, region, state, terrain }
}

test('unvisited AI produces, consumes and receives villagers without loading a runtime map', () => {
  const { campaign, region } = fixture()
  advanceCampaignEconomy(campaign, DAY, 'home', rules)
  assert.equal(region.simulatedUntilMs, DAY)
  assert.ok(region.summaries.faction.stocks.wood > 0)
  assert.ok(region.summaries.faction.stocks.food < 200)
  assert.ok(region.summaries.faction.population > 1)
  assert.equal(campaign.worlds.remote, undefined)
})

test('duplicate daily events, save/reload and backwards clocks do not replay production', () => {
  const { campaign } = fixture()
  advanceCampaignEconomy(campaign, DAY, 'home', rules)
  const saved = JSON.parse(JSON.stringify(campaign))
  const copy = structuredClone(saved)
  advanceCampaignEconomy(copy, DAY, 'home', rules)
  advanceCampaignEconomy(copy, 0, 'home', rules)
  assert.deepEqual(copy, saved)
})

test('missed days match daily ticks and partial arrival catch-up', () => {
  const { campaign } = fixture()
  const daily = structuredClone(campaign)
  advanceCampaignEconomy(campaign, DAY * 3 + 30000, 'home', rules)
  for (let day = 1; day <= 3; day++) advanceCampaignEconomy(daily, DAY * day, 'home', rules)
  advanceCampaignEconomy(daily, DAY * 3 + 30000, 'home', rules)
  assert.deepEqual(campaign, daily)
})

test('active region is not simulated; real departure state replaces its abstract snapshot', () => {
  const { campaign, state, terrain } = fixture()
  const before = structuredClone(state)
  advanceCampaignEconomy(campaign, DAY, 'remote', rules)
  assert.deepEqual(state, before)
  campaign.currentWorldId = 'visited'
  campaign.worlds.visited = { id: 'visited', state }
  const real = structuredClone(state)
  real.runtime.dayNightElapsedMs = DAY / 2
  real.players[0].buildings[0].inventory.resources.wheat = 17
  captureEconomyRegion(campaign, real, terrain)
  assert.equal(campaign.economy.regions.remote.initialState, undefined)
  assert.equal(campaign.economy.regions.remote.worldId, 'visited')
  assert.equal(campaign.worlds.visited.state, real)
  assert.equal(campaign.economy.regions.remote.simulatedUntilMs, DAY / 2)
  const updated = structuredClone(real)
  updated.runtime.dayNightElapsedMs = DAY
  const next = economyAfterWorldSave(campaign, 'visited', updated)
  assert.equal(next.regions.remote.simulatedUntilMs, DAY)
  assert.equal(campaign.economy.regions.remote.simulatedUntilMs, DAY / 2)
})

test('paid construction and concurrent training finish once with persistent identities', () => {
  const { campaign, region, state } = fixture()
  const player = state.players[0]
  player.units[0].autonomousJob = 'construction'
  player.buildings.push({
    type: 'House',
    label: 'house',
    i: 12,
    j: 8,
    isBuilt: false,
    hitPoints: 1,
    totalHitPoints: 96,
  })
  player.buildings[0].trainingQueue = ['Infantry', 'Bowman'].map((type, index) => ({
    type,
    trainee: { label: `trainee-${index}` },
    trainingStartedDay: 1,
    trainingCompleteDay: 2,
  }))
  advanceCampaignEconomy(campaign, DAY, 'home', rules)
  const result = region.initialState.players[0]
  assert.equal(result.buildings.find(b => b.label === 'house').isBuilt, true)
  assert.equal(result.buildings[0].trainingQueue.length, 0)
  assert.equal(result.units.filter(u => u.label.startsWith('trainee-')).length, 2)
  assert.equal(region.summaries.faction.military.Infantry, 1)
  const copy = structuredClone(campaign)
  advanceCampaignEconomy(campaign, DAY, 'home', rules)
  assert.deepEqual(campaign, copy)
})

test('a failed region update is not partially committed', () => {
  const { campaign } = fixture()
  const before = structuredClone(campaign)
  assert.throws(() =>
    advanceCampaignEconomy(campaign, DAY, 'home', () => {
      throw new Error('rules')
    })
  )
  assert.deepEqual(campaign, before)
})

test('first arrival materializes evolved AI only and keeps the hero, other owners and fauna', () => {
  const { campaign, region } = fixture()
  advanceCampaignEconomy(campaign, DAY, 'home', rules)
  const generated = {
    players: [
      { isPlayed: true, label: 'hero-player' },
      { factionId: 'faction', label: 'fresh-ai' },
      { type: 'Bandits' },
    ],
    animals: [{ type: 'Deer' }],
    resources: [],
    camera: { x: 7, y: 8 },
    runtime: { offlineFromElapsedMs: 0 },
  }
  const result = materializeInitialEconomy(generated, region.initialState, DAY)
  assert.equal(result.players.length, 3)
  assert.equal(result.players[0].label, 'hero-player')
  assert.equal(result.players[1].type, 'Bandits')
  assert.equal(result.players[2].population, region.summaries.faction.population)
  assert.deepEqual(result.animals, generated.animals)
  assert.equal(result.runtime.offlineFromElapsedMs, undefined)
  assert.equal(result.runtime.dayNightElapsedMs, DAY)
  assert.notEqual(result.players[2], region.initialState.players[0])
  assert.equal(generated.players[1].label, 'fresh-ai')
})

test('abstract snapshots validate without a human or a full fog grid; corrupt metadata is rejected', () => {
  const { campaign, state } = fixture()
  state.world.seed = 4242
  state.players[0].isPlayed = false
  const config = { resources: { Tree: {} }, units: { Villager: {} }, buildings: { TownCenter: {} } }
  assert.doesNotThrow(() => validateWorldEconomy(campaign, config))
  const invalid = structuredClone(campaign)
  invalid.economy.regions.remote.simulatedUntilMs = -1
  assert.throws(() => validateWorldEconomy(invalid, config), /economy region/)
  invalid.economy.regions.remote.simulatedUntilMs = 0
  invalid.economy.regions.remote.worldId = 'missing'
  assert.throws(() => validateWorldEconomy(invalid, config), /world reference/)
})
