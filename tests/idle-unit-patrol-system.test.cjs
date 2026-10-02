const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function harness({ types = ['Villager'], buildings = ['House'], ai = false, interior = false } = {}) {
  const calls = [],
    spaces = new Map()
  const owner = {
    type: ai ? 'AI' : 'Human',
    isPlayed: !ai,
    developmentMode: ai ? 'static' : undefined,
    settlementType: 'village',
    units: [],
    buildings: [],
  }
  const grid = Array.from({ length: 81 }, (_, i) =>
    Array.from({ length: 81 }, (_, j) => ({ i, j, z: 0, category: 'Land' }))
  )
  const context = {
    controls: {
      getViewportMetrics: () => ({ visibleLeft: -5000, visibleTop: -5000, visibleWidth: 10000, visibleHeight: 10000 }),
    },
    players: [owner],
    map: { grid, spaces, randomRange: (min, max) => (min === 0 && max === 2 ? (interior ? 0 : 1) : min) },
    dayNight: { state: { hour: 10, minute: 0 } },
    scheduler: { elapsedMs: 0, add: () => 1, remove: id => calls.push(['remove', id]) },
  }
  for (const [index, type] of buildings.entries())
    owner.buildings.push({
      label: `building-${index}`,
      owner,
      type,
      size: 2,
      isBuilt: true,
      i: 40 + index * 5,
      j: 43,
      entry: grid[41 + index * 5][44],
    })
  for (const [index, type] of types.entries())
    owner.units.push({
      label: `unit-${index}`,
      owner,
      context,
      type,
      i: 40,
      j: 40,
      path: [],
      sendTo(cell) {
        this.dest = cell
        calls.push(['walk', this.label, cell])
      },
    })
  const { IdleUnitPatrolSystem } = loadTsModule('app/services/IdleUnitPatrolSystem.ts', {
    mocks: {
      '../lib/units/unitSuspension': { isUnitSuspended: unit => unit.suspended },
      '../lib/units/villageActivity': { isDistantOwner: player => player.distant },
      '../lib/buildings/passageCells': {
        canUnitUseCellAsIdleDestination: (_u, cell) =>
          !cell.solid && !cell.has && !owner.buildings.some(b => b.entry === cell),
        createReservedPassageCellLookup: () => ({ has: () => false }),
      },
      '../lib/buildings/interiors': {
        isBuildingInteriorSupported: b => ['House', 'Market', 'Barracks'].includes(b.type),
        getBuildingInteriorEntryCell: b => b.entry,
      },
      './BuildingInteriorSpaceSystem': {
        ensureRuntimeBuildingInteriorSpace: (_context, building) => {
          const space = {
            id: `interior:${building.label}`,
            building,
            exit: grid[41][44],
            portals: [{ targetSpaceId: 'outside', targetCell: grid[41][44] }],
          }
          spaces.set(space.id, space)
          return space
        },
        getBuildingInteriorSpaceForUnit: unit => spaces.get(unit.spaceId) ?? null,
        routeUnitIntoBuildingInteriorSpaceAndMoveBack: (_context, unit, space) => {
          unit.dest = space.building.entry
          calls.push(['enter', unit.label, space.id])
          return true
        },
        routeUnitOutOfBuildingInteriorSpace: (_context, unit, space) => {
          unit.dest = space.exit
          calls.push(['exit', unit.label])
          return true
        },
      },
    },
  })
  const system = new IdleUnitPatrolSystem(context)
  const tick = (ms = 3000) => {
    context.scheduler.elapsedMs += ms
    system.update()
  }
  const arrive = unit => {
    if (unit.dest) {
      unit.i = unit.dest.i
      unit.j = unit.dest.j
    }
    unit.dest = null
    unit.path = []
  }
  system.update() // Schedule the initial quiet period.
  return { owner, context, system, calls, grid, spaces, tick, arrive }
}

