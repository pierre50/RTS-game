const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function schedulerFixture() {
  const { ActionScheduler } = loadTsModule('app/lib/ActionScheduler.ts')
  return new ActionScheduler({ ticker: { add() {}, remove() {} } }, () => false)
}

test('staggered decisions keep their cadence and do not share their first frame', () => {
  const scheduler = schedulerFixture()
  const calls = Array.from({ length: 8 }, () => [])
  for (const timestamps of calls)
    scheduler.add(() => timestamps.push(scheduler.elapsedMs), 4000, 'ai.step', { stagger: true })
  for (let i = 0; i < 1000; i++) scheduler._tick(16)
  assert.equal(new Set(calls.map(times => times[0])).size, 8)
  for (const times of calls) {
    assert.ok(times[0] >= 4000 && times[0] < 8000)
    for (let i = 1; i < times.length; i++) assert.equal(times[i] - times[i - 1], 4000)
  }
})

test('bounded observations drop overdue checks without losing simulation time', () => {
  const scheduler = schedulerFixture()
  let observations = 0
  let movement = 0
  scheduler.add(() => observations++, 20, 'observation', { maxRunsPerTick: 2 })
  scheduler.add(() => movement++, 20, 'unit.move')
  scheduler._tick(105)
  assert.equal(observations, 2)
  assert.equal(movement, 5)
  assert.equal(scheduler.elapsedMs, 105)
  scheduler._tick(15)
  assert.equal(observations, 3)
  assert.equal(movement, 6)
})

test('a task that replaces itself cannot consume the same frame repeatedly', () => {
  const scheduler = schedulerFixture()
  let runs = 0
  let id
  const retry = () => {
    runs++
    scheduler.remove(id)
    // Bound the reproduction so the broken implementation fails without hanging tests.
    if (runs < 10) id = scheduler.add(retry, 40, 'unit.step')
  }
  id = scheduler.add(retry, 40, 'unit.step')
  scheduler._tick(100)
  assert.equal(runs, 1)
  scheduler._tick(40)
  assert.equal(runs, 2)
})

test('tasks cancelled earlier in the frame do not execute', () => {
  const scheduler = schedulerFixture()
  const calls = []
  scheduler.addOneShot(() => scheduler.remove(cancelled), 40)
  const cancelled = scheduler.add(() => calls.push('cancelled'), 40)
  scheduler.add(() => calls.push('active'), 40)
  scheduler._tick(40)
  assert.deepEqual(calls, ['active'])
})

test('existing intervals still catch up and one-shot callbacks execute once', () => {
  const scheduler = schedulerFixture()
  let recurring = 0
  let once = 0
  scheduler.add(() => recurring++, 100)
  scheduler.addOneShot(() => once++, 100)
  scheduler._tick(350)
  assert.equal(recurring, 3)
  assert.equal(once, 1)
  scheduler._tick(50)
  assert.equal(recurring, 4)
  assert.equal(once, 1)
})

test('blocked contact approach retries yield to the next frame', () => {
  const scheduler = schedulerFixture()
  const { startContactApproach } = loadTsModule('app/lib/contact/contactApproach.ts')
  let interval
  let retries = 0
  const actor = {}
  const stop = () => scheduler.remove(interval)
  const approach = () =>
    startContactApproach({
      actor,
      isTargetValid: () => true,
      isCurrent: () => true,
      sample: () => ({ distance: 1, reachable: false }),
      move: () => false,
      begin() {},
      arrive() {},
      stallPolicy: { maxTicks: 1, probeEvery: 1, minimumProgress: 0.1 },
      schedule: callback => {
        interval = scheduler.add(callback, 40, 'unit.contactApproach')
      },
      stop,
      retry: () => {
        retries++
        if (retries < 10)
          interval = scheduler.add(
            () => {
              stop()
              approach()
            },
            40,
            'unit.step'
          )
      },
    })
  approach()
  scheduler._tick(100)
  assert.equal(retries, 1)
  scheduler._tick(40)
  assert.equal(retries, 1)
  scheduler._tick(40)
  assert.equal(retries, 2)
})

test('scheduler reports catch-up counts without changing the number or order of callbacks', () => {
  const events = []
  const spans = []
  const { ActionScheduler } = loadTsModule('app/lib/ActionScheduler.ts')
  const monitor = {
    measureSampled(name, callback) {
      spans.push(name)
      callback()
    },
    record() {
      assert.fail('tick must use nested measurement')
    },
    markEvent(name, details) {
      events.push({ name, details })
    },
  }
  const scheduler = new ActionScheduler(
    { ticker: { add() {}, remove() {} } },
    () => false,
    () => monitor
  )
  let runs = 0
  scheduler.add(() => runs++, 100, 'ai.step')
  scheduler._tick(350)
  assert.equal(runs, 3)
  assert.equal(spans[0], 'scheduler.tick')
  assert.deepEqual(events[0], {
    name: 'scheduler.catchUp',
    details: { deltaMs: 350, calls: 3, catchUpCalls: 2, mostRepeated: 'ai.step', maxRepeats: 3 },
  })
})
