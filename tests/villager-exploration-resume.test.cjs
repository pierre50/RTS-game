const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { scheduleVillagerExplorationResume, cancelVillagerExplorationResume, getVillagerExplorationSearch } =
  loadTsModule('app/lib/units/autonomy/villagerExploration.ts')

function harness() {
  const tasks = new Map()
  let id = 0
  let resumes = 0
  const unit = {
    autonomousJob: 'food',
    action: null,
    dest: null,
    path: [],
    context: {
      scheduler: {
        addOneShot(callback, delay) {
          tasks.set(++id, { callback, delay })
          return id
        },
        remove(id) {
          tasks.delete(id)
        },
      },
    },
  }
  return { unit, tasks, resume: () => resumes++, count: () => resumes }
}

test('continuation is deferred and duplicate requests schedule only one task', () => {
  const h = harness()
  scheduleVillagerExplorationResume(h.unit, h.resume)
  scheduleVillagerExplorationResume(h.unit, h.resume)
  assert.equal(h.count(), 0)
  assert.equal(h.tasks.size, 1)
  assert.equal(h.tasks.get(1).delay, 250)
  h.tasks.get(1).callback()
  h.tasks.get(1).callback()
  assert.equal(h.count(), 1)
})

test('a new order cancels even a callback already queued by the scheduler', () => {
  const h = harness()
  scheduleVillagerExplorationResume(h.unit, h.resume)
  const stale = h.tasks.get(1).callback
  cancelVillagerExplorationResume(h.unit)
  stale()
  assert.equal(h.tasks.size, 0)
  assert.equal(h.count(), 0)
})

test('continuation respects death, changed jobs, movement, interaction and map spaces', () => {
  for (const change of [
    { isDead: true },
    { isDestroyed: true },
    { autonomousJob: 'wood' },
    { dest: {} },
    { action: 'forageberry' },
    { path: [{}] },
    { shelterState: {} },
    { lookingAtHero: true },
    { followingHero: true },
    { actionLocked: true },
    { spaceId: 'house' },
  ]) {
    const h = harness()
    scheduleVillagerExplorationResume(h.unit, h.resume)
    Object.assign(h.unit, change)
    h.tasks.get(1).callback()
    assert.equal(h.count(), 0, JSON.stringify(change))
  }
})

test('failed searches retry slowly, and exploration memory is isolated by map space', () => {
  const h = harness()
  scheduleVillagerExplorationResume(h.unit, h.resume, 2000)
  assert.equal(h.tasks.get(1).delay, 2000)
  const grid = []
  const search = getVillagerExplorationSearch(h.unit, grid, 200)
  search.remember(5, 5)
  search.expand()
  const next = getVillagerExplorationSearch(h.unit, grid, 200)
  assert.equal(next.radius, 100)
  assert.equal(next.canTry(5, 5), false)
  const interior = getVillagerExplorationSearch(h.unit, [], 10)
  assert.equal(interior.radius, 10)
  assert.equal(interior.canTry(5, 5), true)
})
