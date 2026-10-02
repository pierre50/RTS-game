const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const { isNpcStillSleeping } = loadTsModule('app/lib/npc/npcSleep.ts')

function restingNpc(wakeMinute) {
  return {
    type: 'Villager',
    context: { dayNight: { state: { hour: 6, minute: 0 } } },
    dailySchedule: { wakeMinute, workStartMinute: wakeMinute + 60, bedMinute: 1320, workEndMinute: 1080 },
    shelterState: { reason: 'sleep', status: 'outside' },
    sleepVisualState: null,
  }
}

test('6am rest respects each NPC wake time, including the exact wake minute', () => {
  assert.equal(isNpcStillSleeping(restingNpc(340)), false)
  assert.equal(isNpcStillSleeping(restingNpc(360)), false)
  assert.equal(isNpcStillSleeping(restingNpc(380)), true)
})

test('actual sleep and its wake animation block dialogue until the animation finishes', () => {
  const npc = restingNpc(340)
  for (const visual of ['sleeping', 'waking']) {
    npc.sleepVisualState = visual
    assert.equal(isNpcStillSleeping(npc), true)
  }
  npc.sleepVisualState = null
  assert.equal(isNpcStillSleeping(npc), false)
})

test('a completed early wake is available even before its scheduled wake time', () => {
  const npc = restingNpc(380)
  npc.shelterState.status = 'wakingUp'
  assert.equal(isNpcStillSleeping(npc), false)
  npc.shelterState = null
  assert.equal(isNpcStillSleeping(npc), false)
})
