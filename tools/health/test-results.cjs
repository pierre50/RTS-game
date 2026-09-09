function parseTestResults(output) {
  const results = {}
  const fields = {
    total: 'tests',
    passed: 'pass',
    failed: 'fail',
    skipped: 'skipped',
    todo: 'todo',
    cancelled: 'cancelled',
  }
  for (const [field, label] of Object.entries(fields)) {
    const match = output.match(new RegExp(`^# ${label} (\\d+)$`, 'm'))
    if (!match) throw new Error(`Missing test summary: ${label}`)
    results[field] = Number(match[1])
  }
  const accounted = results.passed + results.failed + results.skipped + results.todo + results.cancelled
  if (!results.total || accounted !== results.total) throw new Error('Empty or inconsistent test summary')
  return results
}
function testsPassed(results) {
  return results.total > 0 && results.passed === results.total
}
module.exports = { parseTestResults, testsPassed }
