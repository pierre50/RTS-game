const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const {
  scheduleVillagerExplorationResume: schedule,
  cancelVillagerExplorationResume: cancel,
  getVillagerExplorationSearch: search,
} = loadTsModule('app/lib/units/autonomy/villagerExploration.ts')
function fixture() {
  const tasks = []
  const removed = []
  const scheduler = {
    addOneShot(callback, delay, name) {
      tasks.push({ callback, delay, name })
      return tasks.length - 1
    },
    remove: id => removed.push(id),
  }
  return { unit: { autonomousJob: 'wood', spaceId: 'outside', context: { scheduler } }, tasks, removed }
}
test('exploration resume registers once, accepts task zero and cancellation invalidates queued callbacks', () => {
  const f = fixture()
  const resumed = []
  cancel(f.unit)
  schedule(f.unit, unit => resumed.push(unit))
  schedule(f.unit, unit => resumed.push(unit))
  assert.equal(f.tasks.length, 1)
  assert.equal(f.tasks[0].delay, 250)
  cancel(f.unit)
  assert.deepEqual(f.removed, [0])
  schedule(f.unit, unit => resumed.push(unit), 500)
  f.tasks[0].callback()
  assert.deepEqual(resumed, [])
  f.tasks[1].callback()
  assert.deepEqual(resumed, [f.unit])
  assert.equal(f.tasks[1].delay, 500)
  f.tasks[1].callback()
  assert.equal(resumed.length, 1)
  cancel(f.unit)
  assert.deepEqual(f.removed, [0])
})
test('exploration resume ignores missing jobs and unavailable schedulers', () => {
  for (const unit of [
    {},
    { autonomousJob: 'wood' },
    { autonomousJob: 'wood', context: {} },
    { autonomousJob: 'wood', context: { scheduler: {} } },
  ])
    schedule(unit, () => assert.fail('unexpected resume'))
  const f = fixture()
  delete f.unit.autonomousJob
  schedule(f.unit, () => assert.fail('unexpected resume'))
  assert.equal(f.tasks.length, 0)
})
test('queued exploration cannot override changed jobs, spaces, orders or unavailable units', () => {
  for (const state of [
    { isDead: true },
    { isDestroyed: true },
    { autonomousJob: 'farm' },
    { spaceId: 'inside' },
    { dest: {} },
    { action: 'hunt' },
    { path: [{}] },
    { actionLocked: true },
    { shelterState: {} },
    { lookingAtHero: true },
    { followingHero: true },
  ]) {
    const f = fixture()
    let resumed = false
    schedule(f.unit, () => {
      resumed = true
    })
    Object.assign(f.unit, state)
    f.tasks[0].callback()
    assert.equal(resumed, false, JSON.stringify(state))
  }
  const f = fixture()
  let count = 0
  f.unit.path = []
  schedule(f.unit, () => count++)
  f.tasks[0].callback()
  assert.equal(count, 1)
})
test('exploration remembers failed cells, expands to its limit and resets for another map', t => {
  let now = 1000
  t.mock.method(performance, 'now', () => now)
  const unit = {}
  const map = {}
  let current = search(unit, map, 120)
  assert.equal(current.radius, 50)
  assert.equal(current.canTry(2, 3), true)
  current.remember(2, 3)
  assert.equal(current.canTry(2, 3), false)
  current.expand()
  current = search(unit, map, 120)
  assert.equal(current.radius, 100)
  assert.equal(current.canTry(2, 3), false)
  current.expand()
  current.expand()
  assert.equal(search(unit, map, 120).radius, 120)
  now = 60999
  assert.equal(search(unit, map, 120).canTry(2, 3), false)
  now = 61000
  assert.equal(search(unit, map, 120).canTry(2, 3), true)
  current.remember(2, 3)
  current = search(unit, {}, 20)
  assert.equal(current.radius, 20)
  assert.equal(current.canTry(2, 3), true)
})
