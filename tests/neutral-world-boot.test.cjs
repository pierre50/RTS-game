const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('a non-Hellas region preloads both neutral villager variants before placing caves', async () => {
  const loaded = new Set()
  const { ensureNeutralPlayer } = loadTsModule('app/classes/players/GaiaPlayer.ts', {
    mocks: {
      '../../lib': {},
      '../animal/Animal': {},
      './Player': {
        Player: class {
          constructor(options) {
            Object.assign(this, { units: [], corpses: [], buildings: [] }, options)
          }
        },
      },
    },
  })
  const { preloadBakedLpcUnitsForPlayers } = loadTsModule('app/lib/lpc/bakedPreload.ts', {
    mocks: {
      'pixi.js': { Assets: { load: async () => {} } },
      './bakedAliasCache': {
        isAssetCached: () => false,
        loadBakedUnitVariant: async (type, variant) => loaded.add(`${type}:${variant}`),
        registerDynamicEquipmentAliases() {},
      },
      './bakedUnitAssets': {},
      './equipment': { dynamicEquipmentAssets: () => [] },
      './heroAppearance': {
        heroAppearanceAssetsForPlayers: () => [],
        registerHeroAppearanceAliasesForPlayers() {},
      },
    },
  })
  const { bootGameFromConfig } = loadTsModule('app/screens/game/GameWorldBoot.ts', {
    mocks: {
      '../../services/world/WorldEconomyRuntime': { initializeCampaignEconomy: async () => {} },
      '../../classes/players/GaiaPlayer': { ensureNeutralPlayer },
      '../../lib/lang': {},
      '../../lib/lpc': { preloadBakedLpcUnitsForPlayers },
      '../../serialization/SaveSerializer': { serializeGame: () => ({}) },
      '../../serialization/CampaignSave': { createInitialCampaignSave: () => ({ currentWorldId: 'root', worlds: { root: {} } }) },
      './GameStateHelpers': { ensureCampaignPlayerRoster: value => value },
      './GameMapBlueprintRuntime': { recordLoadedMapBlueprint() {} },
      './WorldRegionPlayers': {
        humanPlayerConfig: () => ({ civ: 'Kemet' }),
        buildWorldRegionPlayerConfigs: () => [],
        selectActivePlayer: players => players[0],
      },
    },
  })
  const context = { players: [], player: null }
  let placed = false
  const map = {
    size: 12,
    generateFromBlueprint: async () => {},
    generatePlayers: () => [{ civ: 'Kemet', units: [], corpses: [] }],
    stylishMap: async () => {
      assert.ok(loaded.has('villager:hellas/male'))
      assert.ok(loaded.has('villager:hellas/female'))
      for (const civ of ['hellas', 'latium', 'kemet', 'sumeria', 'xia', 'alba', 'nord', 'nobatia']) {
        for (const gender of ['male', 'female']) assert.ok(loaded.has(`villager:${civ}/${gender}`))
      }
      const neutral = ensureNeutralPlayer(context)
      assert.equal(context.players.length, 2)
      assert.equal(neutral.color, 'grey')
      placed = true
    },
  }
  const game = {
    context,
    _gameContext: () => context,
    _map: () => map,
    _createRuntime() {},
    _applyMapConfig() {},
    _createUiRuntime() {},
    _loadRequiredWorldMapBlueprint: async () => ({}),
    _updateLoading: async () => {},
    _mountRuntime() {},
    _autosaveCampaign() {},
  }
  await bootGameFromConfig(game, {})
  assert.equal(placed, true)
})
