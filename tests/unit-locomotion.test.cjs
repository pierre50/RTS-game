const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const locomotion = loadTsModule('app/lib/units/movement/unitLocomotion.ts')

test('a cautious approach slows a unit only until its movement request is cleared', () => {
  const unit = {}
  assert.equal(locomotion.getRequestedMoveSpeedFactor(unit), 1)
  locomotion.requestUnitWalk(unit)
  const walking = locomotion.getRequestedMoveSpeedFactor(unit)
  assert.ok(walking > 0 && walking < 1)
  assert.equal(locomotion.isUnitWalkSpeedFactor(walking), true)
  locomotion.clearRequestedMoveSpeedFactor(unit)
  assert.equal(locomotion.getRequestedMoveSpeedFactor(unit), 1)
  assert.equal(locomotion.isUnitWalkSpeedFactor(1), false)
})

test('walking cannot override an injury slowdown or restart a stopped unit', () => {
  const walk = locomotion.getUnitWalkSpeedFactor(true)
  assert.equal(locomotion.composeMoveSpeedFactor(walk, 0.2), 0.2)
  assert.equal(locomotion.composeMoveSpeedFactor(0, walk), 0)
  assert.equal(locomotion.composeMoveSpeedFactor(locomotion.getUnitWalkSpeedFactor(false), 1), 1)
  assert.equal(locomotion.getRequestedMoveSpeedFactor({ requestedMoveSpeedFactor: -1 }), 0)
  assert.equal(locomotion.getRequestedMoveSpeedFactor({ requestedMoveSpeedFactor: 2 }), 1)
})
