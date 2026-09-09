const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { createSquareLocalBlueprint } = loadTsModule('app/classes/map/generation/LocalMapBlueprint.ts')
const { prepareLocalBlueprint } = require('../tools/maps/local-blueprint.cjs')
const { gridToLocal } = loadTsModule('app/lib/localMapLayout.ts')
const { EIGHT_NEIGHBOR_OFFSETS, getNeighborFlags, hasUnsupportedTransition } =
  loadTsModule('app/lib/terrain/topology.ts')

function assertRenderable(blueprint) {
  const grid = blueprint.terrain.map((row, i) => row.map((type, j) => ({ i, j, type, z: blueprint.relief[i][j] })))
  for (const row of grid)
    for (const cell of row) {
      if (!cell || cell.type === 'Water') continue
      const flags = getNeighborFlags(grid, cell.i, cell.j, neighbor => neighbor && neighbor.z > cell.z)
      assert.equal(hasUnsupportedTransition(flags), false, `unsupported relief at ${cell.i},${cell.j}`)
      for (const [di, dj] of EIGHT_NEIGHBOR_OFFSETS) {
        const neighbor = grid[cell.i + di]?.[cell.j + dj]
        if (neighbor && neighbor.type !== 'Water')
          assert.ok(
            Math.abs(cell.z - neighbor.z) <= 1,
            `height step ${cell.i},${cell.j}:${cell.z} to ${neighbor.i},${neighbor.j}:${neighbor.z}`
          )
      }
      const { column, row: localRow } = gridToLocal(cell.i, cell.j, blueprint.localGridLayout)
      if (
        localRow === 0 ||
        localRow === blueprint.localGridLayout.rows - 1 ||
        column === 0 ||
        column === blueprint.localGridLayout.columns - 1
      ) {
        assert.equal(cell.z, 0, 'adjacent maps must share the same boundary elevation')
      }
    }
}

test('opposite elevations meet at a common rim with atlas-compatible slopes', () => {
  for (const level of [3, -3]) {
    const source = {
      size: 32,
      terrain: Array.from({ length: 33 }, () => Array(33).fill('Grass')),
      relief: Array.from({ length: 33 }, () => Array(33).fill(level)),
    }
    const snapshot = JSON.stringify(source)
    const converted = prepareLocalBlueprint(source)
    assertRenderable(converted)
    if (level > 0) assert.ok(converted.relief.flat().includes(level))
    assert.equal(JSON.stringify(source), snapshot)
    assert.deepEqual(prepareLocalBlueprint(source).relief, converted.relief)
  }
})

test('the forest blueprint remains atlas-compatible after its square conversion', () => {
  const root = path.join(__dirname, '../public/maps/worlds/world-4242')
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')))
  const entry = manifest.maps.find(entry => entry.region.x === 1 && entry.region.y === 1)
  const converted = decodeWorldBlueprint(path.join(root, 'maps', entry.path))
  assertRenderable(converted)
  assert.ok(
    converted.relief.flat().some(level => level < 0),
    'keep inland depressions'
  )
  assert.ok(
    converted.relief.flat().some(level => level > 0),
    'keep inland hills'
  )
})

function decodeWorldBlueprint(file) {
  const payload = JSON.parse(fs.readFileSync(file))
  const n = payload.size + 1
  const types = ['Grass', 'Desert', 'Water', 'Jungle', 'DarkForest', 'Dirt', 'Water', 'Snow']
  const terrain = Buffer.from(payload.terrain, 'base64')
  const relief = new Int8Array(Buffer.from(payload.relief, 'base64'))
  const result = {
    ...payload,
    terrain: Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => types[terrain[i * n + j]])),
    relief: Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => relief[i * n + j])),
  }
  if (payload.version === 2) {
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        if (terrain[i * n + j] === 255) {
          delete result.terrain[i][j]
          delete result.relief[i][j]
        }
      }
  }
  return result
}

function assertFlatCoast(blueprint) {
  const { RELIEF_WATER_BUFFER_RADIUS: radius } = loadTsModule('app/constants/terrain.ts')
  for (let i = 0; i <= blueprint.size; i++)
    for (let j = 0; j <= blueprint.size; j++) {
      if (blueprint.terrain[i]?.[j] !== 'Water') continue
      for (let di = -radius; di <= radius; di++)
        for (let dj = -radius; dj <= radius; dj++) {
          if (Math.abs(di) + Math.abs(dj) > radius || blueprint.terrain[i + di]?.[j + dj] == null) continue
          assert.equal(
            blueprint.relief[i + di][j + dj],
            0,
            `non-flat coast at ${i + di},${j + dj} near water ${i},${j}`
          )
        }
    }
}

test('region (2, 0) keeps its seven affected shore cells flat after conversion', () => {
  const source = decodeWorldBlueprint(
    path.join(__dirname, '../public/maps/worlds/world-4242/maps/144/world-4242-r2-0-black-forest.map')
  )
  const converted = createSquareLocalBlueprint(source)
  assert.equal(converted, source, 'loading final maps must not transform them')
  for (const [i, j] of [
    [137, 184],
    [137, 185],
    [138, 183],
    [138, 184],
    [139, 182],
    [139, 183],
    [140, 182],
  ]) {
    assert.equal(converted.relief[i][j], 0, `regression at ${i},${j}`)
  }
  assertFlatCoast(converted)
  assertRenderable(converted)
})

test('every world region retains flat water clearance and renderable slopes', () => {
  const root = path.join(__dirname, '../public/maps/worlds/world-4242')
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')))
  for (const entry of manifest.maps) {
    const converted = createSquareLocalBlueprint(decodeWorldBlueprint(path.join(root, 'maps', entry.path)))
    try {
      assertFlatCoast(converted)
      assertRenderable(converted)
    } catch (error) {
      error.message = `${entry.id}: ${error.message}`
      throw error
    }
  }
})
