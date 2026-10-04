const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
function fixture(count = 12) {
  const moduleCache = new Map()
  const scans = [],
    orders = [],
    tasks = []
  const mocks = {
    './CampRespawnSystem': {
      CampRespawnSystem: class {
        update() {}
      },
    },
    './CampLeashController': {
      CampLeashController: class {
        update() {
          return false
        }
      },
    },
    '../../lib': { findInstancesInSight: () => [], instancesDistance: () => 1 },
    '../../lib/combat/combatFeedback': { showAlertFeedback() {} },
    '../../lib/units/unitEnergy': { cancelEnergyWait() {} },
    '../../lib/units/campBehavior': { campAnchor: u => u.campPatrolAnchor, canCampPursue: () => true },
    '../../lib/units/autonomy/walkAround': {
      canUnitStartAmbientWalk: u => !u.dest && !u.action,
      findUnitWalkAroundDestination: () => ({ i: 51, j: 50 }),
    },
    '../rest/UnitRestRules': { isUnitRestWakeLocked: () => false },
  }
  const { CampPatrolSystem } = loadTsModule('app/services/patrol/CampPatrolSystem.ts', { mocks, moduleCache })
  const { isCampPaused } = loadTsModule('app/lib/units/campActivity.ts', { mocks, moduleCache })
  const { isUnitSuspended, wakeUnitSimulation } = loadTsModule('app/lib/units/unitSuspension.ts', {
    mocks,
    moduleCache,
  })
  const hero = { i: 500, j: 500 }
  const owner = { units: [] }
  const context = {
    players: [owner],
    controls: { heroUnit: hero, instanceInCamera: () => false },
    map: { spaces: new Map(), randomRange: () => 3500 },
    scheduler: {
      elapsedMs: 0,
      add(...args) {
        tasks.push(args)
        return 1
      },
      remove() {},
    },
  }
  for (let i = 0; i < count; i++)
    owner.units.push({
      label: `guard${i}`,
      owner,
      i: 50,
      j: 50,
      campPatrolAnchor: { i: 50, j: 50 },
      campBehavior: { phase: 'guard' },
      path: [{ i: 51, j: 50 }],
      dest: { i: 51, j: 50 },
      sprite: {
        stop() {
          this.playing = false
        },
        play() {
          this.playing = true
        },
      },
      stopInterval() {
        this.stopped = true
      },
      stopTimeout() {},
      sendToEvt(cell) {
        orders.push(this.label)
        this.dest = cell
        this.path = [cell]
      },
    })
  const system = new CampPatrolSystem(context)
  system.findAggroTarget = unit => {
    scans.push(unit.label)
    return null
  }
  return { system, context, hero, owner, tasks, scans, orders, isCampPaused, isUnitSuspended, wakeUnitSimulation }
}
test('distant bandits stop completely and generate no scans or walks over time', () => {
  const f = fixture()
  for (let time = 0; time <= 15000; time += 100) {
    f.context.scheduler.elapsedMs = time
    f.system.updateAggro()
  }
  assert.equal(f.scans.length, 0)
  assert.equal(f.orders.length, 0)
  for (const unit of f.owner.units) {
    assert.equal(f.isCampPaused(unit), true)
    assert.equal(f.isUnitSuspended(unit), true)
    assert.equal(unit.stopped, true)
    assert.deepEqual(unit.path, [])
    assert.equal(unit.sprite.playing, false)
  }
})
test('nearby checks and resumed walks are bounded and fair, even after a long pause', () => {
  const f = fixture(30)
  f.system.updateAggro()
  f.hero.i = f.hero.j = 50
  for (let time = 20000; time <= 22000; time += 100) {
    f.context.scheduler.elapsedMs = time
    const before = f.scans.length,
      commands = f.orders.length
    f.system.updateAggro()
    assert.ok(f.scans.length - before <= 4)
    assert.ok(f.orders.length - commands <= 4)
  }
  assert.equal(new Set(f.scans).size, 30)
  assert.equal(f.orders.length, 30)
  assert.equal(f.tasks[0][1], 100)
  assert.deepEqual(f.tasks[0][3], { maxRunsPerTick: 1 })
})
test('attack wakes immediately and active combat is not frozen when the hero is far', () => {
  const f = fixture(1),
    unit = f.owner.units[0]
  f.system.updateAggro()
  f.wakeUnitSimulation(unit)
  assert.equal(f.isCampPaused(unit), false)
  assert.equal(f.isUnitSuspended(unit), false)
  unit.action = 'attack'
  f.context.scheduler.elapsedMs = 3000
  f.system.updateAggro()
  assert.equal(f.isCampPaused(unit), false)
})
test('camera and interior positions wake only the relevant camp; leaving freezes it again', () => {
  const f = fixture(1),
    unit = f.owner.units[0]
  unit.spaceId = 'cave'
  unit.campBehavior.homeSpaceId = 'cave'
  f.hero.i = f.hero.j = 50
  f.system.updateAggro()
  assert.equal(f.isCampPaused(unit), true, 'matching numbers in another space are not proximity')
  f.hero.spaceId = 'cave'
  f.context.scheduler.elapsedMs = 500
  f.system.updateAggro()
  assert.equal(f.isCampPaused(unit), false)
  f.hero.spaceId = 'outside'
  f.context.scheduler.elapsedMs = 1000
  f.system.updateAggro()
  assert.equal(f.isCampPaused(unit), true)
  f.context.map.activeSpaceId = 'cave'
  f.context.controls.instanceInCamera = () => true
  f.context.scheduler.elapsedMs = 1500
  f.system.updateAggro()
  assert.equal(f.isCampPaused(unit), false)
})
test('conversion and destruction release all pause markers', () => {
  const f = fixture(2)
  f.system.updateAggro()
  f.owner.isPlayed = true
  f.context.scheduler.elapsedMs = 5000
  f.system.updateAggro()
  for (const unit of f.owner.units) assert.equal(f.isUnitSuspended(unit), false)
  f.owner.isPlayed = false
  f.context.scheduler.elapsedMs = 10000
  f.system.updateAggro()
  f.system.destroy()
  for (const unit of f.owner.units) assert.equal(f.isCampPaused(unit), false)
})

