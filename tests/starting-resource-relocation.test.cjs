const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { StartingResourceRelocation } = loadTsModule('app/services/world/StartingResourceRelocation.ts')
const { OfflineWorldSpatial } = loadTsModule('app/services/world/OfflineWorldSpatial.ts')

function fixture() {
  const terrain = Array.from({ length: 101 }, () => Array.from({ length: 101 }, () => ({ type: 'Grass', category: 'Land' })))
  const resources = []
  for (const [i, j] of [[20, 75], [75, 20]]) {
    for (let di = -4; di <= 4; di++) for (let dj = -4; dj <= 4; dj++) {
      if (di * di + dj * dj > 16) continue
      resources.push({ type: 'Tree', i: i + di, j: j + dj, quantity: 100 })
    }
  }
  const moved = Array.from({ length: 40 }, (_, index) => ({
    label: `tree-${index}`, type: 'Tree', i: 47 + index % 7, j: 47 + Math.floor(index / 7), quantity: 123,
  }))
  resources.push(...moved)
  // These otherwise attractive cells must remain bare.
  for (let i = 10; i < 25; i++) for (let j = 60; j < 70; j++) terrain[i][j].type = 'Dirt'
  for (let j = 0; j < 101; j++) terrain[5][j].category = 'Water'
  const spatial = new OfflineWorldSpatial(terrain, { resources, animals: [], players: [] }, () => 1)
  const relocation = new StartingResourceRelocation(resources, terrain, spatial)
  return { moved, resources, terrain, relocation }
}

function relocate(f) {
  for (const resource of f.moved) {
    assert.equal(f.relocation.move(resource, { i: 50, j: 50 }, point => Math.hypot(point.i - 50, point.j - 50) < 12), true)
  }
  return f.moved.map(({ i, j }) => ({ i, j }))
}

test('relocation grows existing forest patches without square-ring rows, loss or invalid terrain', () => {
  const f = fixture()
  const points = relocate(f)
  const nearForest = points.filter(p => Math.min(Math.hypot(p.i - 20, p.j - 75), Math.hypot(p.i - 75, p.j - 20)) <= 12)
  assert.ok(nearForest.length >= 30, `${nearForest.length}/40 trees near original forests`)
  assert.ok(new Set(points.map(p => p.i)).size > 10)
  assert.ok(new Set(points.map(p => p.j)).size > 10)
  assert.equal(new Set(f.resources.map(p => `${p.i}:${p.j}`)).size, f.resources.length)
  assert.ok(f.moved.every(r => r.quantity === 123 && f.terrain[r.i][r.j].type !== 'Dirt' && r.i > 7))
  assert.deepEqual(relocate(fixture()), points, 'the same saved map must yield the same placement')
})

test('deposits retain their generator spacing when free space is available', () => {
  const f = fixture()
  for (const resource of f.moved) resource.type = 'Gold'
  const spatial = new OfflineWorldSpatial(f.terrain, { resources: f.resources, animals: [], players: [] }, () => 1)
  f.relocation = new StartingResourceRelocation(f.resources, f.terrain, spatial)
  const points = relocate(f)
  for (let a = 0; a < points.length; a++) for (let b = a + 1; b < points.length; b++) {
    assert.ok(Math.max(Math.abs(points[a].i - points[b].i), Math.abs(points[a].j - points[b].j)) > 3)
  }
})
