const test = require('node:test')
const assert = require('node:assert/strict')
const {
  prepareSettlementRoads,
  roadTerrain,
  validateSettlementRoads,
  clearRoadTrees,
} = require('../tools/maps/settlements/settlement-roads.cjs')

function fixture(size = 60) {
  const terrain = Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => ({ i, j, z: 0, type: 'Grass', category: 'Land' }))
  )
  const prepared = { settlements: [], players: [], resources: [] }
  for (const [id, i, j, profile] of [
    ['a', 8, 8, 'city'],
    ['b', 48, 8, 'village'],
    ['c', 48, 48, 'village'],
    ['post', 8, 48, 'outpost'],
  ]) {
    prepared.settlements.push({ id, ownerLabel: id, profile, civ: 'Hellas', local: { i, j } })
    prepared.players.push({
      label: id,
      buildings: [{ type: profile === 'city' ? 'TownCenter' : 'Granary', size: 3, i, j }],
    })
  }
  return { prepared, terrain }
}
function validate(roads, prepared, terrain) {
  const grid = roadTerrain(prepared, terrain),
    cells = new Map(roads.cells)
  const offsets = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ]
  const anchors = new Map(roads.anchors.map(a => [a.settlementId, grid.index(a)]))
  for (const route of roads.routes) {
    assert.equal(route.cells[0], anchors.get(route.from))
    assert.equal(route.cells.at(-1), anchors.get(route.to))
    for (let k = 0; k < route.cells.length; k++) {
      const id = route.cells[k],
        i = Math.floor(id / roads.stride),
        j = id % roads.stride
      assert.ok(grid.walkable(i, j))
      if (k) {
        const previous = route.cells[k - 1],
          a = Math.floor(previous / roads.stride),
          b = previous % roads.stride
        assert.equal(Math.abs(i - a) + Math.abs(j - b), 1)
        assert.ok(grid.step(a, b, i, j))
      }
      assert.ok(cells.has(id))
    }
  }
  for (const [id, mask] of cells)
    offsets.forEach(([di, dj], bit) => {
      if (!(mask & (1 << bit))) return
      const next = id + di * roads.stride + dj
      assert.ok(cells.get(next) & (1 << (bit + 2) % 4), 'reciprocal atlas connection')
    })
}

test('roads connect city/village entrances, exclude outposts, preserve input and reproduce exactly', () => {
  const { prepared, terrain } = fixture(),
    before = structuredClone(prepared)
  const roads = prepareSettlementRoads(prepared, terrain)
  assert.deepEqual(roads, prepareSettlementRoads(prepared, terrain))
  assert.deepEqual(prepared, before)
  assert.equal(roads.summary.settlements, 3)
  assert.equal(roads.summary.routes, 2)
  assert.equal(roads.summary.components, 1)
  validate(roads, prepared, terrain)
})
test('routes detour around woodland, crops and buildings without deleting resources', () => {
  const { prepared, terrain } = fixture()
  for (let i = 20; i <= 36; i++) for (let j = 4; j <= 18; j++) prepared.resources.push({ type: 'Tree', i, j })
  prepared.resources.push(
    { type: 'Wheat', i: 17, j: 22, label: 'start:a:wheat:0:17:22' },
    { type: 'Wheat', i: 19, j: 24, label: 'start:a:wheat:0:19:24' }
  )
  const roads = prepareSettlementRoads(prepared, terrain)
  const route = roads.routes.find(r => r.from === 'a' || r.to === 'a')
  assert.ok(route.cells.some(id => id % roads.stride > 18 || id % roads.stride < 4))
  assert.ok(!roads.cells.some(([id]) => Math.floor(id / roads.stride) === 18 && id % roads.stride === 23))
  validate(roads, prepared, terrain)
})
test('forest barriers are cleared along the fixed route without removing other resources', () => {
  const { prepared, terrain } = fixture()
  for (let i = 0; i < 60; i++) for (let j = 27; j <= 33; j++) prepared.resources.push({ type: 'Tree', i, j })
  prepared.resources.push({ type: 'Stone', i: 30, j: 20 })
  const before = structuredClone(prepared)
  const roads = prepareSettlementRoads(prepared, terrain)
  assert.equal(roads.components.length, 1, 'trees do not disconnect settlements')
  assert.deepEqual(prepared, before, 'planning preserves the source')
  const fixed = structuredClone(roads)
  const resources = clearRoadTrees(roads, prepared.resources)
  assert.ok(resources.length < prepared.resources.length)
  assert.ok(
    resources.some(resource => resource.type === 'Tree'),
    'preserve forest away from roads'
  )
  assert.deepEqual(
    resources.filter(resource => resource.type !== 'Tree'),
    before.resources.filter(resource => resource.type !== 'Tree')
  )
  assert.deepEqual(roads, fixed, 'clearing does not change the route')
  assert.deepEqual(clearRoadTrees(roads, resources), resources, 'clearing is idempotent')
  validateSettlementRoads(roads, { ...prepared, resources }, terrain)
})

