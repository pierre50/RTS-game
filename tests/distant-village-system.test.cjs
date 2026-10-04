const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function fixture() {
  const moduleCache = new Map()
  const advances = []
  const plans = []
  let fail = false
  const mocks = {
    './DistantVillageEconomy': {
      advanceDistantVillageEconomy(_context, owner, _homes, from, to) {
        if (fail) throw new Error('simulation failed')
        advances.push([owner.label, from, to])
      },
      planDistantVillageBuildings(context, owner) {
        plans.push(owner.label)
        owner.offlineBuildingPlanDay = context.dayNight.state.day
      },
    },
  }
  const { DistantVillageSystem } = loadTsModule('app/services/world/distantVillages/DistantVillageSystem.ts', { mocks, moduleCache })
  const rules = {
    ...loadTsModule('app/lib/units/village/villageActivity.ts', { mocks, moduleCache }),
    ...loadTsModule('app/lib/units/unitSuspension.ts', { mocks, moduleCache }),
  }
  const context = {
    map: { worldId: 'world-test-1000' },
    scheduler: { elapsedMs: 0 },
    dayNight: {
      state: { day: 1 },
      getElapsedMs() {
        return context.scheduler.elapsedMs
      },
    },
  }
  const owner = {
    label: 'a',
    units: [],
    buildings: [],
    productions: 0,
    planDistantProduction() {
      this.productions++
    },
  }
  const home = { id: 'village', i: 20, j: 20, spaceId: 'outside' }
  const worker = {
    label: 'worker',
    type: 'Villager',
    i: 20,
    j: 20,
    villageHome: home,
    owner,
    action: 'build',
    path: [{ i: 21, j: 20 }],
    stopped: 0,
    stopInterval() {
      this.stopped++
    },
    stopTimeout() {},
    sprite: { stop() {} },
  }
  owner.units.push(worker)
  const candidates = [{ home, owner, observed: false }]
  const service = new DistantVillageSystem(context)
  const update = () => service.update(candidates, () => {})
  return {
    service,
    context,
    owner,
    worker,
    candidates,
    update,
    rules,
    advances,
    plans,
    fail: value => {
      fail = value
    },
  }
}

test('distant construction sleeps; quiet ticks do not simulate, plan or issue orders', () => {
  const f = fixture()
  f.update()
  assert.ok(f.rules.isDistantOwner(f.owner))
  assert.ok(f.rules.isUnitSuspended(f.worker))
  assert.deepEqual(f.worker.path, [])
  for (let i = 0; i < 20; i++) {
    f.context.scheduler.elapsedMs += 500
    f.update()
  }
  assert.deepEqual(f.advances, [])
  assert.equal(f.owner.productions, 1)
  assert.equal(f.plans.length, 1)
})

test('save flush and arrival settle each interval once; repeated visits do not replay planning', () => {
  const f = fixture()
  f.update()
  f.context.scheduler.elapsedMs = 5000
  f.service.flush()
  f.service.flush()
  f.context.scheduler.elapsedMs = 7000
  f.candidates[0].observed = true
  f.update()
  assert.deepEqual(f.advances, [
    ['a', 0, 5000],
    ['a', 5000, 7000],
  ])
  assert.equal(f.rules.isDistantOwner(f.owner), false)
  assert.equal(f.rules.isUnitSuspended(f.worker), false)
  f.candidates[0].observed = false
  f.update()
  assert.equal(f.owner.productions, 1)
  assert.equal(f.plans.length, 1)
})

test('attacks wake immediately and failed simulation retains its checkpoint', () => {
  const f = fixture()
  f.update()
  f.context.scheduler.elapsedMs = 3000
  f.fail(true)
  assert.throws(() => f.rules.wakeUnitSimulation(f.worker), /simulation failed/)
  assert.ok(f.rules.isDistantOwner(f.owner))
  f.fail(false)
  f.rules.wakeDistantOwner(f.owner)
  assert.deepEqual(f.advances, [['a', 0, 3000]])
  assert.equal(f.service.has(f.owner), false)
})

test('daily planning is queued and training remains live without waking the village', () => {
  const f = fixture()
  const trainee = { ...f.worker, label: 'trainee', action: 'train', trainingTargetType: 'Infantry' }
  f.owner.units.push(trainee)
  f.update()
  assert.equal(f.rules.isUnitSuspended(trainee), false)
  f.context.scheduler.elapsedMs = 20000
  f.service.flush()
  f.context.dayNight.state.day = 2
  f.rules.planDistantVillages(f.context)
  assert.equal(f.plans.length, 1)
  f.update()
  assert.equal(f.plans.length, 2)
  assert.equal(f.owner.productions, 2)
  assert.deepEqual(f.advances, [['a', 0, 20000]])
})

test('one observed village keeps the shared economy detailed; unsafe orders are not swallowed', () => {
  const f = fixture()
  f.candidates.push({ ...f.candidates[0], observed: true })
  f.update()
  assert.equal(f.service.has(f.owner), false)
  f.candidates.pop()
  f.worker.action = 'attack'
  f.update()
  assert.equal(f.service.has(f.owner), false)
  f.worker.action = null
  f.update()
  assert.ok(f.service.has(f.owner))
  f.service.destroy()
  assert.equal(f.rules.isUnitSuspended(f.worker), false)
})

