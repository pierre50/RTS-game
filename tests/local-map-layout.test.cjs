const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const mocks = {
  '../constants': { CELL_WIDTH: 64, CELL_HEIGHT: 32 },
  '../../../constants': { CELL_WIDTH: 64, CELL_HEIGHT: 32 },
}
const { createSquareLocalBlueprint } = loadTsModule('app/classes/map/generation/LocalMapBlueprint.ts', { mocks })
const { localToGrid, gridToLocal, getLocalMapBounds, blueprintToLocalGrid, localGridToBlueprint } = loadTsModule(
  'app/lib/localMapLayout.ts',
  { mocks }
)

test('local blueprint fills a square with unchanged isometric diamonds and preserves every source cell', () => {
  const size = 12
  const source = {
    size,
    terrain: Array.from({ length: size + 1 }, (_, i) => Array.from({ length: size + 1 }, (_, j) => `${i}:${j}`)),
    resources: Array.from({ length: size + 1 }, (_, i) => ({ i, j: size - i, type: 'Tree' })),
    spawns: [{ i: 4, j: 8 }],
  }
  const converted = createSquareLocalBlueprint(source)
  const layout = converted.localGridLayout
  const bounds = getLocalMapBounds(layout)
  assert.equal(bounds.right - bounds.left, bounds.bottom - bounds.top)
  const sampled = new Set(converted.terrain.flat())
  for (const value of source.terrain.flat()) assert.ok(sampled.has(value), value)
  assert.equal(converted.terrain.flat().length, layout.columns * layout.rows - Math.floor(layout.rows / 2))
  assert.ok(converted.terrain.flat().length < (size + 5) ** 2)
  for (let row = 0; row < layout.rows; row++) {
    for (let column = 0; column < layout.columns; column++) {
      if (row % 2 === 1 && column === layout.columns - 1) continue
      const { i, j } = localToGrid(column, row, layout)
      assert.deepEqual(gridToLocal(i, j, layout), { column, row })
      assert.ok(converted.terrain[i][j])
      const x = (i - j) * 32
      const y = (i + j) * 16
      assert.equal(y, bounds.top + row * 16)
      assert.equal(x, bounds.left + column * 64 + (row % 2) * 32)
    }
  }
  for (let i = 0; i <= source.size; i++) {
    for (let j = 0; j <= source.size; j++) {
      const local = blueprintToLocalGrid(i, j, layout)
      assert.deepEqual(localGridToBlueprint(local.i, local.j, layout), { i, j })
      assert.equal(converted.terrain[local.i][local.j], `${i}:${j}`)
    }
  }
  converted.resources.forEach((resource, index) => {
    const original = source.resources[index]
    assert.equal(converted.terrain[resource.i][resource.j], `${original.i}:${original.j}`)
  })
  assert.equal(source.size, size)
  assert.equal(source.localGridLayout, undefined)
  assert.equal(createSquareLocalBlueprint(converted), converted)
})

test('interior blueprints keep floor masks and exits when converted to a square local layout', () => {
  const source = {
    size: 5,
    kind: 'interior',
    mapType: 'interior',
    terrain: Array.from({ length: 6 }, () => Array.from({ length: 6 }, () => 'Water')),
    relief: Array.from({ length: 6 }, () => Array.from({ length: 6 }, () => 0)),
    floorMask: Array.from({ length: 6 }, (_, i) =>
      Array.from({ length: 6 }, (_, j) => (i >= 1 && i <= 4 && j >= 1 && j <= 4 ? 1 : 0))
    ),
    borderMask: Array.from({ length: 6 }, (_, i) =>
      Array.from({ length: 6 }, (_, j) =>
        i >= 1 && i <= 4 && j >= 1 && j <= 4 && (i === 1 || i === 4 || j === 1 || j === 4) ? 1 : 0
      )
    ),
    spawns: [{ i: 3, j: 4 }],
    exits: [{ i: 3, j: 4, direction: 'south' }],
  }
  for (let i = 1; i <= 4; i++) for (let j = 1; j <= 4; j++) source.terrain[i][j] = 'Dirt'

  const converted = createSquareLocalBlueprint(source)
  const layout = converted.localGridLayout
  assert.ok(layout)
  assert.notEqual(converted, source)

  const convertedExit = blueprintToLocalGrid(3, 4, layout)
  assert.deepEqual(converted.exits, [{ ...convertedExit, direction: 'south' }])
  assert.deepEqual(converted.spawns, [convertedExit])
  assert.equal(converted.floorMask[convertedExit.i][convertedExit.j], 1)
  assert.equal(converted.borderMask[convertedExit.i][convertedExit.j], 1)

  for (let i = 0; i <= source.size; i++) {
    for (let j = 0; j <= source.size; j++) {
      const local = blueprintToLocalGrid(i, j, layout)
      assert.equal(converted.floorMask[local.i][local.j], source.floorMask[i][j])
      assert.equal(converted.borderMask[local.i][local.j], source.borderMask[i][j])
    }
  }
})
