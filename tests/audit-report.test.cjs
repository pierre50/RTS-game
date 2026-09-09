const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const health = require('../tools/health/analyze.cjs')
const { collectCoverage } = require('../tools/health/coverage.cjs')

const passing = () => health.REQUIRED_CHECKS.map(id => ({ id, label: id, status: 'pass' }))

test('a perfect score cannot compensate for a failed required check', () => {
  for (const id of ['lint', 'typecheck', 'tests', 'architecture', 'duplication']) {
    const checks = passing()
    checks.find(check => check.id === id).status = 'fail'
    assert.equal(health.evaluateGate(checks, 100, []).status, 'fail')
  }
})

test('skipped, broken and absent checks never certify a report', () => {
  for (const status of ['skipped', 'error']) {
    assert.equal(health.evaluateGate([{ label: 'tests', status }], 100, []).status, 'incomplete')
  }
  assert.equal(health.evaluateGate([], 100, []).status, 'incomplete')
  assert.equal(health.evaluateGate(passing(), 79, []).status, 'fail')
  assert.equal(health.evaluateGate(passing(), 100, [{ rule: 'new-debt' }]).status, 'fail')
  assert.equal(health.evaluateGate(passing(), 80, []).status, 'pass')
})

test('invalid, empty or inconsistent duplication output is not zero duplication', () => {
  for (const source of [
    'command failed',
    '{}',
    '[]',
    JSON.stringify({ statistics: { total: { clones: 0, percentage: 0, sources: 0 } }, duplicates: [] }),
    JSON.stringify({ statistics: { total: { clones: 1, percentage: 1, sources: 2 } }, duplicates: [] }),
  ]) {
    assert.throws(() => health.parseDuplication(source))
  }
  assert.deepEqual(
    health.parseDuplication(
      JSON.stringify({ statistics: { total: { clones: 0, percentage: 0, sources: 2 } }, duplicates: [] })
    ),
    { clones: 0, percent: 0, sources: 2 }
  )
})

test('cycles must be a validated array; failure output cannot look clean', () => {
  for (const source of ['', 'tool failed', '{}', '[[]]', '[[3]]', '["foo"]'])
    assert.throws(() => health.parseCycles(source))
  assert.equal(health.parseCycles('[]').cycles, 0)
  assert.equal(health.parseCycles('[["a.ts","b.ts"]]').cycles, 1)
})

test('AST metrics ignore text and separate nested functions', () => {
  const analysis = health.analyzeSource(
    'sample.ts',
    `
// if while case && || { }
const text = 'if for while && || }';
function outer(value: boolean) {
  if (value) {
    const inner = () => { if (value) return 1; else return 2 }
    return inner()
  }
  return 0
}
`
  )
  assert.equal(analysis.branchCount, 2)
  assert.equal(analysis.functionCount, 2)
  assert.deepEqual(
    analysis.functions.map(fn => fn.complexity),
    [2, 2]
  )
  assert.deepEqual(
    analysis.functions.map(fn => fn.nesting),
    [1, 1]
  )
  assert.equal(analysis.functions[0].lines, 7)
})

test('AST metrics count ternaries, nullish coalescing and multiline methods', () => {
  const result = health.analyzeSource(
    'sample.ts',
    `class A {
    async method(
      x: number | null,
    ) {
      return (x ?? 0) ? 1 : 2
    }
  }`
  )
  assert.equal(result.functions[0].name, 'A.method')
  assert.equal(result.functions[0].complexity, 3)
  assert.equal(result.functions[0].lines, 5)
})

test('unsafe syntax and suppression comments are recorded but strings are ignored', () => {
  const result = health.analyzeSource(
    'sample.ts',
    `const text = '@ts-ignore eslint-disable';
// @ts-ignore
const x: any = null;
const y = x!;
const z = x as unknown as string;`
  )
  assert.deepEqual(result.safety.map(row => row.rule).sort(), [
    'double-assertion',
    'explicit-any',
    'non-null-assertion',
    'suppression',
  ])
})

test('regression comparison detects increases, new debt and duplicated exemptions', () => {
  const old = { rule: 'function-complexity', file: 'a.ts', identity: 'a.ts:f', fingerprint: 'same-body', value: 20 }
  assert.equal(health.compareFindings([{ ...old, value: 21 }], [old]).regressions.length, 1)
  assert.equal(health.compareFindings([{ ...old, value: 18 }], [old]).regressions.length, 0)
  assert.equal(health.compareFindings([{ ...old, file: 'b.ts', identity: 'b.ts:f' }], [old]).regressions.length, 0)
  assert.equal(health.compareFindings([old, old], [old]).regressions.length, 1)
  assert.equal(health.compareFindings([], [old]).resolved.length, 1)
})

