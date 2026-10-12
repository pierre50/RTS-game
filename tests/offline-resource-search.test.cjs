const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { OfflineWorldSpatial } = loadTsModule('app/services/world/offline/OfflineWorldSpatial.ts')
const { OfflineResourceIndex } = loadTsModule('app/services/world/offline/OfflineResourceSearch.ts')

test('local index avoids remote records and reflects additions and depletion', () => {
  const index = new OfflineResourceIndex()
  for (let n = 0; n < 20000; n++) index.add({ type: 'GroundStone', i: 1000 + n, j: 1000 })
  const near = { type: 'GroundStone', i: 10, j: 11 }
  index.add(near)
  let visited = 0
  const query = () =>
    index.nearest(
      { i: 10, j: 10 },
      { i: 10, j: 10, radius: 30 },
      () => {
        visited++
        return true
      },
      3
    )
  assert.deepEqual(query(), [near])
  assert.equal(visited, 1)
  index.delete(near)
  assert.deepEqual(query(), [])
  index.add(near)
  assert.deepEqual(query(), [near])
})

test('approach tries the next pickup when the nearest is enclosed, and charges for detours', () => {
  const unit = { type: 'Villager', label: 'worker', i: 5, j: 5 }
  const trapped = { type: 'GroundWood', i: 8, j: 5 }
  const open = { type: 'GroundWood', i: 5, j: 11 }
  const walls = []
  for (let di = -1; di <= 1; di++)
    for (let dj = -1; dj <= 1; dj++) if (di || dj) walls.push({ type: 'Tree', i: 8 + di, j: 5 + dj })
  for (let i = 2; i <= 8; i++) walls.push({ type: 'Tree', i, j: 8 })
  const terrain = Array.from({ length: 30 }, () => Array.from({ length: 30 }, () => ({ category: 'Land' })))
  const state = { resources: [trapped, open, ...walls], animals: [], players: [{ units: [unit], buildings: [] }] }
  const spatial = new OfflineWorldSpatial(terrain, state, () => 1, { traceConnectivity: false })
  const area = { i: 5, j: 5, radius: 20 }
  const route = spatial.resourceApproach(unit, [trapped, open], area)
  assert.equal(route.target, open)
  assert.ok(route.steps > 6)
  assert.deepEqual({ i: route.point.i, j: route.point.j }, { i: open.i, j: open.j })
  spatial.release(open)
  state.resources.splice(state.resources.indexOf(open), 1)
  assert.ok(!spatial.nearestResources(unit, area, r => r.type === 'GroundWood').includes(open))
})
