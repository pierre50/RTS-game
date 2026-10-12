const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function setup(targets, accepts = () => true, queued = false) {
  const moduleCache = new Map()
  const events = []
  const orders = []
  const { seekGroundToolMaterials } = loadTsModule('app/lib/units/village/villageGroundRecovery.ts', {
    moduleCache,
    mocks: {
      ...(queued
        ? {
            '../autonomy/villagerAutonomyTargeting': {
              planResourceApproach: function* (_unit, target) {
                for (let n = 0; n < 100; n++) {
                  events.push(target)
                  yield
                }
                return { length: 2, valid: () => true, commit: send => send() }
              },
            },
          }
        : {}),
      '../supplies/toolPreparation': {
        toolActivityAnchor: () => ({ i: 10, j: 10 }),
        constructionToolPreparation: () => ({}),
        equipOwnedTool: () => false,
      },
      '../supplies/groundToolRecovery': { groundToolPlan: () => ({ missing: ['wood', 'stone'] }) },
      '../autonomy/villagerKnownTargets': {
        knownResources: (_u, type, _limit, area) => {
          assert.equal(area.radius, 30)
          return targets.filter(t => (Array.isArray(type) ? type.includes(t.type) : t.type === type))
        },
      },
      '../autonomy/villagerAutonomyAvailability': { villagerAutonomySuspension: () => null },
      '../../resources/resourceDelivery': { getUnitResourceCapacityRemaining: () => 18 },
      '../../hero/heroActionRange': { isHeroInteractionTargetReachable: () => false },
    },
  })
  const unit = {
    i: 10,
    j: 10,
    inactif: true,
    context: { scheduler: { elapsedMs: 0, add: () => 1, remove: () => {} } },
    sendToEvt: target => {
      orders.push(target)
      return accepts(target)
    },
  }
  const { AutonomyPlanningQueue } = loadTsModule('app/services/AutonomyPlanningQueue.ts', { moduleCache })
  const queue = queued ? new AutonomyPlanningQueue(unit.context) : null
  return { unit, orders, events, queue, seek: () => seekGroundToolMaterials(unit) }
}
const target = (type, i) => ({ type, i, j: 10, family: 'resource', quantity: 1 })

test('near stone wins over distant wood when both are required', () => {
  const stone = target('GroundStone', 12)
  const f = setup([target('GroundWood', 29), stone])
  assert.equal(f.seek(), true)
  assert.deepEqual(f.orders, [stone])
})

test('chooses the nearest wood independent of source ordering and excludes distant pickups', () => {
  const wood = target('GroundWood', 13)
  const f = setup([target('GroundWood', 120), target('GroundWood', 25), wood])
  assert.equal(f.seek(), true)
  assert.deepEqual(f.orders, [wood])
  const distant = setup([target('GroundStone', 120)])
  assert.equal(distant.seek(), false)
  assert.deepEqual(distant.orders, [])
})

test('unreachable candidates cannot trigger an unbounded pathfinding burst', () => {
  const f = setup(
    Array.from({ length: 12 }, (_, i) => target('GroundWood', 12 + i)),
    () => false
  )
  assert.equal(f.seek(), false)
  assert.equal(f.orders.length, 3)
  f.seek()
  assert.equal(f.orders.length, 3)
})

test('ground routes yield, are not enqueued twice, and cancel after an explicit order', () => {
  const f = setup([target('GroundWood', 12)], () => true, true)
  assert.equal(f.seek(), true)
  assert.equal(f.seek(), true)
  assert.equal(f.events.length, 0)
  f.queue.flush()
  assert.ok(f.events.length > 0 && f.events.length < 100)
  assert.equal(f.orders.length, 0)
  const manual = { type: 'House', i: 3, j: 3 }
  f.unit.dest = manual
  f.unit.context.scheduler.elapsedMs += 17
  f.queue.flush()
  assert.equal(f.orders.length, 0)
  assert.equal(f.unit.dest, manual)
  f.queue.destroy()
})

test('a pickup consumed while its route is planned is never ordered', () => {
  const resource = target('GroundStone', 12)
  const f = setup([resource], () => true, true)
  f.seek()
  f.queue.flush()
  resource.quantity = 0
  for (let n = 0; n < 20; n++) {
    f.unit.context.scheduler.elapsedMs += 17
    f.queue.flush()
  }
  assert.equal(f.orders.length, 0)
  f.queue.destroy()
})

test('a successful void movement order is accepted once using the actual destination', () => {
  const nearest = target('GroundWood', 12)
  const f = setup([nearest, target('GroundStone', 13), target('GroundWood', 14)])
  f.unit.sendToEvt = resource => {
    f.orders.push(resource)
    f.unit.dest = resource
    f.unit.path = [{ i: resource.i, j: resource.j }]
  }
  assert.equal(f.seek(), true)
  assert.deepEqual(f.orders, [nearest])
})