test('an idle player villager visits a building, waits, then resumes; no per-unit timers', () => {
  const h = harness()
  assert.equal(h.calls.length, 0)
  h.tick(30000)
  assert.equal(h.calls[0][0], 'walk')
  assert.ok(Math.hypot(h.calls[0][2].i - 40, h.calls[0][2].j - 43) <= 3)
  h.arrive(h.owner.units[0])
  h.tick()
  h.tick(5000)
  assert.equal(h.calls.length, 1)
  h.tick(20000)
  h.tick(30000)
  assert.equal(h.calls.length, 2)
  h.system.destroy()
  assert.deepEqual(h.calls.at(-1), ['remove', 1])
})
test('without a usable building units wander near a fixed home and never drift away', () => {
  const h = harness({ buildings: [] })
  const unit = h.owner.units[0]
  for (let n = 0; n < 30; n++) {
    h.tick(90000)
    h.arrive(unit)
    h.tick(3000)
    assert.ok(Math.hypot(unit.i - 40, unit.j - 40) <= 6)
  }
  assert.ok(h.calls.some(call => call[0] === 'walk'))
})
test('civilians enter available interiors, pause and leave without changing the hero space', () => {
  const h = harness({ interior: true })
  const unit = h.owner.units[0]
  h.tick(30000)
  assert.equal(h.calls[0][0], 'enter')
  unit.spaceId = h.calls[0][2]
  unit.dest = null
  h.tick()
  h.tick(5000)
  assert.equal(h.calls.length, 1)
  h.tick(20000)
  assert.equal(h.calls[1][0], 'exit')
  assert.equal(h.context.map.activeSpaceId, undefined)
})
test('visits yield to player movement, work, dialogue and danger without cancelling those orders', () => {
  for (const extra of [
    { autonomousJob: 'wood' },
    { lookingAtHero: true },
    { combatMode: 'attack' },
    { followingHero: true },
    { pendingOrder: {} },
  ]) {
    const h = harness()
    h.tick(30000)
    const unit = h.owner.units[0]
    Object.assign(unit, extra)
    h.tick(90000)
    assert.equal(h.calls.length, 1)
    for (const [key, value] of Object.entries(extra)) assert.equal(unit[key], value)
  }
  const h = harness()
  h.tick(30000)
  const unit = h.owner.units[0],
    manual = h.grid[60][60]
  unit.dest = manual
  h.tick(90000)
  assert.equal(unit.dest, manual)
  assert.equal(h.calls.length, 1)
})
test('military prefer guard sites, while RPG AI farmers are left to their own work system', () => {
  const military = harness({ types: ['Fantassin'], buildings: ['House', 'WatchTower'] })
  military.tick(30000)
  const target = military.calls[0][2],
    tower = military.owner.buildings[1]
  assert.ok(Math.hypot(target.i - tower.i, target.j - tower.j) <= 3)
  const ai = harness({ ai: true, types: Array(10).fill('Villager') })
  ai.tick(30000)
  assert.equal(ai.calls[0][1], 'unit-2')
  ai.owner.distant = true
  ai.tick(90000)
  assert.equal(ai.calls.length, 1)
})
test('one route per scan and at most two visitors per building', () => {
  const h = harness({ types: Array(10).fill('Villager') })
  h.tick(30000)
  assert.equal(h.calls.length, 1)
  h.tick()
  assert.equal(h.calls.length, 2)
  h.tick()
  assert.equal(
    h.calls.filter(call => call[0] === 'walk' && Math.hypot(call[2].i - 40, call[2].j - 43) <= 3).length <= 2,
    true
  )
  // The third resident may take a local walk instead of crowding the destination.
  h.tick()
  assert.ok(h.calls.length <= 4)
})
test('saved idle interior visitors return outside; demolished destinations release visits', () => {
  const h = harness({ interior: true })
  const unit = h.owner.units[0]
  h.spaces.set('interior:saved', {
    id: 'interior:saved',
    building: h.owner.buildings[0],
    exit: h.grid[41][44],
    portals: [{ targetSpaceId: 'outside', targetCell: h.grid[41][44] }],
  })
  unit.spaceId = 'interior:saved'
  h.tick(30000)
  assert.equal(h.calls[0][0], 'exit')
  const other = harness()
  other.tick(30000)
  other.owner.buildings[0].isDestroyed = true
  other.arrive(other.owner.units[0])
  other.tick()
  assert.equal(other.system.visits.size, 0)
})
test('blocked terrain never triggers an unreachable long route', () => {
  const h = harness()
  for (const [i, j] of [
    [39, 40],
    [41, 40],
    [40, 39],
    [40, 41],
  ])
    h.grid[i][j].solid = true
  h.tick(30000)
  assert.equal(h.calls.length, 0)
})

