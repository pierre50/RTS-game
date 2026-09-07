const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const { createSquareLocalBlueprint } = loadTsModule('app/classes/map/generation/LocalMapBlueprint.ts')
const { bootGameFromSeedSave } = loadTsModule('app/screens/game/GameWorldBoot.ts', {
  mocks: {
    '../../lib/lang': { t: key => key },
    '../../lib/lpc': { preloadBakedLpcUnitsForPlayers: async () => {} },
    '../../serialization/SaveSerializer': {},
    '../../serialization/CampaignSave': {},
    './GameStateHelpers': { saveConfig: value => value ?? {}, savedRuntimeState: value => value },
    './GameMapBlueprintRuntime': { recordLoadedMapBlueprint() {} },
    './WorldRegionPlayers': {},
  },
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
        world: { size: expected.size, seed: 1, sourceSize, localGridLayout: expected.localGridLayout },
        config: { size: sourceSize },
        players: [],
      }
      let requestedSize
      let restored = false
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
        context: { players: [] },
        _createRuntime() {},
        _createUiRuntime() {},
        _mountRuntime() {},
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
      '../MapSaveRestore': {},
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
  assert.equal(map.grid[1][1].z, 0, 'old square saves also receive the repaired boundary elevation')
  map.grid[1][1].has = { label: 'old resource' }
  clearGeneratedGameplayState(map)
  assert.equal(map.grid[1][1].has, null)
  assert.equal(map.grid[1][1].solid, false)
})
