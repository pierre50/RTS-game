const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { applyVillageStartingState, villageStartProfiles, placeStartingHeroInVillage } = loadTsModule(
  'app/services/world/VillageStartingState.ts'
)
const { getPlayerResourceTotals } = loadTsModule('app/lib/resources/playerResourceTotals.ts')
const { savedResourceOwner } = loadTsModule('app/services/world/OfflineWorldWork.ts')
const { materializeInitialEconomy } = loadTsModule('app/services/world/WorldEconomy.ts')
const buildings = require('../public/assets/data/gameplay/buildings.json')
const units = require('../public/assets/data/gameplay/units.json')

test('civilization profiles leave neutral and bandit owners unchanged even when they use the same civilization', () => {
  const { state, terrain, rules } = fixture()
  const specialOwners = ['Gaia', 'Bandits'].map(type => ({
    type, civ: 'Hellas', label: type, units: [], buildings: [],
  }))
  state.players.push(...specialOwners)
  const result = applyVillageStartingState(state, {
    Hellas: { age: 0, buildings: { Granary: 1 }, units: {} },
  }, terrain, rules)
  assert.ok(result.players[0].buildings.some(b => b.type === 'Granary'))
  assert.deepEqual(result.players.slice(-2), specialOwners)
})

function fixture() {
  const state = {
    camera: { x: 0, y: 0 },
    runtime: { dayNightElapsedMs: 0 },
    resources: [],
    animals: [],
    players: [
      {
        type: 'AI',
        civ: 'Hellas',
        label: 'ai',
        factionId: 'civ-hellas',
        age: 0,
        population: 1,
        populationMax: 10,
        units: [{ type: 'Chief', label: 'chief', i: 27, j: 27, hitPoints: 45 }],
        buildings: [
          {
            type: 'TownCenter',
            label: 'center',
            i: 25,
            j: 25,
            isBuilt: true,
            hitPoints: 100,
            inventory: { resources: { wood: 200, wheat: 200 } },
          },
        ],
      },
      {
        type: 'Human',
        civ: 'Xia',
        isPlayed: true,
        label: 'human',
        factionId: 'civ-xia',
        units: [{ type: 'Hero', label: 'hero', i: 1, j: 1, hitPoints: 45 }],
        buildings: [],
      },
    ],
  }
  const terrain = Array.from({ length: 61 }, () => Array.from({ length: 61 }, () => ({ category: 'Land' })))
  const rules = {
    buildingConfig: (_i, type) => buildings[type] ?? {},
    unitConfig: (_i, type) => units[type] ?? {},
    wheatMatureFrame: 3,
    buildingCapacity: (_i, type) => buildings[type]?.shelterCapacity ?? buildings[type]?.increasePopulation ?? 0,
  }
  return { state, terrain, rules }
}
test('tutorial profile produces deterministic saved entities and physical stocks without advancing time', () => {
  const { state, terrain, rules } = fixture()
  const before = structuredClone(state)
  const profiles = {
    Hellas: {
      age: 0,
      buildings: { StoragePit: 1, Granary: 1, Barracks: 1 },
      units: { Villager: 10, Fantassin: 3 },
      resourceBonus: { wood: 500, food: 60 },
    },
  }
  const result = applyVillageStartingState(state, profiles, terrain, rules)
  assert.deepEqual(result, applyVillageStartingState(state, profiles, terrain, rules))
  assert.deepEqual(state, before)
  assert.deepEqual(result.runtime, state.runtime)
  const player = result.players[0]
  assert.equal(player.population, 14)
  assert.ok(player.populationMax >= player.population)
  assert.equal(player.units.filter(u => u.type === 'Villager').length, 10)
  assert.ok(player.buildings.some(b => b.type === 'House'))
  assert.equal(getPlayerResourceTotals(savedResourceOwner(player, result.players)).wood, 700)
  assert.equal(getPlayerResourceTotals(savedResourceOwner(player, result.players)).food, 260)
  const arrived = materializeInitialEconomy(state, { ...result, players: [player] }, 0)
  assert.deepEqual(
    arrived.players.find(p => p.type === 'AI'),
    player
  )
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result)
})
test('legacy levels use shared targets, including level three, and explicit profiles override them', () => {
  for (const level of [1, 2, 3]) {
    const profiles = villageStartProfiles({ players: [{ civ: 'Hellas', civilizationLevel: level }] })
    const { state, terrain, rules } = fixture()
    const result = applyVillageStartingState(state, profiles, terrain, rules)
    assert.equal(result.players[0].age, Math.min(2, level))
    assert.ok(result.players[0].units.some(u => u.type === 'Bowman'))
  }
  const explicit = { age: 0, buildings: {}, units: { Villager: 4 } }
  assert.deepEqual(
    villageStartProfiles({ players: [{ civ: 'Hellas', civilizationLevel: 3 }], villageStarts: { Hellas: explicit } })
      .Hellas,
    explicit
  )
})
test('hero arrival changes position but not city ownership or hero inventory', () => {
  const { state, terrain, rules } = fixture()
  const host = structuredClone(state.players[0])
  const hero = state.players[1].units[0]
  hero.inventory = { resources: { wood: 3 } }
  placeStartingHeroInVillage(state, 'Hellas', terrain, rules)
  assert.ok(Math.hypot(hero.i - 25, hero.j - 25) < 8)
  assert.deepEqual(state.players[0], host)
  assert.equal(hero.inventory.resources.wood, 3)
  assert.throws(() => placeStartingHeroInVillage(state, 'missing', terrain, rules))
})
test('impossible required buildings fail without partially modifying the source', () => {
  const { state, rules } = fixture()
  const before = structuredClone(state)
  assert.throws(
    () => applyVillageStartingState(state, { Hellas: { age: 0, buildings: { Barracks: 1 }, units: {} } }, [], rules),
    /No space/
  )
  assert.deepEqual(state, before)
})