test('architecture rules resolve real module imports, including re-exports', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'health-boundary-'))
  try {
    fs.mkdirSync(path.join(root, 'app/ui'), { recursive: true })
    fs.mkdirSync(path.join(root, 'app/services'), { recursive: true })
    fs.writeFileSync(path.join(root, 'app/ui/panel.ts'), 'export const panel = 1')
    const file = health.analyzeSource('app/services/domain.ts', `export { panel } from '../ui/panel'`)
    const findings = health.findingsFor([file], root, {})
    assert.equal(findings.length, 1)
    assert.equal(findings[0].rule, 'domain-to-ui')
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('coverage refuses a successful-looking run with no worker data', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'health-coverage-'))
  try {
    fs.mkdirSync(path.join(root, 'app/lib/combat'), { recursive: true })
    fs.mkdirSync(path.join(root, 'workers'))
    fs.writeFileSync(
      path.join(root, 'app/lib/combat/unloaded.ts'),
      'export function hit(x: boolean) { return x ? 1 : 0 }'
    )
    assert.throws(
      () => collectCoverage(root, path.join(root, 'workers'), [{ file: 'app/lib/combat/unloaded.ts' }]),
      /No test worker/
    )
    fs.writeFileSync(path.join(root, 'workers', 'worker.json'), '{}')
    const report = collectCoverage(root, path.join(root, 'workers'), [{ file: 'app/lib/combat/unloaded.ts' }])
    assert.equal(report.files.length, 1)
    assert.equal(report.summary.branches.covered, 0)
    assert.ok(report.summary.branches.total > 0)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('a missing mandatory check cannot disappear behind passing results', () => {
  const checks = passing().filter(check => check.id !== 'tests')
  const gate = health.evaluateGate(checks, 100, [])
  assert.equal(gate.status, 'incomplete')
  assert.ok(gate.reasons.includes('tests: missing'))
})

test('fatal startup errors replace a stale green report with an incomplete report', () => {
  const { spawnSync } = require('node:child_process')
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'health-fatal-'))
  try {
    fs.mkdirSync(path.join(root, 'tools'))
    fs.mkdirSync(path.join(root, 'reports'))
    fs.copyFileSync(path.join(__dirname, '../tools/audit-report.cjs'), path.join(root, 'tools/audit-report.cjs'))
    fs.cpSync(path.join(__dirname, '../tools/health'), path.join(root, 'tools/health'), { recursive: true })
    fs.symlinkSync(path.join(__dirname, '../node_modules'), path.join(root, 'node_modules'), 'dir')
    fs.writeFileSync(path.join(root, 'reports/code-health.json'), '{"qualityGate":"pass","score":100}')
    const result = spawnSync(process.execPath, [path.join(root, 'tools/audit-report.cjs')], { encoding: 'utf8' })
    assert.equal(result.status, 1)
    const report = JSON.parse(fs.readFileSync(path.join(root, 'reports/code-health.json'), 'utf8'))
    assert.equal(report.qualityGate, 'incomplete')
    assert.equal(report.score, null)
    assert.ok(report.gateReasons.length > 0)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('malformed baseline coverage cannot silently disable regression checks', () => {
  const baseline = {
    version: 1,
    findings: [],
    coverage: [{ file: 'a.ts', branches: { pct: 50, covered: 1, total: 2 } }],
  }
  assert.equal(health.validateBaseline(baseline, 1), baseline)
  for (const pct of [undefined, null, '50', -1, 101]) {
    assert.throws(() =>
      health.validateBaseline({ ...baseline, coverage: [{ file: 'a.ts', branches: { pct, covered: 1, total: 2 } }] }, 1)
    )
  }
  assert.throws(() =>
    health.validateBaseline({ ...baseline, coverage: [baseline.coverage[0], baseline.coverage[0]] }, 1)
  )
  assert.throws(() => health.validateBaseline({ ...baseline, version: 2 }, 1))
})

test('initial debt never waives failed tests and later updates require passing tests', () => {
  const { buildBaseline } = require('../tools/health/baseline.cjs')
  const checks = passing()
  Object.assign(
    checks.find(check => check.id === 'tests'),
    { status: 'fail', tests: { total: 3, failed: 1 } }
  )
  const report = {
    checks,
    findings: [],
    coverage: { files: [{ file: 'a.ts', branches: { pct: 50, total: 2, covered: 1 } }] },
  }
  assert.equal(buildBaseline(report, 'Initial measured debt', 1, true).initialValidation.tests, 'fail')
  assert.equal(health.evaluateGate(checks, 100, []).status, 'fail')
  assert.equal(buildBaseline(report, 'Do not absorb a test regression', 1, false), null)
  checks.find(check => check.id === 'snapshot').status = 'error'
  assert.equal(buildBaseline(report, 'Changed sources', 1, true), null)
})

test('test results include cancellation and reject truncated summaries', () => {
  const { parseTestResults, testsPassed } = require('../tools/health/test-results.cjs')
  const output = '# tests 3\n# pass 1\n# fail 1\n# cancelled 1\n# skipped 0\n# todo 0\n'
  const result = parseTestResults(output)
  assert.equal(result.cancelled, 1)
  assert.equal(testsPassed(result), false)
  assert.throws(() => parseTestResults(output.replace('# cancelled 1\n', '')))
  assert.throws(() => parseTestResults(output.replace('# tests 3', '# tests 4')))
  assert.equal(
    testsPassed(
      parseTestResults(
        output.replace('# pass 1', '# pass 3').replace('# fail 1', '# fail 0').replace('# cancelled 1', '# cancelled 0')
      )
    ),
    true
  )
})