test('distant factions cannot suspend a resource search or an outbound supply route', () => {
  for (const patch of [
    { autonomousJob: 'wood', action: null, dest: null },
    { autonomyBlockedJob: 'wood' },
    { exploringForAutonomy: true },
    { action: 'chopwood', dest: { i: 100, j: 20, family: 'resource', type: 'Tree', quantity: 10 } },
  ]) {
    const f = fixture()
    Object.assign(f.worker, patch)
    f.update()
    assert.equal(f.rules.isUnitSuspended(f.worker), false)
    assert.equal(f.service.has(f.owner), false)
  }
})

test('all fixed settlements freeze together during the opening without daily planning', () => {
  const f = fixture()
  f.context.isTutorialActive = () => true
  for (let index = 0; index < 8; index++) {
    const owner = { ...f.owner, label: `fixed-${index}`, developmentMode: 'static', units: [] }
    owner.units.push({ ...f.worker, owner })
    f.candidates.push({ home: f.candidates[0].home, owner, observed: index === 7 })
  }
  f.update()
  for (const candidate of f.candidates.slice(1)) {
    assert.equal(f.rules.isDistantOwner(candidate.owner), !candidate.observed)
    assert.equal(f.rules.isUnitSuspended(candidate.owner.units[0]), !candidate.observed)
  }
  assert.equal(f.rules.isDistantOwner(f.owner), false, 'dynamic tutorial factions keep their existing behavior')
  assert.deepEqual(f.plans, [])
  assert.deepEqual(f.advances, [])
})

test('static outposts freeze on any map and wake for combat without economic catch-up', () => {
  const f = fixture()
  f.context.map.worldId = 'ordinary-region'
  f.owner.developmentMode = 'static'
  f.worker.type = 'Fantassin'
  f.worker.action = null
  f.update()
  assert.ok(f.rules.isUnitSuspended(f.worker))
  f.context.scheduler.elapsedMs = 100000
  f.rules.planDistantVillages(f.context)
  f.update()
  f.service.flush()
  assert.deepEqual(f.advances, [])
  assert.deepEqual(f.plans, [])
  assert.equal(f.owner.productions, 0)
  f.rules.wakeUnitSimulation(f.worker)
  assert.equal(f.rules.isUnitSuspended(f.worker), false)
  assert.deepEqual(f.advances, [])
  f.worker.action = 'attack'
  f.update()
  assert.equal(f.service.has(f.owner), false)
})

test('RPG sleep advances rest without economic simulation or legacy work, even across days and saves', () => {
  const f = fixture()
  f.owner.developmentMode = 'static'
  const update = () => f.service.update(f.candidates, () => assert.fail('no legacy work preparation'))
  update()
  assert.ok(f.rules.isUnitSuspended(f.worker))
  for (let day = 2; day <= 12; day++) {
    f.context.dayNight.state.day = day
    f.context.scheduler.elapsedMs += 600000
    f.rules.planDistantVillages(f.context)
    update()
    f.service.flush()
  }
  f.candidates[0].observed = true
  update()
  assert.equal(f.rules.isUnitSuspended(f.worker), false)
  assert.deepEqual(f.advances, [])
  assert.deepEqual(f.plans, [])
  assert.equal(f.owner.productions, 0)
  f.service.destroy()
})

test('static village wake reconciles rest before resuming any old walking order', () => {
  const f = fixture()
  f.owner.developmentMode = 'static'
  f.worker.dest = { i: 21, j: 20 }
  f.worker.sendToEvt = () => assert.fail('sleeping residents must not resume yesterday walking order')
  let reconciled = false
  f.context.unitRest = {
    synchronizeVillageRest(units) {
      assert.equal(f.rules.isUnitSuspended(f.worker), false)
      assert.deepEqual(units, [f.worker])
      f.worker.shelterState = { status: 'inside' }
      reconciled = true
    },
  }
  f.update()
  f.rules.wakeUnitSimulation(f.worker)
  assert.equal(reconciled, true)
})

test('destroying the activity system does not create house interiors to reconcile rest', () => {
  const f = fixture()
  f.owner.developmentMode = 'static'
  f.context.unitRest = {
    synchronizeVillageRest() {
      assert.fail('no rest catch-up during teardown')
    },
  }
  f.update()
  f.service.destroy()
  assert.equal(f.rules.isUnitSuspended(f.worker), false)
})

test('static rest catch-up is committed once across save flushes and activation', () => {
  const f = fixture()
  const { DAY_NIGHT_CONFIG } = loadTsModule('app/config/gameplay.ts')
  const hour = DAY_NIGHT_CONFIG.dayLengthMs / DAY_NIGHT_CONFIG.hoursPerDay
  f.owner.developmentMode = 'static'
  Object.assign(f.worker, {
    hitPoints: 1,
    totalHitPoints: 80,
    dailySchedule: {
      wakeMinute: 360,
      workStartMinute: 420,
      lunchStartMinute: 720,
      lunchEndMinute: 780,
      workEndMinute: 1080,
      bedMinute: 1320,
    },
  })
  f.context.scheduler.elapsedMs = (22 - DAY_NIGHT_CONFIG.startHour) * hour
  f.update()
  f.context.scheduler.elapsedMs += hour
  f.service.flush()
  assert.equal(f.worker.hitPoints, 11)
  f.service.flush()
  assert.equal(f.worker.hitPoints, 11)
  f.candidates[0].observed = true
  f.update()
  assert.equal(f.worker.hitPoints, 11)
  assert.deepEqual(f.advances, [])
})
