const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { moveTowardPoint } = loadTsModule('app/lib/grid/movement.ts', {
  mocks: { '../../services/Pathfinding': {}, './cells': {}, '../mapSpaces': {} },
})

test('movement completes the final fraction of a pixel at the logged villager position', () => {
  const unit = { x: 831.9759936860727, y: 4288.891324916973 }
  moveTowardPoint(unit, 832, 4288, 0.5)
  assert.ok(Math.hypot(832 - unit.x, 4288 - unit.y) < 0.4)
  moveTowardPoint(unit, 832, 4288, 0.5)
  assert.equal(unit.x, 832)
  assert.equal(unit.y, 4288)
})

test('movement respects its budget and never overshoots the target', () => {
  const unit = { x: 0, y: 0 }
  moveTowardPoint(unit, 1, 1, 1)
  assert.ok(Math.abs(Math.hypot(unit.x, unit.y) - 1) < 1e-12)
  moveTowardPoint(unit, 1, 1, 10)
  assert.equal(unit.x, 1)
  assert.equal(unit.y, 1)
  const arrived = { ...unit }
  moveTowardPoint(unit, 1, 1, 10)
  assert.deepEqual(unit, arrived)
})
