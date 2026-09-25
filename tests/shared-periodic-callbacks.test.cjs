const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { registerPeriodicCallback } = loadTsModule('app/lib/SharedPeriodicCallbacks.ts')
const { ActionScheduler } = loadTsModule('app/lib/ActionScheduler.ts')

test('animal observations are bounded after a stall and every bucket still gets serviced', () => {
  const scheduler = new ActionScheduler({ ticker: { add() {}, remove() {} } }, () => false)
  const counts = Array(16).fill(0)
  counts.forEach((_, i) => registerPeriodicCallback(scheduler, () => counts[i]++, 250, 'animal.behavior'))
  scheduler._tick(100)
  assert.equal(
    counts.reduce((a, b) => a + b, 0),
    2
  )
  for (let i = 0; i < 14; i++) scheduler._tick(250 / 16)
  assert.deepEqual(counts, Array(16).fill(1))
  for (let i = 0; i < 16; i++) scheduler._tick(250 / 16)
  assert.deepEqual(counts, Array(16).fill(2))
})

test('thousands of animals share one task with unchanged cadence, pause and cleanup', () => {
  let paused = false
  const scheduler = new ActionScheduler({ ticker: { add() {}, remove() {} } }, () => paused)
  const counts = new Uint32Array(10000)
  const registrations = Array.from(counts, (_, i) =>
    registerPeriodicCallback(scheduler, () => counts[i]++, 250, 'animals')
  )
  assert.equal(scheduler._tasks.size, 1)
  scheduler._tick(125)
  assert.equal(
    counts.reduce((a, b) => a + b, 0),
    5000
  )
  paused = true
  scheduler._tick(10000)
  assert.equal(
    counts.reduce((a, b) => a + b, 0),
    5000
  )
  paused = false
  scheduler._tick(375)
  assert.ok(counts.every(count => count === 2))
  registrations[0].remove()
  scheduler._tick(250)
  assert.equal(counts[0], 2)
  assert.ok(counts.slice(1).every(count => count === 3))
  for (const registration of registrations) registration.remove()
  assert.equal(scheduler._tasks.size, 0)
  const task = registerPeriodicCallback(scheduler, () => {}, 250, 'animals')
  assert.equal(scheduler._tasks.size, 1)
  task.remove()
  scheduler.destroy()
})
