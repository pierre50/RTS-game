const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { getVillagerSchedule, shouldVillagerBeAsleep, shouldVillagerWork } = loadTsModule('app/lib/units/villagerSchedule.ts')

test('schedule stays fixed after movement and survives serialization', () => {
  const unit = { type: 'Villager', i: 1, j: 2 }
  const schedule = { ...getVillagerSchedule(unit) }
  unit.i = 100
  unit.j = 200
  unit.label = 'assigned-later'
  assert.deepEqual(getVillagerSchedule(unit), schedule)
  assert.deepEqual(getVillagerSchedule(JSON.parse(JSON.stringify(unit))), schedule)
})

test('saved individual times drive wake, work and bedtime boundaries', () => {
  const unit = {
    type: 'Villager', i: 0, j: 0,
    dailySchedule: { wakeMinute: 375, workStartMinute: 435, workEndMinute: 1095, bedMinute: 1335 },
    context: { dayNight: { state: { hour: 6, minute: 14 } } },
  }
  assert.equal(shouldVillagerBeAsleep(unit), true)
  unit.context.dayNight.state.minute = 15
  assert.equal(shouldVillagerBeAsleep(unit), false)
  assert.equal(shouldVillagerWork(unit), false)
  unit.context.dayNight.state.hour = 7
  assert.equal(shouldVillagerWork(unit), true)
  unit.context.dayNight.state.hour = 18
  assert.equal(shouldVillagerWork(unit), false)
  assert.equal(shouldVillagerBeAsleep(unit), false)
  unit.context.dayNight.state.hour = 22
  assert.equal(shouldVillagerBeAsleep(unit), true)
})
