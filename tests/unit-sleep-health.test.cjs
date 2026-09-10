const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { updateUnitSleepHealth, restoreOfflineUnitSleepHealth } = loadTsModule(
  'app/lib/units/unitSleepHealth.ts'
)
const { getVillagerSchedule } = loadTsModule('app/lib/units/villagerSchedule.ts')
const sleeper = (extra = {}) => ({
  type: 'Villager',
  label: 'worker',
  i: 1,
  j: 1,
  hitPoints: 20,
  totalHitPoints: 100,
  shelterState: { reason: 'sleep', status: 'outside' },
  sleepVisualState: 'sleeping',
  ...extra,
})

test('sleep restores health progressively inside and outside and stops on waking', () => {
  for (const status of ['inside', 'outside']) {
    const unit = sleeper({ shelterState: { reason: 'sleep', status } })
    updateUnitSleepHealth(unit, 60000)
    assert.equal(unit.hitPoints, 32.5)
    unit.sleepVisualState = 'wakingUp'
    updateUnitSleepHealth(unit, 60000)
    assert.equal(unit.hitPoints, 32.5)
    unit.sleepVisualState = 'sleeping'
    updateUnitSleepHealth(unit, 8 * 60000)
    assert.equal(unit.hitPoints, 100)
  }
})

test('sleep healing excludes dead units, heroes, travel and waiting before bedtime', () => {
  for (const extra of [
    { isDead: true },
    { isDestroyed: true },
    { type: 'Hero' },
    { controlMode: 'hero' },
    { sleepVisualState: null },
    { shelterState: { reason: 'sleep', status: 'moving' } },
    { shelterState: { reason: 'danger', status: 'inside' } },
  ]) {
    const unit = sleeper(extra)
    updateUnitSleepHealth(unit, 60000)
    assert.equal(unit.hitPoints, 20)
  }
  const unit = sleeper({ hitPoints: 0 })
  updateUnitSleepHealth(unit, 60000)
  assert.equal(unit.hitPoints, 0)
})

test('offline sleep uses actual bedtime, partial nights and repeated days', () => {
  const unit = sleeper()
  const { bedMinute } = getVillagerSchedule(unit)
  restoreOfflineUnitSleepHealth(unit, 18 * 60, bedMinute)
  assert.equal(unit.hitPoints, 20)
  restoreOfflineUnitSleepHealth(unit, bedMinute, bedMinute + 60)
  assert.equal(unit.hitPoints, 32.5)
  restoreOfflineUnitSleepHealth(unit, bedMinute + 60, 3 * 24 * 60)
  assert.equal(unit.hitPoints, 100)
})

test('offline and active sleep recover the same health across midnight', () => {
  const offline = sleeper({ type: 'Soldier' })
  const active = sleeper({ type: 'Soldier' })
  restoreOfflineUnitSleepHealth(offline, 23 * 60, 25 * 60)
  updateUnitSleepHealth(active, 2 * 60000)
  assert.equal(offline.hitPoints, active.hitPoints)
})
