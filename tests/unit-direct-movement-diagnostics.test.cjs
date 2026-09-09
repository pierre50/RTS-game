const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function fixture() {
  const events = []
  const api = loadTsModule('app/classes/unit/movement/UnitDirectMovementDiagnostics.ts', {
    mocks: {
      './UnitMovementDebug': {
        debugBlockedDirectMove: (_unit, reason, detail) => events.push({ reason, detail }),
        debugDirectMoveProbe: (_unit, reason, detail) => events.push({ reason, detail }),
      },
    },
  })
  const unit = { currentCell: { waterBorder: false }, type: 'Hero', family: 'unit', label: 'hero' }
  const attempt = {
    unit,
    heroControlled: true,
    candidateX: 1.234,
    candidateY: 5.678,
    rawI: 1,
    rawJ: 2,
    newI: 1,
    newJ: 2,
    crossingCell: true,
    dirX: 1,
    dirY: 0,
    targetCell: { i: 1, j: 2, x: 1.234, y: 5.678, category: 'Land', waterBorder: false },
  }
  return { ...api, events, attempt, unit }
}

test('border diagnostics stay quiet for ordinary movement and identify occupied water cells', () => {
  const { reportBorderAttempt, events, attempt, unit } = fixture()
  reportBorderAttempt(attempt)
  attempt.heroControlled = false
  attempt.targetCell.category = 'Water'
  reportBorderAttempt(attempt)
  assert.deepEqual(events, [])
  attempt.heroControlled = true
  attempt.targetCell.has = unit
  reportBorderAttempt(attempt)
  assert.equal(events[0].reason, 'hero-border-attempt')
  assert.equal(events[0].detail.target.has.sameObject, true)
  assert.equal(events[0].detail.candidateX, 1.23)
  assert.equal(events[0].detail.target.y, 5.68)
})

test('leaving a water border diagnoses a missing target without throwing', () => {
  const { reportBorderAttempt, events, attempt, unit } = fixture()
  unit.currentCell.waterBorder = true
  delete attempt.targetCell
  reportBorderAttempt(attempt)
  assert.equal(events[0].detail.target, null)
})

test('terrain diagnostics handle absent geometry and preserve rounded collision points', () => {
  const { reportTerrainCollision, events, attempt, unit } = fixture()
  reportTerrainCollision(attempt, { type: 'Water' })
  assert.equal(events[0].detail.terrainBlocker.pointCount, 0)
  assert.equal(events[0].detail.occupant, null)
  attempt.targetCell.has = unit
  reportTerrainCollision(attempt, { type: 'Water', collisionPoints: [{ x: 1.234, y: 5.678 }] })
  assert.deepEqual(events[1].detail.terrainBlocker.points, [{ x: 1.23, y: 5.68 }])
  assert.equal(events[1].detail.occupant.sameObject, true)
})
