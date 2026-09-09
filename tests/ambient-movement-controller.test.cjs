const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { AmbientMovementController, scheduleAmbientMove } = loadTsModule('app/lib/units/ambientMovement.ts')

function fixture() {
  let nextId = 0
  const tasks = new Map()
  const removed = []
  const delays = []
  const moves = []
  const scheduler = {
    elapsedMs: 100,
    add(callback, delay, name) {
      const id = nextId++
      tasks.set(id, { callback, delay, name })
      return id
    },
    addOneShot(callback, delay, name) {
      return this.add(callback, delay, name)
    },
    remove(id) {
      removed.push(id)
      tasks.delete(id)
    },
  }
  const randomRange = (min, max) => {
    delays.push([min, max])
    return min
  }
  const host = { context: { scheduler, map: { randomRange } } }
  const options = {
    delayMinMs: () => 10,
    delayMaxMs: () => 5,
    pickDestination: () => ({ i: 1, j: 2 }),
    move: (unit, cell) => moves.push([unit, cell]),
    taskName: 'ambient',
  }
  return { scheduler, tasks, removed, delays, moves, host, options, randomRange }
}

test('ambient controller schedules once, respects the deadline and removes task zero', () => {
  const f = fixture()
  const controller = new AmbientMovementController(f.host, f.options)
  const update = () => {}
  assert.equal(controller.ready, true)
  controller.stop()
  assert.deepEqual(f.removed, [])
  controller.start(20, update)
  controller.start(30, () => {})
  assert.deepEqual(f.delays, [[10, 10]])
  assert.equal(f.tasks.size, 1)
  assert.deepEqual(f.tasks.get(0), { callback: update, delay: 20, name: 'ambient' })
  assert.equal(controller.ready, false)
  f.scheduler.elapsedMs = 110
  assert.equal(controller.ready, true)
  controller.stop()
  controller.stop()
  assert.deepEqual(f.removed, [0])
  controller.start(20, update)
  assert.equal(controller.taskId, 1)
})

test('ambient controller only resets its deadline after a successful destination choice', () => {
  const f = fixture()
  const controller = new AmbientMovementController(f.host, f.options)
  f.options.pickDestination = () => null
  assert.equal(controller.tryMove(), false)
  assert.equal(controller.nextMoveAt, 0)
  assert.equal(f.moves.length, 0)
  const destination = { i: 3, j: 4 }
  f.options.pickDestination = () => destination
  f.options.delayMaxMs = () => 50
  assert.equal(controller.tryMove(), true)
  assert.deepEqual(f.moves, [[f.host, destination]])
  assert.equal(controller.nextMoveAt, 110)
  assert.deepEqual(f.delays, [[10, 50]])
})

test('scheduled ambient moves stop before registration and when their host becomes inactive', () => {
  const f = fixture()
  let active = false
  const ids = []
  const options = {
    ...f.options,
    scheduler: f.scheduler,
    randomRange: f.randomRange,
    shouldContinue: () => active,
    onTaskId: (host, id) => {
      assert.equal(host, f.host)
      ids.push(id)
    },
  }
  assert.equal(scheduleAmbientMove(f.host, options), null)
  assert.equal(f.tasks.size, 0)
  active = true
  assert.equal(scheduleAmbientMove(f.host, options), 0)
  active = false
  f.tasks.get(0).callback()
  assert.deepEqual(ids, [null, 0, null])
  assert.equal(f.moves.length, 0)
  assert.equal(f.tasks.size, 1)
})

test('scheduled ambient moves retry when blocked or without a destination, then move and reschedule', () => {
  const f = fixture()
  let allowed = false
  let destination = null
  let picks = 0
  const options = {
    ...f.options,
    scheduler: f.scheduler,
    randomRange: f.randomRange,
    shouldContinue: () => true,
    canMove: () => allowed,
    pickDestination: () => {
      picks++
      return destination
    },
  }
  scheduleAmbientMove(f.host, options)
  f.tasks.get(0).callback()
  assert.equal(picks, 0)
  assert.equal(f.tasks.size, 2)
  allowed = true
  f.tasks.get(1).callback()
  assert.equal(picks, 1)
  assert.equal(f.moves.length, 0)
  destination = { i: 2, j: 3 }
  delete options.canMove
  f.tasks.get(2).callback()
  assert.deepEqual(f.moves, [[f.host, destination]])
  assert.equal(f.tasks.size, 4)
  options.shouldContinue = () => false
  assert.equal(scheduleAmbientMove(f.host, options), null)
})
