const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('packed blueprint loading packs generated minerals and herbs without explicit textures', () => {
  const moduleCache = new Map()
  const definitions = require('../public/assets/data/gameplay/resources.json')
  const created = []
  const mocks = {
    'pixi.js': { Assets: { cache: { get: () => ({ resources: definitions, cells: {} }) } } },
    '../../Resource': {
      Resource: {
        spawn(state) {
          created.push(state)
          return { ...state, family: 'resource' }
        },
      },
    },
    '../NeighborScenery': { setNeighborScenerySource() {} },
    '../../cell': { Cell: class {}, GenerationCell: class {} },
    '../../../lib': { createDeterministicCellVariantPicker: () => () => undefined },
  }
  const { MapBlueprintGeneration } = loadTsModule('app/classes/map/generation/MapBlueprintGeneration.ts', {
    mocks,
    moduleCache,
  })
  const { packedCellStores } = loadTsModule('app/classes/cell/PackedCellRegistry.ts', { mocks, moduleCache })
  const grid = Array.from({ length: 4 }, (_, i) =>
    Array.from({ length: 4 }, (_, j) => ({ i, j, type: 'Grass', solid: false, has: null }))
  )
  for (const row of grid)
    for (const cell of row)
      Object.defineProperty(cell, 'has', {
        get() {
          throw new Error('cold resource loading read a cell')
        },
      })
  let randomPicks = 0
  const map = {
    grid,
    context: { app: {}, gamebox: {}, scheduler: {} },
    randomItem: values => {
      randomPicks++
      return values[0]
    },
  }
  map.context.map = map
  const packed = { stride: 4, flags: new Uint8Array(16), types: new Uint8Array(16), extras: new Map() }
  packedCellStores.set(grid, packed)
  const generation = new MapBlueprintGeneration(
    map,
    async () => {},
    () => {}
  )
  generation.loadBlueprintResources({
    resources: [
      { i: 0, j: 0, type: 'Tree', textureName: '000_resources/tree/grass', quantity: 200 },
      { i: 0, j: 1, type: 'Stone', quantity: 96 },
      { i: 0, j: 2, type: 'MedicinalHerb', quantity: 2 },
      { i: 0, j: 3, type: 'Wheat', quantity: 10, startsMature: true },
    ],
  })
  assert.equal(map.resources.size, 4)
  assert.equal(map.resources.materializedCount, 1)
  assert.equal(created.length, 1)
  assert.equal(created[0].type, 'Wheat')
  assert.equal(created[0].startsMature, true)
  assert.equal(randomPicks, 1)
  assert.equal(packed.flags[0] & 1, 1)
  assert.equal(packed.flags[1] & 1, 1)
  const stone = packed.resourceAt(1)
  assert.equal(stone.quantity, 96)
  assert.ok(stone.textureName.includes('resources/minerals'))
  assert.equal(created.length, 2)
})
