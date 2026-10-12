const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { clusterMinimapUnits } = loadTsModule('app/ui/minimap/MinimapUnitClusters.ts')

test('nearby villagers form a counted group at their center, including across bucket boundaries', () => {
  const points = Array.from({ length: 10 }, (_, index) => ({ x: 15.5 + index / 10, y: 16, selected: index === 7 }))
  const groups = clusterMinimapUnits(points, 16)
  assert.equal(groups.length, 1)
  assert.equal(groups[0].count, 10)
  assert.ok(Math.abs(groups[0].x - 15.95) < 1e-10)
  assert.equal(groups[0].y, 16)
  assert.equal(groups[0].selected, true)
  assert.equal(points[0].x, 15.5)
})

test('zoom separates groups and isolated villagers remain single markers', () => {
  const points = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 60, y: 0 },
  ]
  assert.deepEqual(
    clusterMinimapUnits(points, 16).map(group => group.count),
    [2, 1]
  )
  assert.deepEqual(
    clusterMinimapUnits(
      points.map(point => ({ x: point.x * 4, y: point.y })),
      16
    ).map(group => group.count),
    [1, 1, 1]
  )
  assert.deepEqual(clusterMinimapUnits([], 16), [])
})

test('a chain of villagers does not merge distant crowds into one group', () => {
  const groups = clusterMinimapUnits(
    Array.from({ length: 100 }, (_, index) => ({ x: index * 10, y: 0 })),
    16
  )
  assert.equal(
    groups.reduce((count, group) => count + group.count, 0),
    100
  )
  assert.ok(groups.every(group => group.count <= 2))
})
