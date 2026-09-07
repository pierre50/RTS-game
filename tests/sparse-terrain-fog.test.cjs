const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

class Container {
  constructor() {
    this.children = []
  }
  addChild(...children) {
    this.children.push(...children)
    return children[0]
  }
  removeChildren() {
    const children = this.children
    this.children = []
    return children
  }
  destroy() {}
}
class Graphics extends Container {
  constructor() {
    super()
    this.polygons = []
  }
  poly(points) {
    this.polygons.push(points)
    return this
  }
  rect() {
    return this
  }
  fill() {
    return this
  }
}
class Sprite extends Container {
  constructor() {
    super()
    this.position = { set() {}, copyFrom() {} }
    this.anchor = { set() {}, copyFrom() {} }
  }
}
const constants = {
  CELL_WIDTH: 64,
  CELL_HEIGHT: 32,
  CELL_DEPTH: 16,
  RELIEF_WATER_BUFFER_RADIUS: 2,
  LABEL_TYPES: { set: 'set' },
  FAMILY_TYPES: { cell: 'cell' },
  getEnvironmentTerrainParams: () => ({ reliefAmplitude: 1, waterBackgroundColor: 0 }),
}
const mocks = {
  'pixi.js': {
    Container,
    Graphics,
    Sprite,
    TilingSprite: Sprite,
    Assets: { cache: { has: () => true, get: () => ({}) } },
  },
  '../../../constants': constants,
  '../../constants': constants,
  '../../../lib': { getGaiaAnimals: () => [], getPlainCellsAroundPoint: () => [], getCellsAroundPoint: () => [] },
  '../../lib': { getTextureByFrame: () => ({}) },
  '../cell': { Cell: class {} },
  '../../cell/CellFog': { _DW: 64, _DH: 32 },
  '../../cell/TerrainBakeCell': {
    TerrainBakeCell: class {
      constructor(source) {
        Object.assign(this, source)
        this.isGenerationCell = false
      }
    },
  },
  '../../cell/RuntimeCell': {
    RuntimeCell: class {
      constructor(source) {
        Object.assign(this, source)
      }
    },
  },
  './ViewportFogRenderer': {
    ViewportFogRenderer: class {
      invalidate() {}
    },
  },
  '../players': { Gaia: class {} },
  '../../services/FogOfWar': { rehydrateAIKnowledge() {} },
}
const { MapTerrain } = loadTsModule('app/classes/map/terrain/MapTerrain.ts', { mocks })
const { MapFog } = loadTsModule('app/classes/map/fog/MapFog.ts', { mocks })
const { TerrainChunkManager } = loadTsModule('app/classes/map/TerrainChunkManager.ts', { mocks })
const { setInitialFogCells } = loadTsModule('app/classes/map/MapGenerationPipeline.ts', { mocks })
const { updateWaterOverlay } = loadTsModule('app/classes/map/MapWaterOverlay.ts', { mocks })

function cell(i, j, category = 'Land', z = 0) {
  return {
    i,
    j,
    category,
    type: category === 'Water' ? 'Water' : 'Grass',
    z,
    x: (i - j) * 32,
    y: (i + j) * 16 - z * 16,
    setFog() {
      this.fogged = true
    },
    updateVisible() {
      this.updated = true
    },
    resetTerrainAppearance() {},
    setWater() {
      this.category = 'Water'
    },
  }
}
function terrainMap(grid) {
  const map = { grid, size: grid.length - 1, seed: 12, playersPos: [], addChild() {} }
  const terrain = new MapTerrain(map)
  for (const key of Object.getOwnPropertyNames(MapTerrain.prototype)) {
    if (key !== 'constructor') map[key] = terrain[key].bind(terrain)
  }
  return map
}

test('terrain relief and appearance preserve sparse holes and original coordinates', () => {
  const grid = [[], [], [], []]
  grid[1][1] = cell(1, 1, 'Land', -2)
  grid[1][2] = cell(1, 2)
  grid[2][1] = cell(2, 1, 'Water')
  grid[2][2] = cell(2, 2, 'Land', 2)
  const keys = grid.map(row => Object.keys(row))
  const map = terrainMap(grid)
  map.generateMapRelief()
  map.fillWaterGaps()
  map.normalizeWaterTopology()
  map.rebuildTerrainAppearance()
  assert.deepEqual(
    grid.map(row => Object.keys(row)),
    keys
  )
  for (const row of grid)
    for (const entry of row) {
      if (!entry) continue
      assert.equal(entry.x, (entry.i - entry.j) * 32)
      assert.equal(entry.y, (entry.i + entry.j) * 16 - entry.z * 16)
    }
})

