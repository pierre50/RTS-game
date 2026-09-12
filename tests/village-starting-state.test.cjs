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
  const { bootGameFromConfig } = loadTsModule('app/screens/game/GameWorldBoot.ts', { mocks: {
    '../../services/world/WorldEconomyRuntime': {
      economyRulesFor: () => rules,
      initializeCampaignEconomy: async (_campaign, _context, _load, profiles) => { remoteProfiles = profiles },
    },
    '../../classes/players/GaiaPlayer': { ensureNeutralPlayer() {} },
    '../../lib/lpc': { preloadBakedLpcUnitsForPlayers: async () => {} },
    '../../serialization/SaveSerializer': { serializeGame: () => ({ ...structuredClone(state), players: structuredClone(context.players) }) },
    '../../serialization/CampaignSave': { createInitialCampaignSave: saved => ({ currentWorldId: 'root', worlds: { root: { state: saved } } }) },
    './GameStateHelpers': { ensureCampaignPlayerRoster: value => value, savedRuntimeState: value => value },
    './GameMapBlueprintRuntime': { recordLoadedMapBlueprint() {} },
    './WorldRegionPlayers': { humanPlayerConfig: () => ({ civ: 'Xia' }), buildWorldRegionPlayerConfigs: () => [], selectActivePlayer: players => players.find(p => p.isPlayed) },
  } })
  const map = { size: 60, grid: terrain,
    startingResources: { wood: 200, food: 200, stone: 150 },
    generateFromBlueprint: async () => {},
    generatePlayers: () => structuredClone(state.players).map(p => ({ ...p, i: p.isPlayed ? 1 : 25, j: p.isPlayed ? 1 : 25, units: [], buildings: [] })),
    stylishMap: async options => {
      if (!restored) {
        assert.equal(options.deferPlayerPlacement, true)
        assert.ok(context.players.every(p => !p.units.length && !p.buildings.length))
      }
    },
    mapGeneration: { applySavedStateToGeneratedMap(saved) { restored++; context.players = saved.players; context.player = saved.players.find(p => p.isPlayed) } },
  }
  const game = { context, _map: () => map, _gameContext: () => context, _createRuntime() {}, _createUiRuntime() {},
    _applyMapConfig: (target, config) => Object.assign(target, config),
    _loadRequiredWorldMapBlueprint: async options => { requestedCivilization = options.playerCiv; return {} },
    _updateLoading: async () => {}, _mountRuntime() {}, _autosaveCampaign() {},
  }
  const profile = { age: 0, buildings: { Granary: 1 }, units: { Villager: 4 }, resourceBonus: { wood: 100 } }
  await bootGameFromConfig(game, { heroStartVillage: 'Hellas', villageStarts: { Hellas: profile } })
  assert.equal(requestedCivilization, 'Hellas')
  assert.equal(restored, 1)
  assert.deepEqual(remoteProfiles, { Hellas: profile })
  assert.ok(game._campaignSave.worlds.root.state.players[0].buildings.some(b => b.type === 'Granary'))
  assert.equal(game._campaignSave.worlds.root.state.runtime.dayNightElapsedMs, 0)
  await bootGameFromConfig(game, { villageStarts: { Hellas: profile } })
  assert.equal(restored, 1, 'later region boots must not reapply starting grants')
})
