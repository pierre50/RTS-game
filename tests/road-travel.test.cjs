const assert = require('node:assert/strict')
const test = require('node:test')
const { fixture, planner } = require('./helpers/roadTravelFixture.cjs')
const { roadMap } = require('./helpers/roadTravelFixture.cjs')
function exhaust(search) {
  let steps = 0,
    value = search.next()
  while (!value.done) {
    assert.ok(++steps < 20000)
    value = search.next()
  }
  return { route: value.value, steps }
}
test('a thousand-cell road connects off-road departure and town with cooperative planning', () => {
  const map = roadMap()
  const { route, steps } = exhaust(planner.planRoadRoute({ i: 0, j: 3 }, { i: 1000, j: 20, size: 3 }, map))
  assert.ok(steps > 20, 'planning yields instead of draining a whole search synchronously')
  assert.ok(route.length >= 1000)
  assert.ok(route.some(p => p.i === 500 && p.j === 10))
  assert.ok(Math.hypot(route.at(-1).i - 1000, route.at(-1).j - 20) < 5)
  let previous = { i: 0, j: 3 }
  for (const point of route) {
    assert.ok(Math.hypot(point.i - previous.i, point.j - previous.j) <= Math.SQRT2)
    previous = point
  }
})
test('disconnected roads never produce a jump across the missing connection', () => {
  const map = roadMap(200)
  map.roads.cells[100][1] = 8
  map.roads.cells[101][1] = 2
  assert.equal(exhaust(planner.planRoadRoute({ i: 0, j: 3 }, { i: 200, j: 20 }, map)).route, null)
})
test('blocked closest road access tries another nearby entry', () => {
  const map = roadMap(100)
  map.grid[0][10].solid = true
  const { route } = exhaust(planner.planRoadRoute({ i: 0, j: 9 }, { i: 100, j: 20 }, map))
  assert.ok(route)
  assert.ok(!route.some(p => p.i === 0 && p.j === 10))
})

test('off-screen travel advances by elapsed time, preserves inventory and completes', () => {
  const f = fixture()
  assert.equal(f.api.beginRoadJourney(f.unit, f.town), true)
  assert.equal(f.moves.length, 0, 'issuing the order does not request a synchronous long path')
  for (let n = 0; n < 300 && f.unit.roadJourney; n++) f.tick()
  assert.equal(f.unit.roadJourney, undefined)
  assert.equal(f.unit.i, 99)
  assert.deepEqual(f.unit.inventory, { resources: { tin: 12 } })
  assert.equal(f.suspended.has(f.unit), false)
})
test('camera without a hero still restores detailed movement', () => {
  const f = fixture()
  f.show()
  f.system.start(f.unit, f.town)
  for (let n = 0; n < 50 && !f.moves.length; n++) f.tick(1000)
  assert.ok(f.moves.length)
  assert.ok(f.unit.i <= 20)
  assert.equal(f.suspended.has(f.unit), false)
})
test('distant bandits do not wake a safe traveler', () => {
  const f = fixture()
  f.context.players.push({ type: 'Bandits', units: [{ i: 60, j: 10 }], buildings: [] })
  f.context.controls.heroUnit = { i: 1000, j: 1000 }
  f.system.start(f.unit, f.town)
  f.tick()
  f.tick(86400000)
  f.tick()
  assert.equal(f.unit.i, 99)
  assert.equal(f.unit.roadJourney, undefined)
  assert.equal(f.moves.length, 0)
})
test('cancelling, destroying a destination, and reloading do not strand suspended units', () => {
  const f = fixture()
  f.system.start(f.unit, f.town)
  for (let n = 0; n < 5; n++) f.tick()
  const saved = JSON.parse(JSON.stringify({ i: f.unit.i, j: f.unit.j, roadJourney: f.unit.roadJourney }))
  f.api.cancelRoadJourney(f.unit)
  assert.equal(f.suspended.has(f.unit), false)
  const stoppedAt = f.unit.i
  f.tick()
  assert.equal(f.unit.i, stoppedAt)
  Object.assign(f.unit, saved)
  for (let n = 0; n < 5; n++) f.tick()
  assert.ok(f.unit.i > saved.i)
  f.town.isDestroyed = true
  f.tick()
  assert.equal(f.unit.roadJourney, undefined)
  assert.equal(f.suspended.has(f.unit), false)
  f.system.destroy()
})

test('visible local legs resume the route instead of losing the final destination', () => {
  const f = fixture()
  f.show()
  f.unit.i = 30
  f.system.start(f.unit, f.town)
  for (let n = 0; n < 100 && f.unit.roadJourney; n++) {
    f.tick()
    if (f.unit.path.length) {
      const point = f.unit.path[0]
      assert.ok(Math.hypot(point.i - f.unit.i, point.j - f.unit.j) <= 8)
      Object.assign(f.unit, { i: point.i, j: point.j, path: [], dest: null })
    }
  }
  assert.equal(f.unit.i, 99)
  assert.equal(f.unit.roadJourney, undefined)
})