test('paused camps do not accumulate passive energy or sleep healing', () => {
  const moduleCache = new Map()
  let updates = 0
  const mocks = {
    '../lib': {
      updateUnitEnergy() {
        updates++
      },
    },
    '../lib/units/unitSleepHealth': {
      updateUnitSleepHealth() {
        updates++
      },
    },
  }
  const { UnitEnergyRegenSystem } = loadTsModule('app/services/UnitEnergyRegenSystem.ts', { mocks, moduleCache })
  const { setUnitSuspension } = loadTsModule('app/lib/units/unitSuspension.ts', { mocks, moduleCache })
  const unit = {}
  const context = {
    players: [{ units: [unit] }],
    scheduler: {
      add() {
        return 1
      },
      remove() {},
    },
  }
  const system = new UnitEnergyRegenSystem(context)
  setUnitSuspension(unit, { reason: 'camp-paused', wake() {} })
  system.update(60000)
  assert.equal(updates, 0)
  setUnitSuspension(unit)
  system.update(500)
  assert.equal(updates, 2)
})

test('rest transitions finish before pause, while settled sleep can freeze', () => {
  const f = fixture(1),
    unit = f.owner.units[0]
  unit.shelterState = { reason: 'sleep', status: 'windingDown' }
  f.system.updateAggro()
  assert.equal(f.isCampPaused(unit), false)
  unit.shelterState.status = 'outside'
  f.context.scheduler.elapsedMs = 500
  f.system.updateAggro()
  assert.equal(f.isCampPaused(unit), true)
})
