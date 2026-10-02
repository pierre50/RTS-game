const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const random = loadTsModule('app/lib/random.ts')
const textures = loadTsModule('app/lib/graphics/textures.ts', { mocks: { 'pixi.js': {} } })
const definitions = {
  Grass: { category: 'Ground', color: '#123', assets: ['grass1', 'grass2'] },
  Water: { category: 'Water', color: '#456', assets: ['water'] },
}
const moduleCache = new Map()
const mocks = {
  '../../lib': {
    ...random,
    ...textures,
    updateInstanceRenderVisibility: () => true,
    getGaiaAnimals: gaia => gaia?.animals ?? [],
  },
  'pixi.js': { Assets: { cache: { get: () => ({ cells: definitions }) } } },
}
const { PackedCellStore } = loadTsModule('app/classes/cell/PackedCellStore.ts', { mocks, moduleCache })
const { GenerationCell } = loadTsModule('app/classes/cell/GenerationCell.ts', { mocks, moduleCache })
function fixture() {
  const context = { map: { seed: 42, randomItem: items => items[0], invalidateReliefCoastDistances() {} } }
  const types = new Uint8Array(16)
  const heights = new Int8Array(16)
  heights[6] = 2
  const store = new PackedCellStore(types, heights, 4, context, definitions, GenerationCell.prototype)
  return { store, context, cell: store.create(1, 2) }
}

test('packed cells match normal terrain geometry, variants and all movement flags', () => {
  const { store, context, cell } = fixture()
  const normal = new GenerationCell({ i: 1, j: 2, z: 2, type: 'Grass' }, context)
  for (const key of [
    'i',
    'j',
    'x',
    'y',
    'z',
    'zIndex',
    'type',
    'category',
    'color',
    'assets',
    'terrainTextureName',
    'solid',
    'visible',
    'inclined',
    'border',
    'waterBorder',
    'terrainHidden',
  ]) {
    assert.deepEqual(cell[key], normal[key], key)
  }
  assert.equal(store.extras.size, 0)
  cell.solid = true
  cell.visible = true
  assert.equal(cell.solid, true)
  assert.equal(cell.visible, true)
  assert.equal(store.create(1, 1).solid, false)
  assert.equal(store.extras.size, 0)
})

test('occupants, corpses, decorations and terrain changes remain independent and mutable', () => {
  const { store, cell } = fixture()
  const neighbor = store.create(1, 1)
  const unit = { label: 'unit' }
  cell.place(unit)
  cell.corpses.add({ label: 'corpse' })
  const decoration = { label: 'floor' }
  cell.addChild(decoration)
  cell.setPatchBorder('east')
  cell.setReliefBorder(3, 16)
  assert.equal(cell.has, unit)
  assert.equal(neighbor.has, null)
  assert.equal(cell.corpses.size, 1)
  assert.equal(cell.getChildByLabel('floor'), decoration)
  assert.equal(cell._terrainAppearance.patchBorders.has('east'), true)
  assert.equal(cell.y, 0)
  cell.resetTerrainAppearance()
  assert.equal(cell.y, 16)
  assert.equal(cell.has, unit)
  assert.equal(cell.corpses.size, 1)
  cell.setWater()
  assert.equal(cell.category, 'Water')
  assert.equal(store.types[6], 2)
  cell.z = 1.5
  assert.equal(cell.z, 1.5)
  cell.z = 3
  assert.equal(cell.z, 3)
})

test('whole-map appearance reset and visibility do not allocate empty cell state', () => {
  const { store } = fixture()
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      const cell = store.create(i, j)
      cell.resetTerrainAppearance()
      assert.equal(cell.getChildByLabel('set'), null)
      assert.deepEqual(cell.getTerrainDecorations(), [])
    }
  store.markVisible()
  store.resetAppearance()
  assert.equal(store.extras.size, 0)
  assert.equal(store.create(0, 0).visible, true)
})

