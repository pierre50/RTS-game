const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { ActionScheduler } = loadTsModule('app/lib/ActionScheduler.ts')

function harness({ resume, extra = {}, count = 1, editor = false } = {}) {
  let paused = false
  const calls = []
  const rejected = []
  const scheduler = new ActionScheduler({ ticker: { add() {}, remove() {} } }, () => paused)
  const context = { scheduler, editor, dayNight: { state: { hour: 12, minute: 0 } }, players: [] }
  const units = Array.from({ length: count }, (_, index) => ({
    type: 'Villager',
    label: `worker-${index}`,
    autonomousJob: 'food',
    work: 'forager',
    i: index,
    j: 0,
    x: index,
    y: 0,
    dest: null,
    action: null,
    path: [],
    context,
    ...extra,
  }))
  context.players.push({ units })
  const target = { family: 'resource', label: 'berries', quantity: 10, i: 10, j: 0 }
  const exploration = loadTsModule('app/lib/units/autonomy/villagerExploration.ts')
  const { VillagerAutonomySystem } = loadTsModule('app/services/VillagerAutonomySystem.ts', {
    mocks: {
      '../lib/units/autonomy/villagerExploration': exploration,
      '../lib/units/villagerTaskRecovery': {
        resumeVillagerJobIntent(unit) {
          calls.push(unit.label)
          if (resume) return resume(unit)
          unit.dest = target
          unit.action = 'forageberry'
          unit.inactif = false
          return true
        },
      },
      '../lib/units/villagerAutonomy': { hasVillagerAutonomyTarget: unit => Boolean(unit.hasKnownTarget) },
      '../lib/units/villagerAutonomyTargeting': {
        markVillagerAutonomyTargetRejected: (_unit, target) => rejected.push(target),
      },
    },
  })
  const system = new VillagerAutonomySystem(context)
  return {
    system,
    exploration,
    context,
    scheduler,
    calls,
    rejected,
    units,
    unit: units[0],
    target,
    tick: (ms = 1000) => scheduler._tick(ms),
    pause: value => {
      paused = value
    },
  }
}

test('restored awake food worker with no target resumes only after runtime initialization', () => {
  const h = harness()
  assert.equal(h.calls.length, 0)
  h.tick()
  assert.equal(h.unit.dest, h.target)
  assert.equal(h.unit.autonomousJob, 'food')
  assert.equal(h.system.getStatus(h.unit).reason, 'resumed')
  h.tick()
  assert.equal(h.calls.length, 1)
})

test('valid productive work is preserved, including long stationary gathering', () => {
  const h = harness({ extra: { action: 'forageberry', dest: { quantity: 200 } } })
  for (let second = 0; second < 120; second++) {
    h.unit.gatherProgressState = { progress: second % 20 }
    h.tick()
  }
  assert.equal(h.calls.length, 0)
  assert.equal(h.system.getStatus(h.unit).reason, 'working')
})

test('dead food carcasses remain valid, but depleted and destroyed resources trigger retargeting', () => {
  const carcass = { family: 'animal', isDead: true, quantity: 12 }
  const h = harness({ extra: { action: 'takemeat', dest: carcass } })
  h.tick()
  assert.equal(h.calls.length, 0)
  carcass.quantity = 0
  h.tick()
  assert.equal(h.calls.length, 1)
  assert.deepEqual(h.rejected, [carcass])
  h.target.isDestroyed = true
  h.tick()
  assert.equal(h.calls.length, 2)
})

test('frozen movement is recovered, while moving pixels without changing cells count as progress', () => {
  const h = harness({ extra: { action: 'forageberry', dest: { quantity: 20 }, path: [{}] } })
  for (let second = 0; second < 30; second++) {
    h.unit.x += 0.5
    h.tick()
  }
  assert.equal(h.calls.length, 0)
  for (let second = 0; second < 15; second++) h.tick()
  assert.equal(h.calls.length, 1)
  assert.equal(h.rejected.length, 1)
})

test('an action with no gathering progress is recovered after a conservative grace period', () => {
  const h = harness({ extra: { action: 'forageberry', dest: { quantity: 20 } } })
  for (let second = 0; second < 60; second++) h.tick()
  assert.equal(h.calls.length, 0)
  h.tick()
  assert.equal(h.calls.length, 1)
})

test('food hunting is monitored and a successful kill never blacklists the resulting meat', () => {
  const deer = { family: 'animal', hitPoints: 20, quantity: 20 }
  const h = harness({ extra: { action: 'hunt', dest: deer } })
  h.tick()
  assert.equal(h.system.getStatus(h.unit).reason, 'working')
  deer.isDead = true
  deer.hitPoints = 0
  h.tick()
  assert.equal(h.calls.length, 1)
  assert.equal(h.rejected.length, 0)
})

test('orphaned work actions with no target are recovered immediately', () => {
  const h = harness({ extra: { action: 'forageberry' } })
  h.tick()
  assert.equal(h.calls.length, 1)
})

test('other workers harvesting the destination cannot mask a stuck incoming worker', () => {
  const target = { quantity: 200 }
  const h = harness({ extra: { action: 'forageberry', dest: target, path: [{}] } })
  for (let second = 0; second < 16; second++) {
    target.quantity--
    h.tick()
  }
  assert.equal(h.calls.length, 1)
})

