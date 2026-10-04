const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
function fixture() {
  const calls = [],
    debug = []
  const rules = { result: false, blocker: null, points: [], candidate: { candidateX: 1.234, candidateY: 2.345 } }
  const { UnitDirectMovement } = loadTsModule('app/classes/unit/movement/UnitDirectMovement.ts', {
    mocks: {
      '../../../lib/mapSpaces': { getEntitySpaceMapLike: unit => unit.context?.map },
      './UnitDirectMovementCandidate': { getDirectMoveCandidate: () => rules.candidate },
      './UnitDirectMovementStep': {
        attemptDirectMove: (host, ...args) => {
          calls.push(args)
          host.directMoveBlocker = rules.blocker
          return typeof rules.result === 'function' ? rules.result(...args) : rules.result
        },
      },
      './UnitHeroDirectMovementCollision': {
        blocksHeroDirectMoveWithRoundedFootprint: blocker => blocker.rounded,
        blocksHeroDirectMoveWithSoftBody: blocker => blocker.soft,
        getHeroCollisionFootprintPoints: () => rules.points,
      },
      './UnitMovementDebug': {
        debugBlockedDirectMove: (_u, reason, details) => debug.push({ reason, details }),
        serializeDirectMoveDebugCell: cell => cell,
      },
      './UnitMovementHelpers': { SLIDE_PROBE_ANGLES: [Math.PI / 4] },
    },
  })
  const unit = { x: 0, y: 0, sprite: {}, context: { map: {} } }
  return { movement: new UnitDirectMovement(unit), unit, rules, calls, debug }
}
test('direct movement requires a map, sprite, nonzero direction and positive distance', () => {
  const { movement, unit, rules, calls, debug } = fixture()
  assert.equal(movement.moveDirect(0, 0, 1), false)
  assert.equal(movement.moveDirect(1, 0, 0), false)
  delete unit.sprite
  assert.equal(movement.moveDirect(1, 0, 1), false)
  unit.sprite = {}
  delete unit.context
  assert.equal(movement.moveDirect(1, 0, 1), false)
  assert.equal(movement.getDirectMoveCandidateDebug(1, 0, 1), null)
  assert.equal(calls.length, 0)
  assert.ok(debug.every(row => row.reason === 'precondition'))
  unit.context = { map: {} }
  rules.result = true
  movement.slideBias = -1
  assert.equal(movement.moveDirect(1, 0, 2, { facingDirX: 0, facingDirY: -1 }), true)
  assert.deepEqual(calls[0], [1, 0, 2, 0, -1])
  assert.equal(movement.slideBias, 0)
})
test('terrain probes retain a successful side and never cross a hard entity blocker', () => {
  const { movement, rules, calls, debug } = fixture()
  rules.blocker = { family: 'terrain' }
  movement.slideBias = -1
  rules.result = (_x, y) => y < 0
  assert.equal(movement.moveDirect(1, 0, 1), true)
  assert.equal(movement.slideBias, -1)
  rules.result = false
  rules.blocker = { family: 'building', collisionPoints: [1, 2] }
  calls.length = 0
  assert.equal(movement.moveDirect(1, 0, 1), false)
  assert.equal(calls.length, 1)
  assert.equal(debug.at(-1).details.blocker.pointCount, 2)
  for (const blocker of [null, { family: 'terrain' }]) {
    rules.blocker = blocker
    calls.length = 0
    assert.equal(movement.moveDirect(1, 0, 1), false)
    assert.equal(calls.length, 3)
    assert.equal(debug.at(-1).reason, 'all-direct-probes-failed')
  }
})
test('rounded collision slides follow the nearest usable edge and preserve facing', () => {
  const { movement, rules, calls } = fixture()
  for (const points of [[], [null], [{ x: 0, y: 0 }]]) {
    rules.points = points
    assert.equal(movement.attemptSlideAlongRoundedFootprint({}, 1, 0, 1), false)
  }
  rules.points = [
    { x: -1, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: 3 },
  ]
  assert.equal(movement.attemptSlideAlongRoundedFootprint({}, 1, 0, 2), false)
  rules.result = true
  assert.equal(movement.attemptSlideAlongRoundedFootprint({}, -1, 0, 2), true)
  assert.equal(movement.slideBias, -1)
  assert.deepEqual(calls.at(-1).slice(2), [2, -1, 0])
})
test('soft collision slides handle overlap, both sides and movement away from the blocker', () => {
  const { movement, rules, calls } = fixture()
  assert.equal(movement.attemptSlideAroundSoftBody({}, 1, 0, 1), false)
  const blocker = { x: 1, y: 0 }
  assert.equal(movement.attemptSlideAroundSoftBody(blocker, 1, 0, 1), false)
  assert.equal(calls.length, 2)
  rules.result = true
  assert.equal(movement.attemptSlideAroundSoftBody(blocker, -1, 1, 2), true)
  assert.equal(calls.at(-1)[2], 1.5)
  movement.slideBias = 1
  assert.equal(movement.attemptSlideAroundSoftBody(blocker, 1, -1, 2), true)
  assert.equal(movement.slideBias, 1)
})
test('direct-move diagnostics preserve empty, occupied and self-occupied candidate cells', () => {
  const { movement, rules, unit } = fixture()
  assert.equal(movement.getDirectMoveCandidateDebug(1, 0, 1).cell, null)
  for (const has of [null, { family: 'building', label: 'wall' }, unit]) {
    rules.candidate.targetCell = { i: 1, j: 2, x: 1.234, y: 2.345, has }
    const snapshot = movement.getDirectMoveCandidateDebug(1, 0, 1)
    assert.equal(snapshot.cell.x, 1.23)
    assert.equal(snapshot.cell.y, 2.35)
    assert.equal(snapshot.cell.has?.sameObject ?? null, has ? has === unit : null)
  }
})
