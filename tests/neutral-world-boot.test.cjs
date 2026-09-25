const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

for (const [continent, saveFails] of [
  [false, false],
  [true, false],
  [true, true],
]) {
  test(
    saveFails
      ? 'failed initial autosave keeps the generated world available and marks it unsaved'
      : continent
        ? 'populated 5k bootstrap saves the full post-mount snapshot only'
        : 'a non-Hellas region preloads both neutral villager variants before placing caves',
    async () => {
      const loaded = new Set()
      const serialized = []
      let mounted = false
      let saved = false
      const bootstrap = { bootstrap: true }
      let economySnapshot
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
          '../../services/world/WorldEconomyRuntime': {
            initializeCampaignEconomy: async (_campaign, _context, _load, _profiles, snapshot) => {
              economySnapshot = snapshot
            },
          },
          '../../classes/players/GaiaPlayer': { ensureNeutralPlayer },
          '../../lib/lang': {},
          '../../lib/lpc': { preloadBakedLpcUnitsForPlayers },
          '../../serialization/SaveSerializer': {
            serializeCampaignBootstrap: () => {
              assert.equal(mounted, false)
              return bootstrap
            },
            serializeGameForPersistence: () => {
              const snapshot = { mounted }
              serialized.push(snapshot)
              return snapshot
            },
            serializeGame: () => {
              const snapshot = { mounted }
              serialized.push(snapshot)
              return snapshot
            },
          },
          '../../serialization/CampaignSave': {
            createInitialCampaignSave: () => ({ currentWorldId: 'root', worlds: { root: {} } }),
          },
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
          {
            assert.ok(loaded.has('villager:hellas/male'))
            assert.ok(loaded.has('villager:hellas/female'))
            for (const civ of ['hellas', 'latium', 'kemet', 'sumeria', 'xia', 'alba', 'nord', 'nobatia']) {
              for (const gender of ['male', 'female']) assert.ok(loaded.has(`villager:${civ}/${gender}`))
            }
            const neutral = ensureNeutralPlayer(context)
            assert.equal(context.players.length, 2)
            assert.equal(neutral.color, 'grey')
          }
          placed = true
        },
      }
      const game = {
        context,
        _gameContext: () => {
          assert.ok(context.player, 'full game context is unavailable before player initialization')
          return context
        },
        _map: () => map,
        _createRuntime() {},
        _applyMapConfig() {},
        _createUiRuntime() {},
        _loadRequiredWorldMapBlueprint: async () => {
          assert.equal(context.paused, true, 'simulation is paused before the first asynchronous load')
          return {}
        },
        _updateLoading: async () => {},
        _mountRuntime() {
          mounted = true
        },
        _autosaveCampaign() {
          const state = game._campaignSave.worlds.root.state
          assert.equal(state.mounted, true)
          assert.notEqual(state, bootstrap)
          saved = true
          return !saveFails
        },
      }
      await bootGameFromConfig(game, continent ? { worldId: 'world-test-5000' } : {}, { startPaused: true })
      assert.equal(context.paused, true, 'loading must not resume the simulation')
      assert.equal(placed, true)
      assert.equal(serialized.length, continent ? 1 : 2)
      assert.equal(saved, true)
      assert.equal(game._initialSaveFailed, saveFails)
      assert.equal(economySnapshot, continent ? bootstrap : serialized[0])
    }
  )
}
