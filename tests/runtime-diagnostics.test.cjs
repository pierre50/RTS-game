const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('teleport diagnostics expire, deduplicate stages and restart for the next teleport', t => {
  let now = 100
  t.mock.method(performance, 'now', () => now)
  const traces = []
  const { startTeleportDiagnostics, traceRuntime } = loadTsModule('app/lib/runtimeDiagnostics.ts', {
    mocks: {
      './loadDiagnostics': {
        traceLoad(stage, callback, details) {
          traces.push({ stage, details })
          return callback()
        },
      },
    },
  })
  let calls = 0
  const run = () => traceRuntime('ai.work', () => ++calls)
  assert.equal(run(), 1)
  assert.equal(traces.length, 0)
  startTeleportDiagnostics({ toI: 100, toJ: 200 })
  assert.equal(run(), 2)
  assert.equal(run(), 3)
  assert.equal(traces.length, 2)
  now += 15001
  traceRuntime('later', () => ++calls)
  assert.equal(traces.length, 2)
  startTeleportDiagnostics({ toI: 300, toJ: 400 })
  run()
  assert.equal(traces.length, 4)
  assert.equal(traces[3].details.session, 2)
  const failure = new Error('original failure')
  assert.throws(() => traceRuntime('failure', () => { throw failure }), error => error === failure)
  for (let index = 0; index < 1000; index++) traceRuntime(`unit.${index}`, () => ++calls)
  assert.equal(traces.length, 259, 'each teleport records at most 256 stages plus its opening trace')
  assert.equal(calls, 1005, 'the capture limit must not skip game callbacks')
})
