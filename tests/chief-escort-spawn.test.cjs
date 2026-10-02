const assert = require('node:assert/strict')
const test = require('node:test')
const { distributeSettlementUnits } = require('../tools/maps/settlements/distribute-settlement-units.cjs')

test('prepared settlements spawn the escort beside its chief, even when infantry precedes him in the roster', () => {
  const owner = {
    type: 'AI',
    label: 'capital',
    settlementType: 'city',
    buildings: [
      { type: 'TownCenter', i: 15, j: 15, size: 3 },
      { type: 'FireCamp', i: 27, j: 27, size: 1 },
    ],
    units: ['Fantassin', 'Fantassin', 'Chief', 'Fantassin'].map((type, index) => ({
      type,
      label: `unit${index}`,
      i: 8 + index,
      j: 8,
    })),
  }
  const terrain = Array.from({ length: 40 }, () => Array.from({ length: 40 }, () => ({ category: 'Land', z: 0 })))
  distributeSettlementUnits({ players: [owner], resources: [], animals: [] }, terrain)
  const chief = owner.units[2]
  for (const guard of owner.units.slice(0, 2)) assert.ok(Math.hypot(guard.i - chief.i, guard.j - chief.j) <= 2)
  assert.equal(new Set(owner.units.map(unit => `${unit.i}:${unit.j}`)).size, 4)
  assert.deepEqual(
    owner.units.map(unit => unit.label),
    ['unit0', 'unit1', 'unit2', 'unit3']
  )
})