test('water separates networks explicitly; a legal gap reconnects them', () => {
  const { prepared, terrain } = fixture()
  for (const row of terrain) row[30].category = 'Water'
  let roads = prepareSettlementRoads(prepared, terrain)
  assert.equal(roads.summary.components, 2)
  assert.equal(roads.summary.routes, 1)
  validate(roads, prepared, terrain)
  terrain[30][30].category = 'Land'
  roads = prepareSettlementRoads(prepared, terrain)
  assert.equal(roads.summary.components, 1)
  assert.ok(roads.cells.some(([id]) => id === 30 * 60 + 30))
  validate(roads, prepared, terrain)
})
test('cliffs cannot be crossed; a one-level ramp allows access', () => {
  const { prepared, terrain } = fixture()
  for (const row of terrain) for (const cell of row) if (cell.j >= 30) cell.z = 2
  assert.equal(prepareSettlementRoads(prepared, terrain).summary.components, 2)
  terrain[30][30].z = 1
  const roads = prepareSettlementRoads(prepared, terrain)
  assert.equal(roads.summary.components, 1)
  validate(roads, prepared, terrain)
})
test('empty and single-settlement worlds have no phantom road cells', () => {
  const { prepared, terrain } = fixture()
  prepared.settlements = []
  assert.equal(prepareSettlementRoads(prepared, terrain).cells.length, 0)
  prepared.settlements = [{ id: 'a', ownerLabel: 'a', profile: 'city' }]
  const roads = prepareSettlementRoads(prepared, terrain)
  assert.equal(roads.cells.length, 0)
  assert.equal(roads.anchors.length, 1)
})

test('planned routes visit the reserved squares and still reach the actual building doors', () => {
  const { prepared, terrain } = fixture()
  const squares = new Map([
    ['a', { i: 12, j: 16 }],
    ['b', { i: 44, j: 16 }],
    ['c', { i: 44, j: 40 }],
  ])
  const roads = prepareSettlementRoads(prepared, terrain, squares)
  validate(roads, prepared, terrain)
  for (const route of roads.routes)
    for (const site of [route.from, route.to]) {
      const point = squares.get(site)
      assert.ok(route.cells.includes(point.i * roads.stride + point.j))
    }
})

test('roads leave two cells around resources and the entire cave footprint', () => {
  const { prepared, terrain } = fixture()
  prepared.caves = [{ id: 'cave', i: 27, j: 10 }]
  prepared.resources = [
    { type: 'Stone', i: 38, j: 10 },
    { type: 'Tree', i: 38, j: 35 },
  ]
  const before = structuredClone(prepared)
  const roads = prepareSettlementRoads(prepared, terrain)
  assert.equal(roads.summary.components, 1)
  assert.deepEqual(prepared, before)
  for (const [id] of roads.cells) {
    const i = Math.floor(id / roads.stride),
      j = id % roads.stride
    assert.ok(Math.max(Math.abs(i - 27), Math.abs(j - 10)) > 3, '3x3 cave plus two-cell margin')
    for (const resource of prepared.resources)
      assert.ok(Math.max(Math.abs(i - resource.i), Math.abs(j - resource.j)) > 2, 'resource margin')
  }
  validateSettlementRoads(roads, prepared, terrain)
  const [id] = roads.cells[Math.floor(roads.cells.length / 2)]
  const point = { i: Math.floor(id / roads.stride), j: id % roads.stride }
  for (const type of ['resource', 'cave']) {
    const invalid = structuredClone(prepared)
    if (type === 'resource') invalid.resources.push({ type: 'Gold', i: point.i, j: point.j + 2 })
    else invalid.caves.push({ id: 'near-road', i: point.i, j: point.j + 3 })
    assert.throws(() => validateSettlementRoads(roads, invalid, terrain), /road blocked/)
  }
})

test('generation rejects a building whose footprint overlaps a planned road', () => {
  const { prepared, terrain } = fixture()
  const roads = prepareSettlementRoads(prepared, terrain)
  const [id] = roads.cells[Math.floor(roads.cells.length / 2)]
  prepared.players[0].buildings.push({
    type: 'House',
    size: 2,
    i: Math.floor(id / roads.stride) - 1,
    j: (id % roads.stride) - 1,
  })
  assert.throws(() => validateSettlementRoads(roads, prepared, terrain), /road blocked/)
})
