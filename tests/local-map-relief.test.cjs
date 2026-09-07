const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { createSquareLocalBlueprint } = loadTsModule('app/classes/map/generation/LocalMapBlueprint.ts')
const { gridToLocal } = loadTsModule('app/lib/localMapLayout.ts')
const { EIGHT_NEIGHBOR_OFFSETS, getNeighborFlags, hasUnsupportedTransition } = loadTsModule('app/lib/terrain/topology.ts')

function assertRenderable(blueprint) {
  const grid = blueprint.terrain.map((row, i) => row.map((type, j) => ({ i, j, type, z: blueprint.relief[i][j] })))
  for (const row of grid) for (const cell of row) {
    if (!cell || cell.type === 'Water') continue
    const flags = getNeighborFlags(grid, cell.i, cell.j, neighbor => neighbor && neighbor.z > cell.z)
    assert.equal(hasUnsupportedTransition(flags), false, `unsupported relief at ${cell.i},${cell.j}`)
    for (const [di, dj] of EIGHT_NEIGHBOR_OFFSETS) {
      const neighbor = grid[cell.i + di]?.[cell.j + dj]
      if (neighbor && neighbor.type !== 'Water') assert.ok(Math.abs(cell.z - neighbor.z) <= 1)
    }
    const { column, row: localRow } = gridToLocal(cell.i, cell.j, blueprint.localGridLayout)
    if (localRow === 0 || localRow === blueprint.localGridLayout.rows - 1 || column === 0 || column === blueprint.localGridLayout.columns - 1) {
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
    const converted = createSquareLocalBlueprint(source)
    assertRenderable(converted)
    if (level > 0) assert.ok(converted.relief.flat().includes(level))
    assert.equal(JSON.stringify(source), snapshot)
    assert.deepEqual(createSquareLocalBlueprint(source).relief, converted.relief)
  }
})

test('the forest blueprint remains atlas-compatible after its square conversion', () => {
  const root = path.join(__dirname, '../public/maps/worlds/world-4242')
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')))
  const entry = manifest.maps.find(entry => entry.region.x === 1 && entry.region.y === 1)
  const payload = JSON.parse(fs.readFileSync(path.join(root, 'maps', entry.path)))
  const n = payload.size + 1
  const types = ['Grass', 'Desert', 'Water', 'Jungle', 'DarkForest', 'Dirt', 'Water', 'Snow']
  const terrain = Buffer.from(payload.terrain, 'base64')
  const relief = new Int8Array(Buffer.from(payload.relief, 'base64'))
  const converted = createSquareLocalBlueprint({
    ...payload,
    terrain: Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => types[terrain[i * n + j]])),
    relief: Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => relief[i * n + j])),
  })
  assertRenderable(converted)
  assert.ok(converted.relief.flat().some(level => level < 0), 'keep inland depressions')
  assert.ok(converted.relief.flat().some(level => level > 0), 'keep inland hills')
})
