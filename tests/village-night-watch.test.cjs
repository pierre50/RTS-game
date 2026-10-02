const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { configureVillageNightWatch, isNightWatchDuty } = loadTsModule('app/lib/units/villageNightWatch.ts')
const { getDailyRoutine } = loadTsModule('app/lib/units/villagerSchedule.ts')
const { restoreOfflineUnitSleepHealth } = loadTsModule('app/lib/units/unitSleepHealth.ts')
function roster(type = 'village') {
  return {
    type: 'AI',
    settlementType: type,
    units: ['Chief', 'Fantassin', 'Fantassin', 'Fantassin', 'Bowman', 'Villager'].map((type, i) => ({
      type,
      label: `u${i}`,
      i,
      j: 0,
    })),
  }
}
test('each settlement splits ordinary soldiers into two watches and leaves the chief escort and civilians alone', () => {
  for (const type of ['village', 'city', 'outpost']) {
    const owner = roster(type)
    configureVillageNightWatch(owner)
    assert.deepEqual(
      owner.units.map(unit => unit.dailySchedule?.nightWatch),
      [undefined, undefined, undefined, 'early', 'late', undefined]
    )
    const saved = JSON.parse(JSON.stringify(owner))
    configureVillageNightWatch(saved)
    assert.deepEqual(saved, owner)
    const player = roster(type)
    player.isPlayed = true
    configureVillageNightWatch(player)
    assert.ok(player.units.every(unit => !unit.dailySchedule?.nightWatch))
  }
})
test('midnight and the 2 am relief resolve directly, including after reload and multiple days', () => {
  const owner = roster()
  configureVillageNightWatch(owner)
  const early = owner.units[3],
    late = owner.units[4]
  for (const [minute, first, second] of [
    [1320, 'work', 'sleep'],
    [1440, 'work', 'sleep'],
    [1560, 'sleep', 'work'],
    [1799, 'sleep', 'work'],
    [1800, 'morning', 'morning'],
  ]) {
    assert.equal(getDailyRoutine(early, minute).phase, first)
    assert.equal(getDailyRoutine(late, minute).phase, second)
    assert.equal(isNightWatchDuty(early, minute), first === 'work')
    assert.equal(isNightWatchDuty(late, minute), second === 'work')
  }
  assert.equal(getDailyRoutine(early, 1440).nextTransitionMinute, 1560)
})
test('offline night recovery counts only the sleeping half, never the patrol shift', () => {
  const owner = roster()
  configureVillageNightWatch(owner)
  for (const soldier of owner.units.slice(3, 5)) {
    Object.assign(soldier, { hitPoints: 1, totalHitPoints: 80 })
    restoreOfflineUnitSleepHealth(soldier, 1320, 1800)
    assert.equal(soldier.hitPoints, 41)
  }
})