test('unreachable destinations have a global search budget, not one search for every idle resident', () => {
  const h = harness({ types: Array(50).fill('Villager') })
  for (const [i, j] of [
    [39, 40],
    [41, 40],
    [40, 39],
    [40, 41],
  ])
    h.grid[i][j].solid = true
  let searches = 0
  const begin = h.system.beginVisit.bind(h.system)
  h.system.beginVisit = unit => {
    searches++
    return begin(unit)
  }
  h.tick(30000)
  assert.ok(searches <= 2)
  assert.equal(h.calls.length, 0)
})

test('a stopped or failed walk releases its destination instead of pretending the visit arrived', () => {
  const h = harness()
  h.tick(30000)
  const unit = h.owner.units[0]
  unit.dest = null
  unit.path = []
  h.tick()
  assert.equal(h.system.visits.size, 0)
  assert.equal(h.calls.length, 1)
})

test('all idle AI residents take staggered turns, including the last resident', () => {
  const h = harness({ ai: true, types: Array(24).fill('Villager') })
  h.owner.settlementType = 'city'
  const departed = new Set()
  for (let n = 0; n < 180; n++) {
    const before = h.calls.length
    h.tick()
    assert.ok(h.calls.length - before <= 1, 'no simultaneous departure wave')
    assert.ok(h.system.visits.size <= 6, 'city outing limit')
    for (const call of h.calls) if (call[0] === 'walk') departed.add(call[1])
    for (const unit of h.owner.units) h.arrive(unit)
  }
  for (let index = 4; index < 24; index++) assert.ok(departed.has(`unit-${index}`))
  for (let index = 0; index < 4; index++) assert.ok(!departed.has(`unit-${index}`))
})

test('settlement outing caps hold while visitors are still travelling', () => {
  for (const [profile, limit] of [
    ['outpost', 2],
    ['village', 4],
    ['city', 6],
  ]) {
    const h = harness({ types: Array(16).fill('Fantassin'), buildings: [] })
    h.owner.settlementType = profile
    for (let n = 0; n < 20; n++) h.tick()
    assert.equal(h.calls.length, limit)
    assert.equal(h.system.visits.size, limit)
  }
})

test('sleeping villages are not enumerated and an active village resident can walk outside the camera', () => {
  const h = harness()
  h.context.controls.getViewportMetrics = () => ({
    visibleLeft: 10000,
    visibleTop: 10000,
    visibleWidth: 100,
    visibleHeight: 100,
  })
  h.context.players.unshift({
    distant: true,
    get units() {
      assert.fail('sleeping units must not enter the rotation')
    },
  })
  h.tick(5000)
  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0][1], 'unit-0')
})

test('refused ambient orders do not reserve a visit or pretend the resident reached its destination', () => {
  for (const buildings of [['House'], []]) {
    const h = harness({ buildings })
    h.owner.units[0].sendTo = () => {}
    h.tick(30000)
    assert.equal(h.system.visits.size, 0)
    h.owner.units[0].sendTo = function (cell) {
      this.dest = cell
    }
    h.tick(30000)
    assert.equal(h.system.visits.size, 1)
  }
})

test('night watch stays outside in its village zone, with one staggered departure per scan', () => {
  const h = harness({
    types: ['Fantassin', 'Bowman', 'Fantassin', 'Bowman'],
    buildings: ['TownCenter', 'Barracks'],
    ai: true,
    interior: true,
  })
  const { configureVillageNightWatch } = loadTsModule('app/lib/units/villageNightWatch.ts')
  configureVillageNightWatch(h.owner)
  h.context.dayNight.state.hour = 0
  h.tick(30000)
  assert.equal(h.calls.filter(call => call[0] === 'walk').length, 1)
  assert.ok(h.calls.every(call => call[0] !== 'enter'))
  const patrol = h.owner.units.find(unit => unit.dest)
  assert.equal(patrol.dailySchedule.nightWatch, 'early')
  assert.ok(Math.hypot(patrol.dest.i - 40, patrol.dest.j - 43) <= 18)
  h.tick(30000)
  assert.equal(h.calls.filter(call => call[0] === 'walk').length, 2)
  assert.ok(h.owner.units.filter(unit => unit.dailySchedule.nightWatch === 'late').every(unit => !unit.dest))
})
