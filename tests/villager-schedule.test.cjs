const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { getVillagerSchedule, shouldVillagerBeAsleep, shouldVillagerWork } = loadTsModule(
  'app/lib/units/villagerSchedule.ts'
)

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
    type: 'Villager',
    i: 0,
    j: 0,
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

test('lunch interrupts work at the saved boundaries and upgrades old schedules', () => {
  const unit = {
    type: 'Villager',
    label: 'lunch',
    i: 0,
    j: 0,
    dailySchedule: { wakeMinute: 360, workStartMinute: 420, workEndMinute: 1080, bedMinute: 1320 },
    context: { dayNight: { state: { hour: 12, minute: 0 } } },
  }
  const schedule = getVillagerSchedule(unit)
  assert.ok(schedule.lunchStartMinute >= 700 && schedule.lunchStartMinute <= 740)
  assert.ok(schedule.lunchEndMinute - schedule.lunchStartMinute >= 40)
  assert.ok(schedule.lunchEndMinute - schedule.lunchStartMinute <= 80)
  for (const [minute, expected] of [
    [schedule.lunchStartMinute - 1, true],
    [schedule.lunchStartMinute, false],
    [schedule.lunchEndMinute - 1, false],
    [schedule.lunchEndMinute, true],
  ]) {
    unit.context.dayNight.state = { hour: Math.floor(minute / 60), minute: minute % 60 }
    assert.equal(shouldVillagerWork(unit), expected)
    assert.equal(shouldVillagerBeAsleep(unit), false)
  }
  assert.deepEqual(getVillagerSchedule(JSON.parse(JSON.stringify(unit))), schedule)
})

test('all scheduled roles resolve the current phase and next boundary across multiple days', () => {
  const { getDailyRoutine } = loadTsModule('app/lib/units/villagerSchedule.ts')
  for (const type of ['Villager', 'Chief', 'Fantassin', 'Bowman']) {
    const unit = {
      type,
      i: 0,
      j: 0,
      dailySchedule: {
        wakeMinute: 360,
        workStartMinute: 420,
        lunchStartMinute: 720,
        lunchEndMinute: 780,
        workEndMinute: 1080,
        bedMinute: 1320,
      },
    }
    for (const [minute, phase, next] of [
      [0, 'sleep', 360],
      [360, 'morning', 420],
      [420, 'work', 720],
      [720, 'meal', 780],
      [780, 'work', 1080],
      [1080, 'evening', 1320],
      [1320, 'sleep', 1800],
    ]) {
      assert.deepEqual(getDailyRoutine(unit, 3 * 1440 + minute), { phase, nextTransitionMinute: 3 * 1440 + next })
    }
  }
})