test('packed blueprint rows preserve holes, array iteration, edits and JSON serialization', () => {
  const { createPackedBlueprintGrid } = loadTsModule('app/serialization/blueprint/PackedBlueprintGrid.ts')
  const values = new Uint8Array([0, 255, 2, 1])
  const grid = createPackedBlueprintGrid(
    values,
    2,
    x => x * 10,
    index => values[index] !== 255
  )
  assert.equal(Array.isArray(grid[0]), true)
  assert.equal(grid[0].length, 2)
  assert.equal(1 in grid[0], false)
  assert.deepEqual([...grid[1]], [20, 10])
  assert.deepEqual(
    grid[0].map(x => x + 1),
    [1, ,]
  )
  assert.deepEqual(Object.keys(grid[0]), ['0'])
  grid[0][1] = 30
  delete grid[1][0]
  assert.equal(JSON.stringify(grid), '[[0,30],[null,10]]')
})

test('pausing a packed world visits changed cells and preserves ground corpse timers', () => {
  const { collectPausableInstances } = loadTsModule('app/screens/game/pausableRuntime.ts', { mocks, moduleCache })
  const { store, cell } = fixture()
  const grid = Array.from({ length: 4 }, () => [])
  grid[1][2] = cell
  store.attach(grid)
  const corpse = { label: 'arrow', pause() {}, resume() {} }
  cell.corpses.add(corpse)
  const count = store.extras.size
  assert.deepEqual([...collectPausableInstances({ grid }, [])], [corpse])
  assert.equal(store.extras.size, count)
})

test('large finalized blueprints keep decoded terrain compact and preserve outside holes', async () => {
  const { decodeMapBlueprintPayload } = loadTsModule('app/serialization/blueprint/MapBlueprintDecoding.ts')
  const stride = 1501
  const types = Buffer.alloc(stride * stride, 255)
  const heights = Buffer.alloc(types.length)
  types[500 * stride + 500] = 3
  heights[500 * stride + 500] = 2
  const blueprint = await decodeMapBlueprintPayload(
    {
      format: 'map-blueprint',
      version: 2,
      size: stride - 1,
      sourceSize: 999,
      localGridLayout: { columns: 501, rows: 2001 },
      terrain: types.toString('base64'),
      relief: heights.toString('base64'),
    },
    { path: 'test.map', size: 999 },
    {}
  )
  assert.equal(blueprint.packedTerrain.types.byteLength, types.length)
  assert.equal(blueprint.terrain[500][500], 'Jungle')
  assert.equal(blueprint.relief[500][500], 2)
  assert.equal(blueprint.terrain[0][0], undefined)
  assert.equal(0 in blueprint.terrain[0], false)
})

test('normal and packed terrain cells invalidate water presence only on water transitions', () => {
  const { context, cell } = fixture()
  const normal = new GenerationCell({ i: 0, j: 0, type: 'Grass' }, context)
  let invalidations = 0
  context.map.invalidateWaterOverlay = () => invalidations++
  for (const target of [normal, cell]) {
    const before = invalidations
    target.setTerrainType('Grass')
    assert.equal(invalidations, before)
    target.setWater()
    assert.equal(invalidations, before + 1)
    target.setWater()
    assert.equal(invalidations, before + 1)
    target.setTerrainType('Grass')
    assert.equal(invalidations, before + 2)
  }
})

test('compact resources block movement without objects and cell.has resolves a stable mutable occupant', () => {
  const { CompactResourceSet } = loadTsModule('app/classes/resources/CompactResourceSet.ts')
  const { store, cell } = fixture()
  let created = 0
  const resources = new CompactResourceSet(
    1,
    4,
    'world',
    () => ({ totalQuantity: 100 }),
    state => {
      created++
      const resource = { ...state }
      cell.has = resource
      return resource
    },
    {}
  )
  resources.addState({ i: 1, j: 2, type: 'Tree', textureName: 'tree_0' })
  store.resourceAt = index => resources.atCell(index)
  store.flags[6] |= 1
  assert.equal(cell.solid, true)
  assert.equal(store.extras.size, 0)
  assert.equal(created, 0)
  const tree = cell.has
  assert.equal(cell.has, tree)
  assert.equal(created, 1)
  tree.quantity = 12
  assert.equal(resources.byLabel(tree.label).quantity, 12)
  resources.delete(tree)
  cell.has = null
  cell.solid = false
  assert.equal(cell.has, null)
  const newTree = { label: 'regrown' }
  cell.has = newTree
  resources.add(newTree)
  assert.equal(cell.has, newTree)
  assert.equal(resources.size, 1)
})

