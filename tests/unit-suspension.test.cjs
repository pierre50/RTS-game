const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { setUnitSuspension, isUnitSuspended, unitSuspensionReason, wakeUnitSimulation } = loadTsModule(
  'app/lib/units/unitSuspension.ts'
)
test('suspension records an explicit reason and delegates settlement to its owner', () => {
  const camp = {},
    worker = {}
  let settled = 0
  setUnitSuspension(camp, { reason: 'camp-paused', wake: () => setUnitSuspension(camp) })
  setUnitSuspension(worker, {
    reason: 'distant-work',
    wake() {
      settled++
      setUnitSuspension(worker)
    },
  })
  assert.equal(unitSuspensionReason(camp), 'camp-paused')
  assert.equal(unitSuspensionReason(worker), 'distant-work')
  wakeUnitSimulation(camp)
  assert.equal(settled, 0)
  assert.equal(isUnitSuspended(worker), true)
  wakeUnitSimulation(worker)
  wakeUnitSimulation(worker)
  assert.equal(settled, 1)
  assert.equal(isUnitSuspended(worker), false)
})
test('wake is reentrancy-safe and a failed settlement can be retried', () => {
  const unit = {}
  let calls = 0
  setUnitSuspension(unit, {
    reason: 'distant-work',
    wake() {
      calls++
      wakeUnitSimulation(unit)
      if (calls === 1) throw new Error('retry')
      setUnitSuspension(unit)
    },
  })
  assert.throws(() => wakeUnitSimulation(unit), /retry/)
  assert.equal(calls, 1)
  assert.equal(isUnitSuspended(unit), true)
  wakeUnitSimulation(unit)
  assert.equal(calls, 2)
  assert.equal(isUnitSuspended(unit), false)
})
