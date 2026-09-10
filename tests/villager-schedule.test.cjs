const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const schedule = loadTsModule('app/lib/units/villagerSchedule.ts')

function villager(hour, minute = 0, label = 'villager-1') {
  return {
    context: { dayNight: { state: { hour, minute } } },
    i: 0,
    j: 0,
    label,
    type: 'Villager',
  }
}

test('villager schedule keeps randomized behavior inside its twenty minute windows', () => {
  const beforeAnyWorkEnd = villager(17, 39)
  const afterEveryWorkEnd = villager(18, 20)
  const beforeAnyBed = villager(21, 39)
  const afterEveryBed = villager(22, 20)
  const beforeAnyWake = villager(5, 39)
  const afterEveryWake = villager(6, 20)
  const beforeAnyWork = villager(6, 39)
  const afterEveryWork = villager(7, 20)

  assert.equal(schedule.shouldVillagerReturnHome(beforeAnyWorkEnd), false)
  assert.equal(schedule.shouldVillagerReturnHome(afterEveryWorkEnd), true)
  assert.equal(schedule.shouldVillagerBeAsleep(beforeAnyBed), false)
  assert.equal(schedule.shouldVillagerBeAsleep(afterEveryBed), true)
  assert.equal(schedule.shouldVillagerBeAsleep(beforeAnyWake), true)
  assert.equal(schedule.shouldVillagerBeAsleep(afterEveryWake), false)
  assert.equal(schedule.shouldVillagerWork(beforeAnyWork), false)
  assert.equal(schedule.shouldVillagerWork(afterEveryWork), true)
})

test('villagers return home before sleeping and all resume work by 07:20', () => {
  const atNineteen = villager(19)
  const atTwentyOne = villager(21, 30)
  const atTwentyThree = villager(23)
  const atSevenTwenty = villager(7, 20)

  assert.equal(schedule.shouldVillagerReturnHome(atNineteen), true)
  assert.equal(schedule.shouldVillagerBeAsleep(atTwentyOne), false)
  assert.equal(schedule.shouldVillagerBeAsleep(atTwentyThree), true)
  assert.equal(schedule.shouldVillagerWork(atSevenTwenty), true)
})

test('awake villagers do not start a new sleep trip during the morning wake window', () => {
  const lateRiser = villager(6, 0, 'villager-4')

  assert.equal(schedule.shouldVillagerBeAsleep(lateRiser), true)
  assert.equal(schedule.shouldVillagerWork(lateRiser), false)
  assert.equal(schedule.shouldVillagerReturnHome(lateRiser), false)
})

test('villagers linger for one hour between waking and work', () => {
  const unit = villager(12, 0, 'morning-linger')
  const { wakeMinute, workStartMinute } = schedule.getVillagerSchedule(unit)

  assert.equal(workStartMinute - wakeMinute, 60)
})
