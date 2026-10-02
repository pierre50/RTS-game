const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { getChiefEscorts, isChiefEscort } = loadTsModule('app/lib/units/chiefEscort.ts')
const orders = []
const { updateChiefEscorts } = loadTsModule('app/ai/AIChiefEscort.ts', {
  mocks: {
    '../lib/mapSpaces': {
      sameMapSpace: (a, b) => (a?.spaceId ?? 'outside') === (b?.spaceId ?? 'outside'),
      getEntitySpaceGrid: (_unit, map) => map.grid,
    },
    '../../../engine/services/BuildingInteriorSpaceLookup': {
      getBuildingInteriorSpaceForUnit: unit => unit.interior ?? null,
    },
    '../lib/grid/placement': { getPositionInGridAroundInstance: anchor => ({ i: anchor.i + 2, j: anchor.j }) },
    '../../engine/services/BuildingInteriorSpaceLookup': {
      getBuildingInteriorSpaceForUnit: unit => unit.interior ?? null,
    },
  },
})
function roster() {
  orders.length = 0
  const owner = { type: 'AI', units: [] }
  const add = (type, label) => {
    const unit = { type, label, owner, i: 0, j: 0, sendTo: (target, action) => orders.push({ label, target, action }) }
    owner.units.push(unit)
    return unit
  }
  const chief = add('Chief', 'chief')
  chief.i = 10
  const guards = [add('Fantassin', 'guard1'), add('Fantassin', 'guard2'), add('Fantassin', 'reserve')]
  return { owner, chief, guards }
}
test('only two infantry escort the chief; a reserve replaces a casualty and player units stay free', () => {
  const { owner, chief, guards } = roster()
  assert.deepEqual(getChiefEscorts(chief), guards.slice(0, 2))
  assert.equal(isChiefEscort(guards[2]), false)
  guards[0].isDead = true
  assert.deepEqual(getChiefEscorts(chief), guards.slice(1))
  owner.isPlayed = true
  assert.deepEqual(getChiefEscorts(chief), [])
})
test('escorts follow outside, wait near the town center and do not constantly repath', () => {
  const { chief, owner, guards } = roster()
  const context = { map: { grid: [] } }
  assert.equal(updateChiefEscorts(owner.units, context), 2)
  guards.forEach(guard => {
    guard.i = 11
  })
  assert.equal(updateChiefEscorts(owner.units, context), 0)
  const building = { i: 10, j: 0, size: 2 }
  chief.interior = { building }
  chief.i = 100
  chief.shelterState = { shelter: building }
  assert.equal(updateChiefEscorts(owner.units, context), 0, 'interior coordinates must not attract escorts')
})
test('escorts share the chief attack target and respect active orders', () => {
  const { chief, owner, guards } = roster()
  chief.action = 'attack'
  chief.dest = { label: 'enemy', i: 12, j: 0 }
  guards[1].pendingOrder = {}
  assert.equal(updateChiefEscorts(owner.units, { map: { grid: [] } }), 1)
  assert.equal(orders[0].target, chief.dest)
  assert.equal(orders[0].action, 'attack')
  guards[0].action = 'attack'
  guards[0].dest = chief.dest
  assert.equal(updateChiefEscorts(owner.units, { map: { grid: [] } }), 0)
})

test('a chief in the capital allows allied settlements to act without their own chief', () => {
  const { hasLivingChief } = loadTsModule('app/lib/chief.ts')
  const capital = { type: 'AI', factionId: 'a', units: [{ type: 'Chief' }] }
  const village = { type: 'AI', factionId: 'a', units: [] }
  village.context = { players: [capital, village] }
  assert.equal(hasLivingChief(village), true)
  capital.factionId = 'b'
  assert.equal(hasLivingChief(village), false)
  capital.factionId = 'a'
  capital.units[0].isDead = true
  assert.equal(hasLivingChief(village), false)
})

function audienceContext(owner) {
  const building = { type: 'TownCenter', owner, isBuilt: true, i: 10, j: 0, label: 'forum' }
  const room = { building, id: 'interior:forum' }
  const hero = { owner: {}, interior: room, spaceId: room.id }
  const entered = [],
    exited = []
  return {
    building,
    room,
    hero,
    entered,
    exited,
    context: {
      controls: { heroUnit: hero },
      map: { grid: [] },
      routeUnitIntoBuildingInterior: (unit, target) => {
        entered.push([unit, target])
        unit.spacePortalState = {}
        return true
      },
      routeInteriorUnitToExit: unit => {
        exited.push(unit)
        unit.spacePortalState = {}
      },
    },
  }
}

test('the hero brings the chief and exactly two guards into their own town center, without repeated orders', () => {
  const { owner, chief, guards } = roster()
  const { context, building, entered } = audienceContext(owner)
  assert.equal(updateChiefEscorts(owner.units, context), 3)
  assert.deepEqual(
    entered.map(([unit]) => unit),
    [chief, ...guards.slice(0, 2)]
  )
  assert.ok(entered.every(([, target]) => target === building))
  updateChiefEscorts(owner.units, context)
  assert.equal(entered.length, 3)
})

