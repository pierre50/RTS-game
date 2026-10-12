const test = require('node:test')
const assert = require('node:assert/strict')
const { planSurfaceTin } = require('../tools/maps/add-surface-tin.cjs')

function fixture() {
  const terrain = Array.from({ length: 41 }, (_, i) =>
    Array.from({ length: 41 }, (_, j) => ({ i, j, category: 'Land', z: 0 }))
  )
  const resources = [15, 20, 25].map(j => ({ type: 'Copper', i: 20, j, quantity: 40 }))
  return {
    terrain,
    blueprint: { size: 40, seed: 50, resources },
    prepared: { resources: structuredClone(resources), players: [], animals: [] },
  }
}

test('surface migration preserves deposits, respects roads and buildings, and is repeatable', () => {
  const { terrain, blueprint, prepared } = fixture()
  prepared.players.push({ buildings: [{ type: 'House', size: 2, i: 17, j: 12 }], units: [] })
  prepared.roads = { cells: Array.from({ length: 41 }, (_, j) => [18 * 41 + j, 0]) }
  const before = structuredClone({ blueprint, prepared })
  const result = planSurfaceTin(blueprint, prepared, terrain)
  assert.equal(result.length, 1)
  assert.equal(result[0].type, 'Tin')
  assert.ok(result[0].quantity >= 30 && result[0].quantity <= 55)
  assert.ok(Math.abs(result[0].i - 18) > 1)
  assert.deepEqual({ blueprint, prepared }, before)
  assert.deepEqual(planSurfaceTin(blueprint, prepared, terrain), result)
  blueprint.resources.push(...result)
  prepared.resources.push(...result)
  assert.deepEqual(planSurfaceTin(blueprint, prepared, terrain), [])
})

test('no tin is placed on water, slopes, or a one-cell land corridor', () => {
  for (const kind of ['water', 'slope', 'corridor']) {
    const { terrain, blueprint, prepared } = fixture()
    for (const row of terrain)
      for (const cell of row) {
        if (kind === 'slope') cell.inclined = true
        else if (kind !== 'corridor' || cell.i !== 20) cell.category = 'Water'
      }
    assert.deepEqual(planSurfaceTin(blueprint, prepared, terrain), [])
  }
})
