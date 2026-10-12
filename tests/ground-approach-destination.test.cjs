const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { canUseResourceApproachCell } = loadTsModule('app/lib/grid/resourceApproachDestination.ts')

test('pickup destination may contain the requested passable object, but not another occupant or a doorway', () => {
  const unit = { label: 'worker' }
  const target = { label: 'wood', type: 'GroundWood' }
  const cell = { i: 10, j: 10, has: target, solid: false }
  const options = { passageLookup: new Set() }
  assert.equal(canUseResourceApproachCell(unit, cell, target, options), true)
  assert.equal(canUseResourceApproachCell(unit, { ...cell, solid: true }, target, options), false)
  assert.equal(canUseResourceApproachCell(unit, { ...cell, has: { label: 'other' } }, target, options), false)
  assert.equal(canUseResourceApproachCell(unit, { ...cell, waterBorder: true }, target, options), false)
  assert.equal(canUseResourceApproachCell(unit, cell, target, { passageLookup: new Set([cell]) }), false)
  assert.equal(canUseResourceApproachCell(unit, { ...cell, has: undefined }, target, options), true)
})
