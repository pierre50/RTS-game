const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadPathfinding() {
  const filename = path.join(__dirname, '../app/services/Pathfinding.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const mocks = {
    '../lib/maths': {
      cellIsDiag: (a, b) => a.i !== b.i && a.j !== b.j,
      instancesDistance: (a, b) => Math.hypot(a.i - b.i, a.j - b.j),
    },
    '../lib/grid/cells': {
      getSquareCellsAroundPoint: (startX, startY, grid, dist, callback, includeCenter = true) => {
        const result = []
        for (let i = Math.max(0, startX - dist); i <= Math.min(grid.length - 1, startX + dist); i++) {
          const row = grid[i]
          if (!row) continue
          for (let j = Math.max(0, startY - dist); j <= Math.min(row.length - 1, startY + dist); j++) {
            if (!includeCenter && i === startX && j === startY) continue
            const cell = row[j]
            if (cell && (!callback || callback(cell))) result.push(cell)
          }
        }
        return result
      },
    },
  }
  const localRequire = request =>
    Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks)
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

function makeLineGrid() {
  return Array.from({ length: 3 }, (_, i) => [
    {
      category: 'Land',
      has: null,
      i,
      j: 0,
      solid: false,
    },
  ])
}

test('pathfinding can cross a solid cell occupied by the same labelled unit', () => {
  const { findInstancePath } = loadPathfinding()
  const grid = makeLineGrid()
  grid[1][0].solid = true
  grid[1][0].has = { label: 'bandit-1' }

  const path = findInstancePath({ i: 0, j: 0, label: 'bandit-1' }, 2, 0, { grid, size: 2 })

  assert.deepEqual(
    path.map(cell => [cell.i, cell.j]),
    [
      [2, 0],
      [1, 0],
    ]
  )
})

test('pathfinding still blocks solid cells occupied by another unit', () => {
  const { findInstancePath } = loadPathfinding()
  const grid = makeLineGrid()
  grid[1][0].solid = true
  grid[1][0].has = { label: 'other-unit' }

  const path = findInstancePath({ i: 0, j: 0, label: 'bandit-1' }, 2, 0, { grid, size: 2 })

  assert.deepEqual(path, [])
})

test('pathfinding can cross an explicitly passable solid passage cell', () => {
  const { findInstancePath } = loadPathfinding()
  const grid = makeLineGrid()
  grid[1][0].solid = true
  grid[1][0].has = { label: 'other-unit' }
  grid[1][0].reservedPassage = true

  const path = findInstancePath(
    { i: 0, j: 0, label: 'villager-1' },
    2,
    0,
    { grid, size: 2 },
    {
      canPassThroughSolidCell: cell => cell.reservedPassage === true,
    }
  )

  assert.deepEqual(
    path.map(cell => [cell.i, cell.j]),
    [
      [2, 0],
      [1, 0],
    ]
  )
})

test('pathfinding blocks water cells behind the shoreline', () => {
  const { findInstancePath } = loadPathfinding()
  const grid = makeLineGrid()
  grid[1][0].category = 'Water'
  grid[1][0].waterBorder = false
  grid[1][0].solid = false

  const path = findInstancePath({ i: 0, j: 0, label: 'villager-1' }, 2, 0, { grid, size: 2 })

  assert.deepEqual(path, [])
})

test('pathfinding can cross water-border shoreline cells', () => {
  const { findInstancePath } = loadPathfinding()
  const grid = makeLineGrid()
  grid[1][0].waterBorder = true
  grid[1][0].solid = false

  const path = findInstancePath({ i: 0, j: 0, label: 'villager-1' }, 2, 0, { grid, size: 2 })

  assert.deepEqual(
    path.map(cell => [cell.i, cell.j]),
    [
      [2, 0],
      [1, 0],
    ]
  )
})

test('interleaved incremental searches keep independent state and match complete routes', () => {
  const { findInstancePath, searchInstancePath } = loadPathfinding()
  const grid = Array.from({ length: 100 }, (_, i) => Array.from({ length: 100 }, (_, j) => ({ i, j })))
  const map = { grid }
  const expected = findInstancePath({ i: 0, j: 0 }, 99, 99, map)
  const first = searchInstancePath({ i: 0, j: 0 }, 99, 99, map)
  const second = searchInstancePath({ i: 99, j: 0 }, 0, 99, map)
  assert.equal(first.next().done, false)
  assert.equal(second.next().done, false)
  // A synchronous route on the same cells must not overwrite either suspended search.
  findInstancePath({ i: 0, j: 99 }, 99, 0, map)
  let a = first.next(),
    b = second.next()
  while (!a.done || !b.done) {
    if (!a.done) a = first.next()
    if (!b.done) b = second.next()
  }
  assert.deepEqual(a.value, expected)
  assert.deepEqual(b.value, findInstancePath({ i: 99, j: 0 }, 0, 99, map))
})

test('a prepared route is reused only in its commit scope and respects new diagonal blockers', () => {
  const { findInstancePath, withPreparedPaths } = loadPathfinding()
  const grid = Array.from({ length: 3 }, (_, i) => Array.from({ length: 3 }, (_, j) => ({ i, j })))
  let calls = 0
  const map = { grid, context: { performance: { record: () => calls++ } } }
  const unit = { i: 0, j: 0 }
  const path = findInstancePath(unit, 2, 2, map)
  const originalCalls = calls
  withPreparedPaths([{ start: grid[0][0], path }], () => {
    assert.deepEqual(findInstancePath(unit, 2, 2, map), path)
    assert.equal(calls, originalCalls)
    grid[1][0].solid = true
    assert.notDeepEqual(findInstancePath(unit, 2, 2, map), path)
    assert.ok(calls > originalCalls)
  })
  const before = calls
  findInstancePath(unit, 2, 2, map)
  assert.ok(calls > before)
})