test('distant travel ignores intermediate occupancy but lands on a free cell', () => {
  const f = fixture()
  f.context.controls.heroUnit = { i: 1000, j: 1000 }
  f.context.map.grid[5][10].solid = true
  f.context.map.grid[99][10].solid = true
  f.system.start(f.unit, f.town)
  f.tick()
  f.tick(86400000)
  assert.equal(f.unit.i, 98)
  assert.ok(f.unit.roadJourney)
  assert.equal(f.moves.length, 0)
  f.context.map.grid[99][10].solid = false
  f.tick()
  f.tick()
  assert.equal(f.unit.i, 99)
  assert.equal(f.unit.roadJourney, undefined)
})

test('pausing the simulation clock cannot advance a journey', () => {
  const f = fixture()
  f.system.start(f.unit, f.town)
  for (let n = 0; n < 5; n++) f.tick()
  const position = f.unit.i
  for (let n = 0; n < 20; n++) f.tick(0)
  assert.equal(f.unit.i, position)
})

test('a briefly occupied visible waypoint must not cancel the trip after 250ms', () => {
  const f = fixture()
  f.show()
  f.unit.i = 30
  f.context.map.grid[38][10].solid = true
  f.system.start(f.unit, f.town)
  for (let n = 0; n < 12; n++) f.tick(50)
  assert.ok(f.unit.roadJourney, 'a busy waypoint is not an unreachable town')
  assert.equal(f.messages.length, 0)
  assert.ok(f.moves.length, 'chooses another nearby waypoint')
})

test('towns more than 64 cells away from a road still use the network', () => {
  const map = roadMap(200)
  map.grid = Array.from({ length: 201 }, (_, i) => Array.from({ length: 101 }, (_, j) => ({ i, j, solid: false })))
  const route = exhaust(planner.planRoadRoute({ i: 0, j: 3 }, { i: 200, j: 90 }, map)).route
  assert.ok(route)
  assert.ok(route.some(point => point.i === 100 && point.j === 10))
})

test('crossing a busy town waits several seconds and resumes when the passage clears', () => {
  const f = fixture()
  f.show()
  f.unit.i = 30
  for (let i = 31; i <= 38; i++) f.context.map.grid[i][10].solid = true
  f.system.start(f.unit, f.town)
  for (let n = 0; n < 100; n++) f.tick(50)
  assert.ok(f.unit.roadJourney)
  assert.equal(f.messages.length, 0)
  assert.equal(f.moves.length, 0)
  for (let i = 31; i <= 38; i++) f.context.map.grid[i][10].solid = false
  for (let n = 0; n < 25; n++) f.tick(50)
  assert.ok(f.moves.length)
  assert.ok(f.unit.roadJourney)
})

test('town approach searches other sides when its closest arrival cell is enclosed', () => {
  const map = roadMap(100)
  for (let i = 97; i <= 99; i++)
    for (let j = 9; j <= 11; j++) {
      if (i !== 98 || j !== 10) map.grid[i][j].solid = true
    }
  const { route } = exhaust(planner.planTownApproach({ i: 0, j: 10 }, { i: 100, j: 10, size: 1 }, map))
  assert.ok(route)
  assert.notDeepEqual(route.at(-1), { i: 98, j: 10 })
})

test('town approach can detour outside the old ten-cell search margin', () => {
  const map = roadMap(100)
  map.grid = Array.from({ length: 101 }, (_, i) =>
    Array.from({ length: 70 }, (_, j) => ({ i, j, solid: i === 45 && j < 45 }))
  )
  const { route } = exhaust(planner.planTownApproach({ i: 0, j: 10 }, { i: 100, j: 10, size: 1 }, map))
  assert.ok(route)
  assert.ok(route.some(point => point.j >= 45))
})

test('AI transfers use the same travel and join the destination village on arrival', () => {
  const f = fixture()
  f.owner.isPlayed = false
  f.owner.label = 'ai'
  f.context.controls.heroUnit = { i: 1000, j: 1000 }
  assert.equal(f.system.start(f.unit, f.town), true)
  f.tick()
  f.tick(86400000)
  f.tick()
  assert.equal(f.unit.villageHome.id, 'ai:destination')
  assert.equal(f.unit.i, 99)
})
test('a time skip cannot jump across the hero encounter radius', () => {
  const f = fixture()
  f.context.controls.heroUnit = { i: 95, j: 10 }
  f.system.start(f.unit, f.town)
  f.tick()
  for (let n = 0; n < 5; n++) f.tick(86400000)
  assert.ok(f.unit.i < 10)
  assert.ok(f.moves.length)
  assert.equal(f.suspended.has(f.unit), false)
})
test('an engaged combatant cannot disappear into abstract travel', () => {
  const f = fixture()
  f.unit.action = 'attack'
  assert.equal(f.system.start(f.unit, f.town), false)
  assert.equal(f.suspended.has(f.unit), false)
})

test('approaching a remote traveler restores visible movement without losing cargo', () => {
  const f = fixture()
  f.context.controls.heroUnit = { i: 1000, j: 1000 }
  f.system.start(f.unit, f.town)
  f.tick()
  f.tick(1000)
  assert.equal(f.suspended.get(f.unit)?.reason, 'road-travel')
  f.context.controls.heroUnit = { i: f.unit.i + 5, j: f.unit.j }
  f.tick(50)
  assert.equal(f.suspended.has(f.unit), false)
  assert.ok(f.moves.length)
  assert.deepEqual(f.unit.inventory.resources, { tin: 12 })
  assert.ok(f.unit.roadJourney)
})
