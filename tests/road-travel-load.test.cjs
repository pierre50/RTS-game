const test = require('node:test')
const assert = require('node:assert/strict')
const { run } = require('../scripts/benchmark-road-travel.cjs')

test('multi-owner road planning and village economy progress together under load', () => {
  const report = run(64, 2, 200)
  assert.equal(report.travelers, 64)
  assert.equal(report.workers, 40)
  assert.ok(report.planning.updates > 1, 'planning cooperates across updates')
  // Timing is reported by the benchmark, not a flaky hardware-specific assertion.
  assert.ok(Number.isFinite(report.combined.p95Ms))
})
