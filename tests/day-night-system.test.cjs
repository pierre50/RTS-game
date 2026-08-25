const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadDayNightSystem() {
  return loadTsModule('app/services/DayNightSystem.ts', {
    mocks: {
      '../lib/lang': {
        t: (_key, params) => `Day ${params.day}`,
      },
    },
  }).DayNightSystem
}

function createContext() {
  const tickerCallbacks = new Set()
  const topbarCalls = []
  return {
    app: {
      ticker: {
        add: callback => tickerCallbacks.add(callback),
        remove: callback => tickerCallbacks.delete(callback),
      },
    },
    menu: {
      updateTopbar: () => topbarCalls.push('topbar'),
    },
    topbarCalls,
  }
}

test('setTime updates the runtime clock and darkness for the current day', () => {
  const DayNightSystem = loadDayNightSystem()
  const context = createContext()
  const dayNight = new DayNightSystem(context)

  dayNight.setTime(22, 30)

  assert.equal(dayNight.getDayLabel(), 'Day 1')
  assert.equal(dayNight.getTimeLabel(), '22:30')
  assert.equal(dayNight.state.phase, 'night')
  assert.equal(dayNight.state.darkness, 1)
  assert.deepEqual(context.topbarCalls, ['topbar'])
})

test('setTime supports after-midnight hours without rolling the displayed day', () => {
  const DayNightSystem = loadDayNightSystem()
  const dayNight = new DayNightSystem(createContext())

  dayNight.setTime(2, 15)

  assert.equal(dayNight.getDayLabel(), 'Day 1')
  assert.equal(dayNight.getTimeLabel(), '02:15')
  assert.equal(dayNight.state.phase, 'night')
})

test('setTime advances to the next day when the requested hour is behind the current clock', () => {
  const DayNightSystem = loadDayNightSystem()
  const dayNight = new DayNightSystem(createContext())

  dayNight.setTime(22)
  dayNight.setTime(7)

  assert.equal(dayNight.getDayLabel(), 'Day 2')
  assert.equal(dayNight.getTimeLabel(), '07:00')
  assert.equal(dayNight.state.phase, 'dawn')
})

test('setTime advances a full day when the requested time matches the current clock', () => {
  const DayNightSystem = loadDayNightSystem()
  const dayNight = new DayNightSystem(createContext())

  dayNight.setTime(8)

  assert.equal(dayNight.getDayLabel(), 'Day 2')
  assert.equal(dayNight.getTimeLabel(), '08:00')
})
