const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const { getHuntingAimPoint } = loadTsModule('app/lib/units/hunting.ts')
const { cartesianToIsometric, pointsDistance } = loadTsModule('app/lib/maths.ts')

function makeUnit(overrides = {}) {
  return {
    x: 0,
    y: 0,
    owner: {
      age: 0,
      config: { projectiles: { ArrowCeramic: { speed: 25 } } },
    },
    ...overrides,
  }
}

function makeDeer(overrides = {}) {
  return {
    x: 100,
    y: 0,
    speed: 4,
    ...overrides,
  }
}

test('a stationary prey (no move speed) is aimed at its current position', () => {
  const unit = makeUnit()
  const dest = makeDeer({ speed: 0, path: [{ i: 3, j: 0 }] })

  assert.deepEqual(getHuntingAimPoint(unit, dest), { x: dest.x, y: dest.y })
})

test('a prey with no configured speed at all (undefined, not 0) is aimed at its current position', () => {
  const unit = makeUnit()
  const dest = makeDeer({ speed: undefined, path: [{ i: 3, j: 0 }] })

  assert.deepEqual(getHuntingAimPoint(unit, dest), { x: dest.x, y: dest.y })
})

test('a moving prey with no path is aimed at its current position', () => {
  const unit = makeUnit()
  const dest = makeDeer({ path: undefined })

  assert.deepEqual(getHuntingAimPoint(unit, dest), { x: dest.x, y: dest.y })
})

test('a moving prey with an empty path is aimed at its current position', () => {
  const unit = makeUnit()
  const dest = makeDeer({ path: [] })

  assert.deepEqual(getHuntingAimPoint(unit, dest), { x: dest.x, y: dest.y })
})

test('falls back to the current position when the arrow config has no speed', () => {
  const unit = makeUnit({ owner: { age: 0, config: { projectiles: {} } } })
  const dest = makeDeer({ path: [{ i: 4, j: 0 }] })

  assert.deepEqual(getHuntingAimPoint(unit, dest), { x: dest.x, y: dest.y })
})

test('falls back to the current position when the unit has no owner', () => {
  const unit = makeUnit({ owner: undefined })
  const dest = makeDeer({ path: [{ i: 4, j: 0 }] })

  assert.deepEqual(getHuntingAimPoint(unit, dest), { x: dest.x, y: dest.y })
})

test('leads a walking target along its next waypoint, proportional to the arrow flight time', () => {
  const unit = makeUnit()
  const [waypointX, waypointY] = cartesianToIsometric(4, 0)
  const dest = makeDeer({ path: [{ i: 4, j: 0 }] })

  const arrowSpeed = 25
  const flightTicks = pointsDistance(unit.x, unit.y, dest.x, dest.y) / arrowSpeed
  const segmentDistance = Math.hypot(waypointX - dest.x, waypointY - dest.y)
  const travel = Math.min(dest.speed * flightTicks, segmentDistance)
  const ratio = travel / segmentDistance
  const expected = { x: dest.x + (waypointX - dest.x) * ratio, y: dest.y + (waypointY - dest.y) * ratio }

  assert.deepEqual(getHuntingAimPoint(unit, dest), expected)
})

test('uses runningSpeed instead of the base speed while the prey is fleeing', () => {
  const unit = makeUnit()
  const dest = makeDeer({ movementSheet: 'running', runningSpeed: 20, path: [{ i: 4, j: 0 }] })
  const dest2 = makeDeer({ movementSheet: 'running', runningSpeed: 20, speed: 999, path: [{ i: 4, j: 0 }] })

  // Same runningSpeed, different (ignored) base speed: identical aim point proves runningSpeed won.
  assert.deepEqual(getHuntingAimPoint(unit, dest), getHuntingAimPoint(unit, dest2))
})

test('uses flyingSpeed for an airborne target', () => {
  const unit = makeUnit()
  const dest = makeDeer({ movementSheet: 'flying', flyingSpeed: 30, speed: 0, path: [{ i: 4, j: 0 }] })

  assert.notDeepEqual(getHuntingAimPoint(unit, dest), { x: dest.x, y: dest.y })
})

test('spills the lead across several waypoints once the first segment is used up', () => {
  const unit = makeUnit({ x: -1000, y: 0 })
  const dest = makeDeer({ speed: 40, path: [{ i: 10, j: 0 }, { i: 1, j: 0 }] })

  const [firstX, firstY] = cartesianToIsometric(1, 0)
  const firstSegmentDistance = pointsDistance(dest.x, dest.y, firstX, firstY)
  const result = getHuntingAimPoint(unit, dest)

  // With a huge flight time the lead must run past the first waypoint into the second segment,
  // landing further along than the first waypoint alone.
  assert.ok(pointsDistance(dest.x, dest.y, result.x, result.y) > firstSegmentDistance)
})

test('never extrapolates past the end of the known path', () => {
  const unit = makeUnit({ x: -100000, y: 0 })
  const dest = makeDeer({ speed: 1000, path: [{ i: 1, j: 0 }] })

  const [waypointX, waypointY] = cartesianToIsometric(1, 0)
  assert.deepEqual(getHuntingAimPoint(unit, dest), { x: waypointX, y: waypointY })
})

test('a running target with no configured runningSpeed falls back to the base speed', () => {
  const unit = makeUnit()
  const dest = makeDeer({ movementSheet: 'running', runningSpeed: undefined, path: [{ i: 4, j: 0 }] })

  assert.notDeepEqual(getHuntingAimPoint(unit, dest), { x: dest.x, y: dest.y })
})

test('a flying target with no configured flyingSpeed falls back to the base speed', () => {
  const unit = makeUnit()
  const dest = makeDeer({ movementSheet: 'flying', flyingSpeed: undefined, path: [{ i: 4, j: 0 }] })

  assert.notDeepEqual(getHuntingAimPoint(unit, dest), { x: dest.x, y: dest.y })
})

test('tolerates a hole in the path array instead of throwing', () => {
  const unit = makeUnit()
  const path = [{ i: 4, j: 0 }]
  path[1] = undefined // a defensive guard against a sparse/malformed path entry
  const dest = makeDeer({ path })

  assert.doesNotThrow(() => getHuntingAimPoint(unit, dest))
})

test('stops leading once the flight-time budget runs out, without reaching a later waypoint', () => {
  const unit = makeUnit()
  // Small speed and a short flight time exhaust remainingTravel inside the first segment, so the
  // loop must never touch the second (further away) waypoint.
  const dest = makeDeer({ speed: 1, path: [{ i: 40, j: 0 }, { i: 1, j: 0 }] })

  const [secondX, secondY] = cartesianToIsometric(1, 0)
  const result = getHuntingAimPoint(unit, dest)

  assert.notDeepEqual(result, { x: secondX, y: secondY })
})

test('skips a waypoint sitting on the same spot as the previous one', () => {
  const unit = makeUnit()
  const [startX, startY] = cartesianToIsometric(5, 0)
  const dest = makeDeer({
    x: startX,
    y: startY,
    speed: 40,
    // The trailing waypoint (last array entry, processed first) sits on dest's own current cell —
    // a zero-length first segment that must be skipped instead of dividing by zero.
    path: [
      { i: 9, j: 0 },
      { i: 5, j: 0 },
    ],
  })

  const result = getHuntingAimPoint(unit, dest)
  assert.notDeepEqual(result, { x: dest.x, y: dest.y })
})
