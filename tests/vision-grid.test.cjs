const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { VisionGrid } = loadTsModule('app/services/VisionGrid.ts')

test('stores explored cells compactly and notifies only on first discovery', () => {
  const discovered = []
  const grid = new VisionGrid(511, [], (i, j) => discovered.push([i, j]))

  assert.equal(grid.length, 512 * 512)
  assert.equal(grid.toJSON().explored.length, 0)
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
  assert.equal(grid.getViewers(4, 4).size, 2)

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
  assert.equal(
    grid.withSpace('interior:house', () => grid.isViewed(2, 2)),
    true
  )
  assert.equal(
    grid.withSpace('interior:house', () => grid.isVisible(2, 2)),
    true
  )
})

test('round-trips the existing save format and restores entity references', () => {
  const saved = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => ({})))
  saved[1][2] = { viewed: true, viewBy: ['unit-1'] }
  const grid = new VisionGrid(2, saved)
  const unit = { label: 'unit-1' }

  grid.restoreViewers(label => (label === unit.label ? unit : null))
  assert.equal(grid.hasViewer(1, 2, unit), true)
  const restored = new VisionGrid(2, JSON.parse(JSON.stringify(grid.toJSON())))
  assert.equal(restored.isViewed(1, 2), true)
  assert.deepEqual([...restored.getViewers(1, 2)], ['unit-1'])
})

test('million-cell sparse exploration saves only changed chunks without scanning the dense grid', () => {
  const grid = new VisionGrid(1500)
  grid.setViewed(0, 0)
  grid.setViewed(1500, 1500)
  // Saving must not read the dense buffers or query every cell.
  grid.isViewed = () => assert.fail('dense exploration scan')
  grid.getViewers = () => assert.fail('dense visibility scan')
  const saved = grid.toJSON()
  assert.equal(saved.explored.length, 2)
  assert.ok(JSON.stringify(saved).length < 1600)
  const restored = new VisionGrid(1500, saved)
  assert.equal(restored.isViewed(0, 0), true)
  assert.equal(restored.isViewed(1500, 1500), true)
  assert.equal(restored.isViewed(1499, 1500), false)
})

test('saved snapshots remain immutable across discovery, clearing and interior changes', () => {
  const grid = new VisionGrid(128)
  grid.setViewed(63, 64)
  const first = grid.toJSON()
  const json = JSON.stringify(first)
  grid.setViewed(64, 63)
  grid.withSpace('inside', () => {
    grid.setViewed(100, 100)
    grid.clearExploration()
  })
  const second = grid.toJSON()
  assert.equal(first.explored.length, 1)
  assert.equal(second.explored.length, 2)
  grid.setViewed(63, 64, false)
  assert.equal(grid.toJSON().explored.length, 1)
  grid.clearExploration()
  assert.equal(grid.toJSON().explored.length, 0)
  assert.equal(JSON.stringify(first), json)
})

test('full reveal handles partial edge chunks and sparse viewer references round trip', () => {
  const grid = new VisionGrid(65, [], null, true)
  grid.addViewer(65, 65, { label: 'hero' })
  const saved = grid.toJSON()
  assert.equal(saved.explored.length, 4)
  const restored = new VisionGrid(65, saved)
  for (let i = 0; i <= 65; i++) for (let j = 0; j <= 65; j++) assert.equal(restored.isViewed(i, j), true)
  assert.equal(restored.isVisible(65, 65), true)
  restored.restoreViewers(() => null)
  assert.equal(restored.isVisible(65, 65), false)
})

test('compact save validation rejects malformed chunks, dimensions and viewer positions', () => {
  const { validatePlayerViews } = loadTsModule('app/serialization/SaveViewValidation.ts')
  const grid = new VisionGrid(64)
  grid.setViewed(64, 64)
  const valid = grid.toJSON()
  validatePlayerViews(valid, 0, 65)
  for (const mutate of [
    x => {
      x.version = 2
    },
    x => {
      x.stride = 66
    },
    x => {
      x.chunkSize = 32
    },
    x => {
      x.explored[0].bits = 'bad'
    },
    x => {
      x.explored.push(x.explored[0])
    },
    x => {
      x.explored[0].i = 2
    },
    x => {
      const bytes = Buffer.alloc(512)
      bytes[0] = 2
      x.explored[0].bits = bytes.toString('base64')
    },
    x => {
      x.visible = [{ index: 65 * 65, viewBy: ['hero'] }]
    },
    x => {
      x.visible = [{ index: 0, viewBy: [123] }]
    },
  ]) {
    const bad = structuredClone(valid)
    mutate(bad)
    assert.throws(() => validatePlayerViews(bad, 0, 65), /Invalid save/)
  }
})

test('large worlds and interiors allocate exploration only for discovered chunks', () => {
  const grid = new VisionGrid(7500)
  assert.deepEqual(grid.toJSON().explored, [])
  grid.setViewed(7500, 7500)
  grid.withSpace('interior:one', () => grid.setViewed(1, 2))
  assert.equal(grid.toJSON().explored.length, 1)
  assert.equal(grid.withSpace('interior:one', () => grid.toJSON().explored.length), 1)
  assert.equal(grid.isViewed(1, 2), false)
  const restored = new VisionGrid(7500, grid.toJSON())
  assert.equal(restored.isViewed(7500, 7500), true)
  assert.equal(restored.isViewed(7499, 7500), false)
  restored.clearExploration()
  assert.equal(restored.isViewed(7500, 7500), false)
})

test('full reveal remains revealed when loading partially explored saved chunks', () => {
  const partial = new VisionGrid(64)
  partial.setViewed(0, 0)
  const revealed = new VisionGrid(64, partial.toJSON(), null, true)
  assert.equal(revealed.isViewed(0, 1), true)
  assert.equal(revealed.isViewed(64, 64), true)
})
