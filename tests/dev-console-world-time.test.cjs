const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadWorldActions() {
  return loadTsModule('app/dev-console/actions/world.ts')
}

function createContext() {
  const calls = []
  return {
    dayNight: {
      getDayLabel: () => 'Day 3',
      getTimeLabel: () => '22:30',
      setTime: (hour, minute) => calls.push(['setTime', hour, minute]),
    },
    calls,
  }
}

test('setTime accepts hour-only dev-console input', () => {
  const { setTime } = loadWorldActions()
  const context = createContext()

  const result = setTime(context, '22')

  assert.equal(result.ok, true)
  assert.deepEqual(context.calls, [['setTime', 22, 0]])
  assert.equal(result.message, 'Time set to Day 3 22:30')
})

test('setTime accepts HH:MM and HHhMM dev-console input', () => {
  const { setTime } = loadWorldActions()
  const context = createContext()

  assert.equal(setTime(context, '05:45').ok, true)
  assert.equal(setTime(context, '6h30').ok, true)

  assert.deepEqual(context.calls, [
    ['setTime', 5, 45],
    ['setTime', 6, 30],
  ])
})

test('setTime rejects invalid dev-console input', () => {
  const { setTime } = loadWorldActions()
  const context = createContext()

  const result = setTime(context, '24:00')

  assert.equal(result.ok, false)
  assert.equal(result.message, 'Usage: time [HH[:MM]]')
  assert.deepEqual(context.calls, [])
})
