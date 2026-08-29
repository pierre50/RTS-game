const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadTimeSkipActions() {
  return loadTsModule('app/dev-console/actions/timeSkip.ts')
}

test('advanceTime forwards valid next hours to the time skip system', () => {
  const { advanceTime } = loadTimeSkipActions()
  const calls = []
  const context = {
    timeSkip: {
      start: hours => {
        calls.push(['start', hours])
        return { ok: true, message: `started ${hours}` }
      },
    },
  }

  const result = advanceTime(context, '12')

  assert.equal(result.ok, true)
  assert.equal(result.message, 'started 12')
  assert.deepEqual(calls, [['start', 12]])
})

test('advanceTime only accepts 1 to 12 hours', () => {
  const { advanceTime } = loadTimeSkipActions()
  const context = {
    timeSkip: {
      start: hours => ({ ok: true, message: `started ${hours}` }),
    },
  }

  assert.equal(advanceTime(context, '12').ok, true)
  assert.deepEqual(advanceTime(context, '0'), { ok: false, message: 'Usage: next <1-12>' })
  assert.deepEqual(advanceTime(context, '13'), { ok: false, message: 'Usage: next <1-12>' })
})

test('advanceTime reports when the time skip system is unavailable', () => {
  const { advanceTime } = loadTimeSkipActions()

  assert.deepEqual(advanceTime({}, '1'), { ok: false, message: 'Time skip system unavailable' })
})