test('water relief propagation cannot cross an absent cell', () => {
  const grid = [[], [], []]
  grid[1][0] = cell(1, 0, 'Water')
  grid[1][2] = cell(1, 2, 'Land', 4)
  const map = terrainMap(grid)
  const distances = map.getReliefCoastDistances()
  assert.equal(distances[4], 9999)
  assert.equal(distances[5], 9999)
  const bounds = map.clampReliefAroundWaterLevels()
  assert.equal(bounds.maxLevels[5], 32767)
  assert.equal(grid[1][2].z, 4)
})

test('fog initialization and baking skip holes, including a missing origin', async () => {
  const grid = [[], [], []]
  grid[1][1] = { ...cell(1, 1), isGenerationCell: true }
  const map = { grid, size: 2, context: { player: { views: { isViewed: () => true } } }, resources: [] }
  await setInitialFogCells(map, async () => {}, 1)
  assert.equal(grid[1][1].fogged, true)
  const fog = new MapFog(map)
  fog.bakeTerrainToChunks()
  assert.equal(grid[1][1].isGenerationCell, false)
  fog._markTerrainCellsVisible()
  fog._collectTerrainBakeCells({ terrainContainer: new Container(), terrainSets: [] })
  fog._updateViewedCellsAfterTerrainBake()
  assert.equal(grid[1][1].visible, true)
  assert.equal(grid[1][1].updated, true)
  const source = grid[1][1]
  source.context = { map }
  const resource = { currentCell: source, path: [source] }
  map.resources.push(resource)
  fog._compactTerrainCells(new Container())
  assert.notEqual(grid[1][1], source)
  assert.equal(resource.currentCell, grid[1][1])
  assert.equal(resource.path[0], grid[1][1])
  assert.deepEqual(
    grid.map(row => Object.keys(row)),
    [[], ['1'], []]
  )
  assert.ok(Object.values(fog._getFogMapBounds()).every(Number.isFinite))
  delete grid[1][1]
  assert.ok(Object.values(fog._getFogMapBounds()).every(Number.isFinite))
})

test('terrain chunks bound occupied cells even when every chunk corner is absent', () => {
  const grid = Array.from({ length: 65 }, () => [])
  grid[15][16] = cell(15, 16, 'Land', 4)
  grid[16][15] = cell(16, 15, 'Land', -4)
  const map = { grid, size: 64, context: {}, addChild() {} }
  const manager = new TerrainChunkManager(map)
  manager.initialize()
  assert.equal(manager.chunks.size, 1)
  const chunk = manager.chunks.get('0:0')
  assert.ok(Object.values(chunk.bounds).every(Number.isFinite))
  for (const entry of [grid[15][16], grid[16][15]]) {
    assert.ok(chunk.bounds.minY <= entry.y)
    assert.ok(chunk.bounds.minY + chunk.bounds.height >= entry.y)
  }
  manager._mountChunk(chunk)
  assert.equal(chunk.visualCells.size, 0)
  assert.equal(grid[0].length, 0)
})

test('water mask includes occupied isometric runs and excludes an internal hole', () => {
  const grid = [[], [], []]
  grid[1][0] = cell(1, 0, 'Water')
  grid[1][2] = cell(1, 2)
  const map = { grid, size: 2, context: {}, waterBorderSurfaces: new Set(), addChild() {} }
  updateWaterOverlay(map)
  assert.deepEqual(map.waterOverlayMask.polygons, [
    [32, 0, 64, 16, 32, 32, 0, 16],
    [-32, 32, 0, 48, -32, 64, -64, 48],
  ])
  assert.equal(1 in grid[1], false)
})

test('water mask merges adjacent cells into one isometric strip', () => {
  const grid = [[], [cell(1, 0, 'Water'), cell(1, 1)], []]
  const map = { grid, size: 2, context: {}, waterBorderSurfaces: new Set(), addChild() {} }
  updateWaterOverlay(map)
  assert.deepEqual(map.waterOverlayMask.polygons, [[32, 0, 64, 16, 0, 48, -32, 32]])
})

test('viewport fog queries and draws only occupied cells', () => {
  const { ViewportFogRenderer } = loadTsModule('app/classes/map/fog/ViewportFogRenderer.ts', {
    mocks: { ...mocks, '../../../lib': { isometricToCartesian: () => [0, 0] } },
  })
  const grid = [[], [, cell(1, 1)], []]
  const renderer = new ViewportFogRenderer({ grid, size: 2 })
  const drawn = []
  renderer._drawShape = (_graphics, x, y) => drawn.push([x, y])
  const viewed = []
  const views = {
    isViewed(i, j) {
      viewed.push([i, j])
      return true
    },
    isVisible(i, j) {
      assert.ok(grid[i][j])
      return true
    },
  }
  renderer._drawViewportCells(new Graphics(), new Graphics(), views, 0, 0, 64, 64)
  assert.deepEqual(viewed, [[1, 1]])
  assert.deepEqual(drawn, [
    [0, 32],
    [0, 32],
  ])
})
