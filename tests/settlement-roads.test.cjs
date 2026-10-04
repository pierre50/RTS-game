const test = require('node:test')
const assert = require('node:assert/strict')
const { prepareSettlementRoads, roadTerrain } = require('../tools/maps/settlements/settlement-roads.cjs')

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
