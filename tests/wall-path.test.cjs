const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadWallPath() {
  const filename = path.join(__dirname, '../app/lib/grid/wallPath.js')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }]],
  })
  const module = { exports: {} }
  new Function('module', 'exports', 'require', code)(module, module.exports, require)
  return module.exports
}

function makeGrid(size) {
  return Array.from({ length: size }, (_, i) => Array.from({ length: size }, (_, j) => ({ i, j, blocked: false })))
}

const { findWallPath, getWallFrame } = loadWallPath()

test('finds a cardinal wall path around blocked cells', () => {
  const grid = makeGrid(5)
  grid[1][2].blocked = true
  grid[2][2].blocked = true
  grid[3][2].blocked = true

  const wallPath = findWallPath(grid, grid[2][0], grid[2][4], cell => !cell.blocked)

  assert.deepEqual(wallPath[0], grid[2][0])
  assert.deepEqual(wallPath.at(-1), grid[2][4])
  assert.ok(
    wallPath.every((cell, index) => {
      if (index === 0) return true
      const previous = wallPath[index - 1]
      return Math.abs(cell.i - previous.i) + Math.abs(cell.j - previous.j) === 1
    })
  )
})

test('selects straight, corner, and endpoint wall frames', () => {
  assert.equal(getWallFrame(true, false), 1)
  assert.equal(getWallFrame(false, true), 0)
  assert.equal(getWallFrame(true, true), 2)
  assert.equal(getWallFrame(true, false, true), 2)
  assert.equal(getWallFrame(false, true, true), 2)
})
