const assert = require('node:assert/strict')
const test = require('node:test')
const { planGroundResources } = require('../tools/maps/add-ground-resources.cjs')

test('published scatter respects prepared buildings, roads and resources without mutating the world', () => {
  const width = 96
  const resources = []
  for (let i = 8; i < 88; i += 6) for (let j = 8; j < 88; j += 6) resources.push({ type: 'Tree', i, j, quantity: 100 })
  const blueprint = {
    version: 2,
    size: width - 1,
    seed: 4321,
    terrain: Buffer.alloc(width * width).toString('base64'),
    relief: Buffer.alloc(width * width).toString('base64'),
    resources: [],
  }
  const prepared = {
    resources,
    animals: [],
    heroSpawns: [{ i: 30, j: 30 }],
    players: [{ units: [{ i: 31, j: 30 }], buildings: [{ type: 'House', size: 3, i: 40, j: 40 }] }],
    roads: { cells: Array.from({ length: width }, (_, j) => [50 * width + j]) },
  }
  const before = JSON.stringify({ blueprint, prepared })
  const additions = planGroundResources(blueprint, prepared)
  assert.equal(JSON.stringify({ blueprint, prepared }), before)
  assert.deepEqual(planGroundResources(blueprint, prepared), additions)
  for (const type of ['GroundWood', 'GroundStone']) assert.ok(additions.some(r => r.type === type))
  assert.deepEqual(
    planGroundResources(
      { ...blueprint, resources: [...blueprint.resources, ...additions] },
      { ...prepared, resources: [...prepared.resources, ...additions] }
    ),
    additions
  )
  const occupied = new Set(
    [...resources, ...prepared.heroSpawns, ...prepared.players[0].units].map(r => `${r.i}:${r.j}`)
  )
  for (const resource of additions) {
    assert.ok(!occupied.has(`${resource.i}:${resource.j}`))
    assert.notEqual(resource.i, 50)
    assert.ok(Math.abs(resource.i - 40) > 4 || Math.abs(resource.j - 40) > 4)
    assert.equal(resource.quantity, 1)
    occupied.add(`${resource.i}:${resource.j}`)
  }
})
