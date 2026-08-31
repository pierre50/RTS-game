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
  const beforeAnyWake = villager(7, 39)
  const afterEveryWake = villager(8, 20)

  assert.equal(schedule.shouldVillagerReturnHome(beforeAnyWorkEnd), false)
  assert.equal(schedule.shouldVillagerReturnHome(afterEveryWorkEnd), true)
  assert.equal(schedule.shouldVillagerBeAsleep(beforeAnyBed), false)
  assert.equal(schedule.shouldVillagerBeAsleep(afterEveryBed), true)
  assert.equal(schedule.shouldVillagerBeAsleep(beforeAnyWake), true)
  assert.equal(schedule.shouldVillagerWork(afterEveryWake), true)
})

test('villagers return home before sleeping and all resume work by 08:20', () => {
  const atNineteen = villager(19)
  const atTwentyOne = villager(21, 30)
  const atTwentyThree = villager(23)
  const atEightTwenty = villager(8, 20)

  assert.equal(schedule.shouldVillagerReturnHome(atNineteen), true)
  assert.equal(schedule.shouldVillagerBeAsleep(atTwentyOne), false)
  assert.equal(schedule.shouldVillagerBeAsleep(atTwentyThree), true)
  assert.equal(schedule.shouldVillagerWork(atEightTwenty), true)
})

test('awake villagers do not start a new sleep trip during the morning wake window', () => {
  const lateRiser = villager(8, 0, 'villager-4')

  assert.equal(schedule.shouldVillagerBeAsleep(lateRiser), true)
  assert.equal(schedule.shouldVillagerWork(lateRiser), false)
  assert.equal(schedule.shouldVillagerReturnHome(lateRiser), false)
})
