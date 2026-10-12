const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { selectStartingFieldSites } = loadTsModule('app/services/world/startingState/StartingFieldSites.ts')

test('field planning avoids a greedy center that blocks both viable patches', () => {
  const sites = [
    { i: 2, j: 0 },
    { i: 0, j: 0 },
    { i: 4, j: 0 },
  ]
  const before = structuredClone(sites)
  assert.deepEqual(selectStartingFieldSites(sites, 3, 2), [sites[1], sites[2]])
  assert.deepEqual(sites, before)
})

test('field planning rejects overlapping patches and accepts edge-adjacent patches', () => {
  assert.equal(
    selectStartingFieldSites(
      [
        { i: 0, j: 0 },
        { i: 2, j: 2 },
      ],
      3,
      2
    ),
    null
  )
  assert.deepEqual(
    selectStartingFieldSites(
      [
        { i: 0, j: 0 },
        { i: 3, j: 0 },
      ],
      3,
      2
    ),
    [
      { i: 0, j: 0 },
      { i: 3, j: 0 },
    ]
  )
  assert.deepEqual(selectStartingFieldSites([], 3, 0), [])
  assert.equal(selectStartingFieldSites([], 3, 1), null)
})

test('field planning rejects dense sites with insufficient total land', () => {
  const sites = Array.from({ length: 49 }, (_, index) => ({ i: index % 7, j: Math.floor(index / 7) }))
  assert.equal(selectStartingFieldSites(sites, 3, 20), null)
})