test('lost exploration is restarted, but manual moves retaining a job are left alone', () => {
  const h = harness({ extra: { exploringForAutonomy: true, dest: { has: null }, path: [{}] } })
  for (let second = 0; second < 16; second++) h.tick()
  assert.equal(h.calls.length, 1)
  const manual = harness({ extra: { dest: { has: null }, path: [{}] } })
  for (let second = 0; second < 120; second++) manual.tick()
  assert.equal(manual.calls.length, 0)
  assert.equal(manual.system.getStatus(manual.unit).reason, 'other-order')
})

test('temporary suspensions do not lose the job and resume when released', () => {
  for (const extra of [
    { shelterState: {} },
    { suspendedRestState: {} },
    { sleepVisualState: {} },
    { trainingTargetType: 'Archer' },
    { action: 'train' },
    { resourceDeliveryState: {} },
    { action: 'delivery' },
    { spacePortalState: {} },
    { interiorExitState: {} },
    { waitingForEnergyAction: 'forageberry' },
    { combatMode: 'flee' },
    { controlMode: 'hero' },
    { followingHero: true },
    { lookingAtHero: true },
    { pendingOrder: {} },
    { actionLocked: true },
    { assigningAutonomousJob: true },
  ]) {
    const h = harness({ extra })
    h.tick()
    assert.equal(h.calls.length, 0, JSON.stringify(extra))
    for (const key of Object.keys(extra)) h.unit[key] = null
    h.tick()
    assert.equal(h.calls.length, 1, JSON.stringify(extra))
  }
})

test('nighttime and pause never advance work or recovery deadlines', () => {
  const h = harness()
  h.context.dayNight.state.hour = 0
  h.tick()
  assert.equal(h.calls.length, 0)
  assert.equal(h.system.getStatus(h.unit).reason, 'outside-work-hours')
  h.context.dayNight.state.hour = 12
  h.pause(true)
  h.tick(120000)
  assert.equal(h.calls.length, 0)
  assert.equal(h.scheduler.elapsedMs, 1000)
  h.pause(false)
  h.tick()
  assert.equal(h.calls.length, 1)
})

test('failed searches back off, preserve assignment and pick up newly available work', () => {
  const h = harness({
    resume: unit => {
      unit.dest = null
      unit.action = null
      unit.path = []
      return Boolean(unit.hasKnownTarget)
    },
  })
  h.tick()
  assert.equal(h.system.getStatus(h.unit).reason, 'no-known-target')
  h.tick()
  assert.equal(h.calls.length, 1)
  h.tick()
  assert.equal(h.calls.length, 2)
  for (let index = 0; index < 3; index++) h.tick()
  assert.equal(h.calls.length, 2)
  h.unit.hasKnownTarget = true
  h.tick()
  assert.equal(h.calls.length, 3)
  assert.equal(h.unit.autonomousJob, 'food')
  assert.equal(h.system.getStatus(h.unit).reason, 'resumed')
})

test('known resources with no accepted route get a distinct waiting reason', () => {
  const h = harness({ extra: { hasKnownTarget: true }, resume: () => false })
  h.tick()
  assert.equal(h.system.getStatus(h.unit).reason, 'no-accepted-route')
})

test('failed recovery owns a single retry mechanism and caps its delay', () => {
  let h
  let duplicateCalls = 0
  h = harness({
    resume: unit => {
      h.exploration.scheduleVillagerExplorationResume(unit, () => duplicateCalls++, 2000)
      return false
    },
  })
  h.exploration.scheduleVillagerExplorationResume(h.unit, () => duplicateCalls++, 2000)
  const stale = [...h.scheduler._tasks.values()].find(task => task.oneShot).callback
  for (let second = 0; second < 120; second++) h.tick()
  stale()
  assert.equal(duplicateCalls, 0)
  assert.equal(h.scheduler._tasks.size, 1)
  const status = h.system.getStatus(h.unit)
  assert.ok(status.nextRetryMs - h.scheduler.elapsedMs <= 30000)
  assert.ok(h.calls.length < 12)
})

test('batch limits bound path searches without starving villagers later in the list', () => {
  const h = harness({ count: 100 })
  for (let index = 0; index < 40; index++) {
    const previous = h.calls.length
    h.tick()
    assert.ok(h.calls.length - previous <= 4)
  }
  assert.equal(new Set(h.calls).size, 100)
})

test('scheduler catch-up cannot repeat expensive recovery scans within the same tick', () => {
  const h = harness({ count: 50, resume: () => false })
  h.tick(120000)
  assert.equal(h.calls.length, 4)
})

test('unassigned, dead, destroyed and non-villager units are never recruited', () => {
  for (const extra of [{ autonomousJob: null }, { isDead: true }, { isDestroyed: true }, { type: 'Archer' }]) {
    const h = harness({ extra })
    h.tick()
    assert.equal(h.calls.length, 0)
  }
})

test('teardown removes the only monitor task and no state leaks into the next visit', () => {
  const h = harness()
  h.system.destroy()
  h.tick()
  h.system.update()
  assert.equal(h.calls.length, 0)
  assert.equal(h.scheduler._tasks.size, 0)
  const next = harness()
  next.tick()
  assert.equal(next.calls.length, 1)
})

test('the editor never starts autonomous work', () => {
  const h = harness({ editor: true })
  h.tick()
  assert.equal(h.calls.length, 0)
  assert.equal(h.scheduler._tasks.size, 0)
})