test('guards follow within two tiles outside and inside the town center', () => {
  const { owner, chief, guards } = roster()
  const visit = audienceContext(owner)
  for (const unit of [chief, ...guards]) {
    unit.interior = visit.room
    unit.spaceId = visit.room.id
  }
  guards[0].i = chief.i - 2.5
  guards[1].i = chief.i - 1
  assert.equal(updateChiefEscorts(owner.units, visit.context), 1)
  assert.equal(orders[0].label, 'guard1')
  orders.length = 0
  for (const unit of [chief, ...guards]) {
    delete unit.interior
    delete unit.spaceId
  }
  assert.equal(updateChiefEscorts(owner.units, { map: { grid: [] } }), 1)
})

test('the party exits after a visit but a resting chief keeps his room', () => {
  const { owner, chief, guards } = roster()
  const { context, hero, room, exited } = audienceContext(owner)
  for (const unit of [chief, ...guards.slice(0, 2)]) {
    unit.interior = room
    unit.spaceId = room.id
  }
  delete hero.interior
  delete hero.spaceId
  updateChiefEscorts(owner.units, context)
  assert.deepEqual(exited, [chief, ...guards.slice(0, 2)])
  chief.spacePortalState = null
  chief.shelterState = { status: 'inside', shelter: room.building }
  exited.length = 0
  updateChiefEscorts(owner.units, context)
  assert.equal(exited.includes(chief), false)
})

test('another building or an enemy hero does not trigger a friendly visit', () => {
  for (const variant of ['house', 'foreign', 'enemy']) {
    const { owner } = roster()
    const { context, building, hero, entered } = audienceContext(owner)
    if (variant === 'house') building.type = 'House'
    if (variant === 'foreign') building.owner = {}
    if (variant === 'enemy') hero.owner.isEnemy = () => true
    updateChiefEscorts(owner.units, context)
    assert.deepEqual(entered, [])
  }
})

test('moving guards adjust a stale destination when the chief moves away', () => {
  const { owner, guards } = roster()
  guards[0].path = [{}]
  guards[0].dest = { i: 2, j: 0 }
  guards[1].path = [{}]
  guards[1].dest = { i: 9, j: 0 }
  assert.equal(updateChiefEscorts(owner.units, { map: { grid: [] } }), 1)
  assert.equal(orders[0].label, 'guard1')
})

test('escorts can rest beside their settled chief and wake when he resumes moving', () => {
  const { owner, chief, guards } = roster()
  chief.shelterState = { status: 'outside', reason: 'sleep' }
  for (const guard of guards.slice(0, 2)) {
    guard.i = 9
    guard.shelterState = { status: 'outside', reason: 'sleep' }
    guard.actionLocked = true
  }
  const woken = []
  const context = {
    map: { grid: [] },
    unitRest: {
      wakeRestingUnitsInstant: units => {
        for (const unit of units) {
          woken.push(unit)
          unit.shelterState = null
          unit.actionLocked = false
        }
      },
    },
  }
  updateChiefEscorts(owner.units, context)
  assert.equal(woken.length, 0)
  chief.shelterState = null
  chief.i = 14
  updateChiefEscorts(owner.units, context)
  assert.deepEqual(woken, guards.slice(0, 2))
  assert.equal(orders.length, 2)
})

test('a night visit never summons the AI chief; morning audiences resume after waking', () => {
  const { owner, chief, guards } = roster()
  chief.dailySchedule = { bedMinute: 1320, wakeMinute: 360, workStartMinute: 420, workEndMinute: 1080, lunchStartMinute: 720, lunchEndMinute: 780 }
  const { context, entered } = audienceContext(owner)
  context.dayNight = { state: { hour: 22, minute: 0 } }
  updateChiefEscorts(owner.units, context)
  assert.deepEqual(entered, [])
  chief.shelterState = { reason: 'sleep', status: 'outside' }
  chief.sleepVisualState = 'sleeping'
  guards.slice(0, 2).forEach(guard => { guard.i = 9; guard.shelterState = { status: 'outside' }; guard.actionLocked = true })
  context.unitRest = { wakeRestingUnitsInstant: () => { throw new Error('A night visit must not wake the guards') } }
  updateChiefEscorts(owner.units, context)
  assert.deepEqual(entered, [])
  context.dayNight.state.hour = 7
  updateChiefEscorts(owner.units, context)
  assert.deepEqual(entered, [], 'wait for the actual wake before receiving the hero')
  chief.shelterState = null
  chief.sleepVisualState = null
  guards.slice(0, 2).forEach(guard => { guard.shelterState = null; guard.actionLocked = false })
  updateChiefEscorts(owner.units, context)
  assert.equal(entered[0][0], chief)
})