test('fresh campaign boot restores profiles once and forwards them to remote village initialization', async () => {
  const { state, terrain, rules } = fixture()
  const context = { players: [], player: null }
  let restored = 0
  let remoteProfiles
  let requestedCivilization
  const { bootGameFromConfig } = loadTsModule('app/screens/game/GameWorldBoot.ts', {
    mocks: {
      '../../services/world/WorldEconomyRuntime': {
        economyRulesFor: () => rules,
        initializeCampaignEconomy: async (_campaign, _context, _load, profiles) => {
          remoteProfiles = profiles
        },
      },
      '../../classes/players/GaiaPlayer': {
        ensureNeutralPlayer(context) {
          context.players.push({ type: 'Gaia', label: 'neutral', civ: 'Hellas', units: [], buildings: [] })
        },
      },
      '../../lib/lpc': { preloadBakedLpcUnitsForPlayers: async () => {} },
      '../../serialization/SaveSerializer': {
        serializeGame: () => ({ ...structuredClone(state), players: structuredClone(context.players) }),
      },
      '../../serialization/CampaignSave': {
        createInitialCampaignSave: saved => ({ currentWorldId: 'root', worlds: { root: { state: saved } } }),
      },
      './GameStateHelpers': { ensureCampaignPlayerRoster: value => value, savedRuntimeState: value => value },
      './GameMapBlueprintRuntime': { recordLoadedMapBlueprint() {} },
      './WorldRegionPlayers': {
        humanPlayerConfig: () => ({ civ: 'Xia' }),
        buildWorldRegionPlayerConfigs: () => [],
        selectActivePlayer: players => players.find(p => p.isPlayed),
      },
    },
  })
  const map = {
    size: 60,
    grid: terrain,
    startingResources: { wood: 200, food: 200, stone: 150 },
    generateFromBlueprint: async () => {},
    generatePlayers: () =>
      structuredClone(state.players).map(p => ({
        ...p,
        i: p.isPlayed ? 1 : 25,
        j: p.isPlayed ? 1 : 25,
        units: [],
        buildings: [],
      })),
    stylishMap: async options => {
      if (!restored) {
        assert.equal(options.deferPlayerPlacement, true)
        assert.ok(context.players.every(p => !p.units.length && !p.buildings.length))
      }
    },
    mapGeneration: {
      applySavedStateToGeneratedMap(saved) {
        restored++
        context.players = saved.players
        context.player = saved.players.find(p => p.isPlayed)
      },
    },
  }
  const game = {
    context,
    _map: () => map,
    _gameContext: () => context,
    _createRuntime() {},
    _createUiRuntime() {},
    _applyMapConfig: (target, config) => Object.assign(target, config),
    _loadRequiredWorldMapBlueprint: async options => {
      requestedCivilization = options.playerCiv
      return {}
    },
    _updateLoading: async () => {},
    _mountRuntime() {},
    _autosaveCampaign() {},
  }
  const profile = { age: 0, buildings: { Granary: 1 }, units: { Villager: 4 }, resourceBonus: { wood: 100 } }
  await bootGameFromConfig(game, { heroStartVillage: 'Hellas', villageStarts: { Hellas: profile } })
  assert.equal(requestedCivilization, 'Hellas')
  assert.equal(restored, 1)
  assert.deepEqual(context.players.find(p => p.label === 'neutral').buildings, [])
  assert.deepEqual(remoteProfiles, { Hellas: profile })
  assert.ok(game._campaignSave.worlds.root.state.players[0].buildings.some(b => b.type === 'Granary'))
  assert.equal(game._campaignSave.worlds.root.state.runtime.dayNightElapsedMs, 0)
  await bootGameFromConfig(game, { villageStarts: { Hellas: profile } })
  assert.equal(restored, 1, 'later region boots must not reapply starting grants')
})

