const { execFileSync, execSync } = require('node:child_process')
const fs = require('node:fs')
const health = require('./analyze.cjs')
const path = require('node:path')
const { parseTestResults, testsPassed } = require('./test-results.cjs')
const os = require('node:os')
const { collectCoverage } = require('./coverage.cjs')
const { ROOT, skipChecks, quick, REPORT_DIR, CHECKS } = require('./config.cjs')
const { relative } = require('./files.cjs')

function run(command, env = {}) {
  const started = Date.now()
  try {
    const output = execSync(command, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 1024 * 1024 * 20,
      timeout: 10 * 60 * 1000,
      env: { ...process.env, ...env },
    })
    return { ok: true, stdout: output, output, exitCode: 0, durationMs: Date.now() - started }
  } catch (error) {
    return {
      ok: false,
      stdout: error.stdout?.toString() ?? '',
      exitCode: error.status ?? null,
      durationMs: Date.now() - started,
      error:
        error.code === 'ETIMEDOUT'
          ? 'Command timed out after 10 minutes'
          : `Command exited with ${error.status ?? error.signal ?? 'an execution error'}`,
      output: `${error.stdout?.toString() ?? ''}${error.stderr?.toString() ?? ''}`.trim(),
    }
  }
}

function applyTypedLint(row, result, findings) {
  const results = JSON.parse(result.stdout)
  if (![0, 1].includes(result.exitCode) || !Array.isArray(results) || !results.length)
    throw new Error('Typed lint did not produce valid results')
  const rules = ['@typescript-eslint/no-floating-promises', '@typescript-eslint/no-misused-promises']
  row.status = 'pass'
  for (const entry of results)
    for (const message of entry.messages) {
      if (!rules.includes(message.ruleId)) {
        if (message.severity > 0) row.status = 'fail'
        continue
      }
      const snippet = fs.readFileSync(entry.filePath, 'utf8').split(/\r?\n/)[message.line - 1]?.trim() ?? ''
      findings.push({
        rule: message.ruleId,
        file: relative(entry.filePath),
        line: message.line,
        identity: `${message.ruleId}:${snippet}`,
        value: 1,
        limit: 0,
        message: message.message,
      })
    }
}

function runCheck(check, tempDir, coverageDir, findings) {
  if (skipChecks || (quick && check.id === 'tests')) return { ...check, ok: false, status: 'skipped' }
  console.log(`Checking ${check.label}...`)
  const command =
    check.id === 'duplication'
      ? `pnpm exec jscpd app engine --pattern "**/*.ts" --ignore "**/*.d.ts" --min-lines 8 --min-tokens 80 --reporters json --threshold 0 --output "${tempDir}"`
      : check.command
  const result = run(
    command,
    check.id === 'tests'
      ? { BABEL_ENV: 'health', HEALTH_COVERAGE_DIR: coverageDir }
      : check.id === 'extendedLint'
        ? { HEALTH_EXTENDED_LINT: '1' }
        : {}
  )
  const row = {
    ...check,
    ...result,
    output: result.output.slice(-8000),
    status: result.ok ? 'pass' : result.exitCode == null ? 'error' : 'fail',
  }
  parseCheckOutput(check, row, result, tempDir, findings)
  row.ok = row.status === 'pass'
  if (row.ok) delete row.error
  if (!row.ok) {
    const logDir = path.join(REPORT_DIR, 'health-logs')
    fs.mkdirSync(logDir, { recursive: true })
    row.logFile = relative(path.join(logDir, `${check.id}.log`))
    fs.writeFileSync(path.join(ROOT, row.logFile), result.output)
  }
  return row
}

function measureChecks({ files, findings }) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kaelor-health-'))
  const coverageDir = path.join(tempDir, 'coverage')
  fs.mkdirSync(coverageDir)
  let coverage = null
  let checks
  try {
    checks = CHECKS.map(check => runCheck(check, tempDir, coverageDir, findings))
    if (!skipChecks && !quick) {
      try {
        coverage = collectCoverage(ROOT, coverageDir, files)
        checks.push({ id: 'coverage', label: 'Critical branch coverage', ok: true, status: 'pass' })
      } catch (error) {
        checks.push({
          id: 'coverage',
          label: 'Critical branch coverage',
          ok: false,
          status: 'error',
          error: error.message,
        })
      }
    } else checks.push({ id: 'coverage', label: 'Critical branch coverage', ok: false, status: 'skipped' })
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }

  return { tempDir, coverageDir, coverage, checks }
}

module.exports = { measureChecks }

function parseCheckOutput(check, row, result, tempDir, findings) {
  try {
    if (check.id === 'duplication') {
      row.duplication = health.parseDuplication(fs.readFileSync(path.join(tempDir, 'jscpd-report.json'), 'utf8'))
      if (row.duplication.clones > 0) row.status = 'fail'
    }
    if (check.id === 'architecture') {
      row.architecture = health.parseCycles(result.stdout)
      if (row.architecture.cycles > 0) row.status = 'fail'
    }
    if (check.id === 'extendedLint') applyTypedLint(row, result, findings)
    if (check.id === 'tests') {
      row.tests = parseTestResults(result.output)
      if (!testsPassed(row.tests)) row.status = 'fail'
    }
  } catch (error) {
    row.status = 'error'
    row.error = error.message
  }
}
