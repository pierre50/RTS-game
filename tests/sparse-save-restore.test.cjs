const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const { createSquareLocalBlueprint } = loadTsModule('app/classes/map/generation/LocalMapBlueprint.ts')
const preloadedCivilizations = new Set()
const { bootGameFromSeedSave, bootGameFromSave } = loadTsModule('app/screens/game/GameWorldBoot.ts', {
  mocks: {
    '../../classes/players/GaiaPlayer': { ensureNeutralPlayer() {} },
    '../../lib/lang': { t: key => key },
    '../../lib/lpc': {
      preloadBakedLpcUnitsForPlayers: async players => {
        for (const player of players) preloadedCivilizations.add(player.civ)
      },
    },
    '../../serialization/SaveSerializer': {},
    '../../serialization/CampaignSave': {},
    './GameStateHelpers': {
      saveConfig: value => value ?? {},
      savedRuntimeState: value => value,
      hasSerializedGrid: value => Array.isArray(value.map),
    },
    './GameMapBlueprintRuntime': { recordLoadedMapBlueprint() {} },
    './WorldRegionPlayers': {},
  },
})

test('saved hero tool is restored after runtime initialization, including empty selection', async () => {
  for (const item of ['interact', 'sword', 'bow', null, undefined]) {
    let mounted = false
    const selected = []
    await bootGameFromSave(
      {
        context: {
          players: [],
          controls: {
            setEquippedItem(value) {
              assert.equal(mounted, true)
              selected.push(value)
            },
          },
        },
        _map: () => ({ generateFromJSON() {} }),
        _createRuntime() {},
        _applyMapConfig() {},
        _createUiRuntime() {},
        _mountRuntime() {
          mounted = true
        },
      },
      { map: [[]], players: [], runtime: { heroEquippedItem: item } }
    )
    assert.deepEqual(selected, item === undefined ? [] : [item])
  }
})

test('saved converted units preload their source civilization before entity construction', async () => {
  preloadedCivilizations.clear()
  const map = {
    generateFromJSON() {
      assert.ok(preloadedCivilizations.has('Kemet'))
      assert.ok(preloadedCivilizations.has('Nord'))
    },
  }
  await bootGameFromSave(
    {
      context: { players: [] },
      _map: () => map,
      _createRuntime() {},
      _applyMapConfig() {},
      _createUiRuntime() {},
      _mountRuntime() {},
    },
    { map: [[]], players: [{ civ: 'Hellas', units: [{ assetCiv: 'Kemet' }], corpses: [{ assetCiv: 'Nord' }] }] }
  )
})

test('seed saves regenerate the saved footprint and request the exact source blueprint size', async () => {
  for (const sourceSize of [4, 5]) {
    for (const sparse of [false, true]) {
      const source = {
        id: 'test',
        size: sourceSize,
        terrain: Array.from({ length: sourceSize + 1 }, () => Array(sourceSize + 1).fill('Grass')),
      }
      const expected = sparse ? createSquareLocalBlueprint(source) : source
      const state = {
        runtime: { heroEquippedItem: 'bow' },
        world: { size: expected.size, seed: 1, sourceSize, localGridLayout: expected.localGridLayout },
        config: { size: sourceSize },
        players: [],
      }
      let requestedSize
      let restored = false
      let selected = null
      let mounted = false
      const map = {
        async generateFromBlueprint(blueprint) {
          Object.assign(this, createSquareLocalBlueprint(blueprint))
        },
        async prepareTerrainForSavedState() {},
        mapGeneration: {
          applySavedStateToGeneratedMap(saved) {
            assert.equal(saved, state)
            assert.equal(map.size, expected.size)
            assert.deepEqual(map.localGridLayout, expected.localGridLayout)
            restored = true
          },
        },
      }
      const game = {
        context: {
          players: [],
          controls: {
            setEquippedItem(item) {
              assert.equal(mounted, true)
              selected = item
            },
          },
        },
        _createRuntime() {},
        _createUiRuntime() {},
        _mountRuntime() {
          mounted = true
        },
        _map: () => map,
        _applyMapConfig: (target, config) => Object.assign(target, config),
        _loadRequiredWorldMapBlueprint: async options => {
          requestedSize = options.size
          return source
        },
      }
      await bootGameFromSeedSave(game, state)
      assert.equal(requestedSize, sourceSize)
      assert.equal(restored, true)
      assert.equal(selected, 'bow')
      assert.equal(source.preserveLegacyGrid, undefined)
    }
  }
})

function savedGeneration() {
  class Gaia {
    constructor() {
      this.animals = []
    }
  }
  return loadTsModule('app/classes/map/generation/MapSavedStateGeneration.ts', {
    mocks: {
      '../../Resource': { Resource: class {} },
      '../../players': { Gaia },
      '../../../lib': { getGaiaAnimals: gaia => gaia.animals },
      '../../../services/FogOfWar': {},
      '../../cell': {
        Cell: class {
          constructor(options) {
            Object.assign(this, options)
          }
          setFog() {
            this.fogged = true
          }
        },
      },
      '../MapSaveRestore': { restorePlayerInteriors: () => {}, restoreCaveOccupants: () => {} },
    },
  })
}

test('full-grid restoration keeps every sparse row and clears cells from previous terrain', () => {
  const { generateFromJSON, clearGeneratedGameplayState } = savedGeneration()
  const map = {
    grid: [[{ type: 'stale' }]],
    children: [],
    context: { app: {}, gamebox: {}, scheduler: {}, players: [] },
    removeChildren() {},
    clearRenderChunks() {},
    resetRandom() {},
    invalidateReliefCoastDistances() {},
    _initFogChunks() {},
    _indexFogChunkCells() {},
    _flushFogQueue() {},
    fillWaterGaps() {},
    normalizeWaterTopology() {},
    rebuildTerrainAppearance() {},
    bakeTerrainToChunks() {},
    addChild: cell => cell,
  }
  map.context.map = map
  const layout = { columns: 2, rows: 5 }
  generateFromJSON(map, {
    map: [[], [null, { type: 'Grass', z: 3 }], [], []],
    world: { localGridLayout: layout },
    players: [],
    resources: [],
    animals: [],
    camera: { x: 0, y: 0 },
  })
  assert.deepEqual(map.localGridLayout, layout)
  assert.equal(map.grid.length, 4)
  assert.ok(map.grid.every(Array.isArray))
  assert.equal(map.grid[0][0], undefined)
  assert.equal(map.grid[1][0], undefined)
  assert.equal(map.grid[1][1].fogged, true)
  assert.equal(map.grid[1][1].z, 3, 'saved elevation is read exactly without terrain generation')
  map.grid[1][1].has = { label: 'old resource' }
  clearGeneratedGameplayState(map)
  assert.equal(map.grid[1][1].has, null)
  assert.equal(map.grid[1][1].solid, false)
})
