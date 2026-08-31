const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadVisionGrid() {
  const filename = path.join(__dirname, '../app/services/VisionGrid.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  new Function('module', 'exports', 'require', code)(module, module.exports, require)
  return module.exports.VisionGrid
}

const VisionGrid = loadVisionGrid()

test('stores explored cells compactly and notifies only on first discovery', () => {
  const discovered = []
  const grid = new VisionGrid(511, [], (i, j) => discovered.push([i, j]))

  assert.equal(grid.length, 512 * 512)
  assert.equal(grid.explored.byteLength, 512 * 512)
  assert.equal(grid.setViewed(511, 511), true)
  assert.equal(grid.setViewed(511, 511), false)
  assert.deepEqual(discovered, [[511, 511]])
})

test('keeps overlapping viewers until the last contributor leaves', () => {
  const grid = new VisionGrid(8)
  const scout = { label: 'scout' }
  const tower = { label: 'tower' }

  grid.addViewer(4, 4, scout)
  grid.addViewer(4, 4, tower)
  assert.equal(grid.isVisible(4, 4), true)
  assert.equal(grid.visibleCount[grid.index(4, 4)], 2)

  grid.removeViewer(4, 4, scout)
  assert.equal(grid.isVisible(4, 4), true)
  grid.removeViewer(4, 4, tower)
  assert.equal(grid.isVisible(4, 4), false)
  assert.equal(grid.visibleBy.size, 0)
})

test('notifies visibility changes when viewers enter or leave a cell', () => {
  const changes = []
  const grid = new VisionGrid(8, [], null, false, (i, j) => changes.push([i, j]))
  const scout = { label: 'scout' }
  const tower = { label: 'tower' }

  assert.equal(grid.addViewer(4, 4, scout), true)
  assert.equal(grid.addViewer(4, 4, scout), false)
  assert.equal(grid.addViewer(4, 4, tower), true)
  assert.equal(grid.removeViewer(4, 4, scout), true)
  assert.equal(grid.removeViewer(4, 4, scout), false)
  assert.equal(grid.removeViewer(4, 4, tower), true)

  assert.deepEqual(changes, [
    [4, 4],
    [4, 4],
    [4, 4],
    [4, 4],
  ])
})

test('keeps explored and visible cells separate per runtime map space', () => {
  const grid = new VisionGrid(8)
  const scout = { label: 'scout' }

  grid.withSpace('interior:house', () => {
    assert.equal(grid.setViewed(2, 2), true)
    assert.equal(grid.addViewer(2, 2, scout), true)
  })

  assert.equal(grid.isViewed(2, 2), false)
  assert.equal(grid.isVisible(2, 2), false)
  assert.equal(grid.withSpace('interior:house', () => grid.isViewed(2, 2)), true)
  assert.equal(grid.withSpace('interior:house', () => grid.isVisible(2, 2)), true)
})

test('round-trips the existing save format and restores entity references', () => {
  const saved = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => ({})))
  saved[1][2] = { viewed: true, viewBy: ['unit-1'] }
  const grid = new VisionGrid(2, saved)
  const unit = { label: 'unit-1' }

  grid.restoreViewers(label => (label === unit.label ? unit : null))
  assert.equal(grid.hasViewer(1, 2, unit), true)
  assert.deepEqual(grid.toJSON()[1][2], { viewed: true, viewBy: ['unit-1'] })
})
