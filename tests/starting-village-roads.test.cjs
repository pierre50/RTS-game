const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { StartingVillageRoads } = loadTsModule('app/services/world/StartingVillageRoads.ts')

function planner() {
  return new StartingVillageRoads({
    version: 1,
    stride: 100,
    cells: Array.from({ length: 61 }, (_, k) => [(k + 20) * 100 + 50, 10]),
  })
}

test('defenses prefer uncovered approaches and respect the configured attack range', () => {
  const roads = planner()
  const center = { i: 50, j: 50 }
  const entries = roads.entrances(center)
  assert.equal(entries.length, 2)
  const left = { i: 35, j: 46 }
  const right = { i: 65, j: 46 }
  const placed = [{ ...left, type: 'WatchTower' }]
  assert.ok(roads.score(center, right, 'WatchTower', placed, 6) < roads.score(center, left, 'WatchTower', placed, 6))
  assert.ok(roads.score(center, right, 'WatchTower', [], 6) < roads.score(center, right, 'WatchTower', [], 2))
})

test('economic sites keep resource priorities; buildings without nearby roads retain their fallback', () => {
  const roads = planner()
  const center = { i: 50, j: 50 }
  const near = { i: 55, j: 53 },
    far = { i: 55, j: 65 }
  for (const type of ['Market', 'House', 'Forge', 'Barracks', 'ArcheryRange', 'Stable'])
    assert.ok(roads.score(center, near, type, [], 6) < roads.score(center, far, type, [], 6))
  for (const type of ['Granary', 'Farm', 'StoragePit']) assert.equal(roads.score(center, far, type, [], 6), 0)
  const isolated = new StartingVillageRoads({ version: 1, stride: 100, cells: [] })
  assert.equal(isolated.score(center, near, 'WatchTower', [], 6), 0)
  assert.equal(isolated.militarySite(center, far), far)
})
