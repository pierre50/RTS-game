const { validateBaseline } = require('./analyze.cjs')

// Initial debt is a reference, not a test waiver. Tests remain a mandatory gate.
// Later rebaselines require passing tests so regressions cannot be absorbed silently.
function buildBaseline(report, reason, version, initial = false) {
  const mandatory = [
    'lint',
    'typecheck',
    'duplication',
    'deadcode',
    'architecture',
    'extendedLint',
    'coverage',
    'snapshot',
  ]
  if (!reason?.trim() || mandatory.some(id => report.checks.find(check => check.id === id)?.status !== 'pass'))
    return null
  const tests = report.checks.find(check => check.id === 'tests')
  if (tests?.status !== 'pass' && !(initial && tests?.status === 'fail' && tests.tests?.total > 0)) return null
  if (report.findings.some(row => row.rule === 'syntax-error')) return null
  const baseline = {
    version,
    reason,
    generatedAt: new Date().toISOString(),
    sourceHash: report.sourceHash,
    initialValidation: {
      tests: tests.status,
      summary: tests.tests,
      note:
        tests.status === 'pass'
          ? 'Test suite passed.'
          : 'Tests failed; recorded coverage is a lower bound. This reference never exempts test failures.',
    },
    findings: report.findings,
    coverage: report.coverage.files,
  }
  return validateBaseline(baseline, version)
}
module.exports = { buildBaseline }
