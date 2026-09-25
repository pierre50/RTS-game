const assert = require('node:assert/strict')
const test = require('node:test')
const { planContinentCaves } = require('../tools/caves/continent-placement.cjs')
const catalog = require('../public/maps/interiors/cave/catalog.json')

function continent(size = 399) {
  return { size, terrain: Buffer.alloc((size + 1) ** 2, 0), seed: 4242, id: 'continent' }
}

test('continent caves scale with land area and preserve spacing, safe approaches and stable identities', () => {
  const input = continent()
  input.settlements = [{ local: { i: 200, j: 200 } }]
  const plan = planContinentCaves(input)
  assert.equal(plan.target, 8)
  assert.equal(plan.caves.length, 8)
  assert.deepEqual(planContinentCaves(input), plan)
  assert.notDeepEqual(planContinentCaves({ ...input, seed: 21 }).caves, plan.caves)
  assert.equal(new Set(plan.caves.map(cave => cave.id)).size, 8)
  for (const cave of plan.caves) {
    assert.ok(cave.i >= 18 && cave.i <= input.size - 18)
    assert.ok(cave.j >= 18 && cave.j <= input.size - 18)
    assert.ok(Math.hypot(cave.i - 200, cave.j - 200) >= 40)
    assert.ok(catalog.blueprints.some(blueprint => blueprint.id === cave.blueprintId))
    for (const other of plan.caves) {
      if (other !== cave) assert.ok(Math.hypot(cave.i - other.i, cave.j - other.j) >= 80)
    }
  }
  assert.equal(planContinentCaves({ ...input, cellsPerCave: 40000 }).caves.length, 4)
})

test('water and sparse padding add no caves and unsuitable strips never force entrances', () => {
  const input = continent()
  for (let i = 0; i <= input.size; i++)
    for (let j = 0; j <= input.size; j++) {
      if (j < 100) input.terrain[i * 400 + j] = 255
      else if (j < 200) input.terrain[i * 400 + j] = 2
    }
  const plan = planContinentCaves(input)
  assert.equal(plan.landCells, 80000)
  assert.equal(plan.caves.length, 4)
  for (const cave of plan.caves) assert.ok(cave.j >= 218)
  input.terrain.fill(2)
  assert.equal(planContinentCaves(input).caves.length, 0)
  for (let i = 0; i <= input.size; i++) input.terrain[i * 400 + 200] = 0
  assert.equal(planContinentCaves({ ...input, cellsPerCave: 100 }).caves.length, 0)
  for (const cellsPerCave of [0, -1, NaN, 1.5]) {
    assert.throws(() => planContinentCaves({ ...input, cellsPerCave }), /positive integer/)
  }
})