test('new tutorial configuration reuses village generation with one chief and working villagers', () => {
  const { tutorialVillageConfig } = loadTsModule('app/services/tutorial/TutorialVillage.ts')
  const original = { heroOnlyStart: true, players: [{ civ: 'Hellas', isHuman: true }] }
  const config = tutorialVillageConfig(original)
  assert.equal(original.heroOnlyStart, true)
  assert.equal(config.heroOnlyStart, true)
  assert.equal(config.heroStartVillage, 'Hellas')
  const { state, terrain, rules } = fixture()
  state.players = [state.players[0]]
  state.players[0].isPlayed = false
  state.players[0].type = 'AI'
  state.players[0].units = []
  state.players.push({ type: 'Human', isPlayed: true, civ: 'Hellas', label: 'guest', buildings: [], units: [{ type: 'Hero', label: 'hero', i: 27, j: 27, hitPoints: 45 }] })
  const generated = applyVillageStartingState(state, villageStartProfiles(config), terrain, rules, { skipPlayed: true })
  assert.deepEqual(generated.players[1], state.players[1])
  const village = generated.players[0]
  assert.equal(generated.resources.filter(r => r.type === 'Wheat').length, 80)
  const center = village.buildings.find(b => b.type === 'TownCenter')
  assert.ok(
    generated.resources
      .filter(r => r.type === 'Wheat')
      .every(r => Math.max(Math.abs(r.i - center.i), Math.abs(r.j - center.j)) <= 20),
    'fields stay in a nearby agricultural district'
  )
  assert.ok(
    generated.resources.filter(r => r.type === 'Wheat').every(r => r.quantity > 0 && r.currentFrame === undefined)
  )
  assert.equal(village.units.filter(u => u.type === 'Hero').length, 0)
  assert.equal(village.units.filter(u => u.type === 'Chief').length, 1)
  assert.equal(village.units.filter(u => u.type === 'Villager').length, 12)
  assert.equal(village.units.filter(u => u.type === 'Fantassin').length, 4)
  assert.ok(village.units.filter(u => u.type === 'Villager').every(u => u.autonomousJob))
  assert.ok(village.buildings.filter(b => b.type === 'House').length >= 6)
  for (const [type, count] of Object.entries(config.villageStarts.Hellas.buildings)) {
    assert.ok(village.buildings.filter(b => b.type === type && b.isBuilt).length >= count, type)
  }
})

test('starting buildings stay compact and relocate resources without losing their quantities', () => {
  const { state, terrain, rules } = fixture()
  for (let i = 0; i <= 60; i++) {
    for (let j = 0; j <= 60; j++) {
      const ring = Math.max(Math.abs(i - 25), Math.abs(j - 25))
      if (ring <= 3 || ring > 20) continue
      state.resources.push({
        type: (i + j) % 3 === 0 ? 'Stone' : 'Tree',
        label: `resource:${i}:${j}`,
        i,
        j,
        quantity: 200,
      })
    }
  }
  const before = state.resources.length
  const generated = applyVillageStartingState(
    state,
    { Hellas: { age: 0, buildings: { Barracks: 1 }, units: {} } },
    terrain,
    rules
  )
  const barracks = generated.players[0].buildings.find(b => b.type === 'Barracks')
  assert.ok(barracks)
  assert.equal(generated.resources.length, before)
  assert.equal(
    generated.resources.reduce((sum, r) => sum + r.quantity, 0),
    before * 200
  )
  assert.ok(Math.max(Math.abs(barracks.i - 25), Math.abs(barracks.j - 25)) < 15)
  assert.equal(new Set(generated.resources.map(r => `${r.i}:${r.j}`)).size, before)
  assert.equal(state.resources.length, before)
  const radius = Math.floor((barracks.size - 1) / 2) + 1
  assert.ok(generated.resources.every(r => Math.abs(r.i - barracks.i) > radius || Math.abs(r.j - barracks.j) > radius))
})