test('packed spatial bounds are accumulated per chunk and cover later relief edits', () => {
  const stride = 70
  const types = new Uint8Array(stride * stride).fill(255)
  const heights = new Int8Array(types.length)
  const positions = [
    [0, 2, 4],
    [34, 3, -2],
    [69, 69, 1],
  ]
  for (const [i, j, z] of positions) {
    types[i * stride + j] = 0
    heights[i * stride + j] = z
  }
  const context = { map: { seed: 42 } }
  const store = new PackedCellStore(types, heights, stride, context, definitions, GenerationCell.prototype)
  const cells = positions.map(([i, j]) => store.create(i, j))
  const result = store.spatialBounds()
  assert.equal(result.chunks.filter(Boolean).length, 3)
  assert.deepEqual(result.bounds, {
    minX: Math.min(...cells.map(c => c.x)),
    maxX: Math.max(...cells.map(c => c.x)),
    minY: Math.min(...cells.map(c => c.y)),
    maxY: Math.max(...cells.map(c => c.y)),
  })
  assert.deepEqual(store.elevationBounds(), { min: -64, max: 32 })
  cells[0].z = 20
  cells[0].resetTerrainAppearance()
  cells[2].x = 100000
  const edited = store.spatialBounds()
  assert.ok(edited.bounds.minY <= cells[0].y)
  assert.equal(edited.bounds.maxX, 100000)
  assert.ok(edited.minOffset <= -320)
  assert.ok(edited.chunks[0].minY <= cells[0].y)
  assert.equal(edited.chunks[8].maxX, 100000)
  // Empty chunks remain absent; a spatial query does not create cell handles.
  assert.equal(edited.chunks[1], undefined)
})

test('packed terrain chunks initialize without reading grid cells', () => {
  class Container {
    children = []
    destroy() {}
    addChild(child) {
      this.children.push(child)
      return child
    }
  }
  const { TerrainChunkManager } = loadTsModule('app/classes/map/TerrainChunkManager.ts', {
    moduleCache,
    mocks: { ...mocks, 'pixi.js': { Container, Sprite: class {} }, '../cell': { Cell: class {} } },
  })
  const { store } = fixture()
  const grid = new Proxy([], {
    get() {
      throw new Error('full grid read')
    },
  })
  store.attach(grid)
  const map = { size: 3, grid, addChild() {} }
  const manager = new TerrainChunkManager(map)
  manager.initialize()
  assert.equal(manager.chunks.size, 1)
  const bounds = manager.chunks.get('0:0').bounds
  assert.ok(bounds.minX <= -32 && bounds.minX + bounds.width >= -32)
  assert.ok(bounds.minY <= 16 && bounds.minY + bounds.height >= 16)
})

test('lazy runtime cells allocate on access, keep identity, and preserve sparse array behavior', () => {
  const { store } = fixture()
  store.types[3] = 255
  const before = store.materializedCount
  const grid = store.createLazyGrid()
  for (let i = 0; i < store.stride; i++) store.indexTerrainRow(i)
  assert.equal(store.materializedCount, before)
  assert.equal(grid.length, 4)
  assert.equal(grid[0].length, 4)
  assert.equal(3 in grid[0], false)
  assert.equal(grid[0][3], undefined)
  const cell = grid[1][2]
  assert.equal(store.materializedCount, before + 1)
  assert.equal(grid[1][2], cell)
  cell.has = { label: 'occupant' }
  assert.equal(grid[1][2].has.label, 'occupant')
  delete grid[1][2]
  assert.equal(2 in grid[1], false)
  assert.equal(grid[1][2], undefined)
  grid[1][2] = cell
  assert.equal(grid[1][2], cell)
  assert.equal(store.materializedCount, before + 1)
  assert.equal(grid[0].map(c => c.type).filter(Boolean).length, 3)
})
