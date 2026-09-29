const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function fixture() {
  let notifications = false
  let plans = 0
  let snapshots = 0
  let previous
  let event = 'initial'
  const { flushCollectiveVillageWork } = loadTsModule('app/services/CollectiveVillageWork.ts', {
    mocks: {
      '../lib/units/villageWorkEvents': {
        consumeVillageWorkChange() {
          const result = notifications
          notifications = false
          return result
        },
      },
      './CollectiveVillageEvents': {
        hasCollectiveVillageEvent() {
          snapshots++
          return previous !== event
        },
        settleCollectiveVillageEvents() {
          previous = event
        },
      },
      '../lib/economy/collectiveTasks': {
        planCollectiveTasks() {
          plans++
          return new Map()
        },
      },
    },
  })
  const owner = { units: [], buildings: [] }
  return {
    run: now => flushCollectiveVillageWork(owner, now),
    notify: change => {
      notifications = true
      if (change) event = change
    },
    get plans() {
      return plans
    },
    get snapshots() {
      return snapshots
    },
  }
}

test('ordinary scheduler ticks perform neither planning nor a resource-needs snapshot', () => {
  const f = fixture()
  f.run(0)
  for (let second = 1; second < 30; second++) f.run(second * 1000)
  assert.equal(f.plans, 1)
  assert.equal(f.snapshots, 1)
  f.run(30000)
  assert.equal(f.plans, 1)
  assert.equal(f.snapshots, 2)
})

test('resource notifications coalesce and only a meaningful threshold change produces a new plan', () => {
  const f = fixture()
  f.run(0)
  for (let hit = 0; hit < 10; hit++) f.notify()
  f.run(1000)
  assert.equal(f.plans, 1)
  assert.equal(f.snapshots, 2)
  for (let hit = 0; hit < 10; hit++) f.notify('target-reached')
  f.run(2000)
  assert.equal(f.plans, 2)
  f.run(3000)
  assert.equal(f.plans, 2)
})
