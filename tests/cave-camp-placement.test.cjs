const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const { planCaves } = require('../tools/caves/placement.cjs')
const { connectingCells, isClearing, MAP_PADDING } = require('../tools/caves/sites.cjs')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { decodeMapBlueprintPayload } = loadTsModule('app/serialization/MapBlueprintDecoding.ts')

function map(campCount = 1) {
  return {
    size: 95,
    seed: 42,
    terrain: Array.from({ length: 96 }, () => Array(96).fill('Dirt')),
    relief: Array.from({ length: 96 }, () => Array(96).fill(0)),
    banditCampPositions: Array.from({ length: campCount }, (_, i) => ({ i: 10 + i * 20, j: 10 })),
    settlements: Array.from({ length: campCount }, (_, i) => ({
      id: `camp-${i}`,
      kind: 'banditCamp',
      local: { i: 10, j: 10 },
    })),
    resources: Array.from({ length: 96 * 96 }, (_, index) => ({
      i: Math.floor(index / 96),
      j: index % 96,
      type: 'Tree',
    })),
  }
}
function verify(blueprint, cave) {
  const occupied = new Set(blueprint.resources.map(cell => `${cell.i}:${cell.j}`))
  assert.ok(cave.i >= MAP_PADDING && cave.j >= MAP_PADDING)
  assert.ok(cave.i <= blueprint.size - MAP_PADDING && cave.j <= blueprint.size - MAP_PADDING)
  for (const resource of blueprint.resources) assert.ok(!isClearing(resource, cave))
  for (const camp of blueprint.banditCampPositions) {
    assert.equal(camp.caveId, cave.id)
    const distance = Math.hypot(camp.i - cave.i - 1, camp.j - cave.j - 2)
    assert.ok(distance >= 3 && distance <= 5)
    for (const cell of connectingCells(cave, camp)) {
      assert.ok(!occupied.has(`${cell.i}:${cell.j}`))
      assert.notEqual(blueprint.terrain[cell.i]?.[cell.j], 'Water')
      assert.equal(blueprint.relief[cell.i][cell.j], blueprint.relief[cave.i][cave.j])
    }
    assert.ok(!blueprint.resources.some(cell => isClearing(cell, camp)))
  }
}
test('one cave serves all planned camps with clearing, border padding and a walkable connection', () => {
  for (const count of [0, 1, 3]) {
    const blueprint = map(count)
    const [cave] = planCaves(blueprint)
    assert.ok(cave)
    assert.equal(blueprint.banditCampPositions.length, count)
    verify(blueprint, cave)
    blueprint.settlements.forEach((settlement, index) =>
      assert.deepEqual(settlement.local, blueprint.banditCampPositions[index])
    )
    const before = structuredClone(blueprint)
    blueprint.caves = [cave]
    assert.deepEqual(planCaves(blueprint), [cave])
    assert.deepEqual(blueprint.resources, before.resources)
  }
})
test('an impossible camp/cave pairing rejects the map instead of leaving an isolated camp', () => {
  const blueprint = map()
  blueprint.terrain.forEach(row => row.fill('Water'))
  assert.throws(
    () => planCaves(blueprint),
    error => error.code === 'CAVE_PLACEMENT_FAILED'
  )
})
test('all shipped caves respect padding and every bandit camp is linked to one', async () => {
  const root = path.join(__dirname, '../public/maps/worlds/world-4242')
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')))
  let camps = 0,
    caves = 0
  for (const entry of manifest.maps) {
    const payload = JSON.parse(fs.readFileSync(path.join(root, 'maps', entry.path)))
    const blueprint = await decodeMapBlueprintPayload(payload, entry, {})
    for (const cave of blueprint.caves) {
      caves++
      verify(blueprint, cave)
      const { columns, rows } = blueprint.localGridLayout
      const row = cave.i + cave.j - columns + 1
      const column = cave.i - Math.ceil(row / 2) + (row % 2) / 2
      assert.ok(Math.min(column * 2, (columns - 1 - column) * 2, row / 2, (rows - 1 - row) / 2) >= MAP_PADDING)
    }
    camps += blueprint.banditCampPositions.length
    assert.ok(!blueprint.banditCampPositions.length || blueprint.caves.length === 1)
  }
  assert.equal(caves, 22)
  assert.equal(camps, 8)
})
