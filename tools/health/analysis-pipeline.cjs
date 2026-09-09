const path = require('node:path')
const ts = require('typescript')
const health = require('./analyze.cjs')
const fs = require('node:fs')
const { buildBaseline } = require('./baseline.cjs')
const { sourceSnapshot, getChurn90d, walk, analyzeFile, relative } = require('./files.cjs')
const {
  maxFiles,
  updateBaseline,
  skipChecks,
  quick,
  ROOT,
  BASELINE_FILE,
  BASELINE_VERSION,
  REPORT_DIR,
} = require('./config.cjs')

function collectAnalysis() {
  const initialSnapshot = sourceSnapshot()
  if (!Number.isInteger(maxFiles) || maxFiles < 1 || maxFiles > 1000)
    throw new Error('--max-files must be an integer between 1 and 1000')
  const baselineReason = process.argv
    .find(arg => arg.startsWith('--baseline-reason='))
    ?.slice('--baseline-reason='.length)
    .trim()
  if (updateBaseline && !baselineReason)
    throw new Error('--update-baseline requires --baseline-reason=... to document the accepted debt')
  if (updateBaseline && (skipChecks || quick)) throw new Error('A baseline requires a full audit')
  const churn = getChurn90d()
  const files = ['app', 'engine', 'tools']
    .flatMap(dir => walk(path.join(ROOT, dir)))
    .concat(['main.js', 'preload.js'].map(file => path.join(ROOT, file)))
    .map(file => analyzeFile(file, churn))
  const config = ts.readConfigFile(path.join(ROOT, 'tsconfig.json'), ts.sys.readFile)
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'))
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, ROOT)
  const findings = health.findingsFor(files, ROOT, parsed.options)
  findings.push(...strictTypeFindings(parsed))
  let baseline = null
  let baselineError = null
  try {
    baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'))
    health.validateBaseline(baseline, BASELINE_VERSION)
  } catch (error) {
    baselineError = error.message
    baseline = null
  }
  const totals = {
    files: files.length,
    loc: files.reduce((sum, file) => sum + file.loc, 0),
    codeLines: files.reduce((sum, file) => sum + file.codeLines, 0),
    branches: files.reduce((sum, file) => sum + file.branchCount, 0),
    functions: files.reduce((sum, file) => sum + file.functionCount, 0),
  }

  return {
    initialSnapshot,
    baselineReason,
    churn,
    files,
    config,
    parsed,
    findings,
    baseline,
    baselineError,
    totals,
  }
}

function compareQuality({
  initialSnapshot,
  baselineReason,
  files,
  findings,
  baseline,
  baselineError,
  coverage,
  checks,
}) {
  const consistent = sourceSnapshot() === initialSnapshot
  checks.push({
    id: 'snapshot',
    label: 'Source consistency',
    ok: consistent,
    status: consistent ? 'pass' : 'error',
    error: consistent ? undefined : 'Source files changed during the audit; rerun on a stable checkout',
  })
  const comparison = health.compareFindings(findings, baseline?.findings ?? [])
  const coverageRegressions = compareCoverage(coverage, baseline)
  let regressions = [...comparison.regressions, ...coverageRegressions]
  let baselineUpdated = false
  const baselineCandidate = updateBaseline
    ? buildBaseline(
        { checks, findings, coverage, sourceHash: initialSnapshot },
        baselineReason,
        BASELINE_VERSION,
        !fs.existsSync(BASELINE_FILE)
      )
    : null
  if (baselineCandidate) {
    const newBaseline = baselineCandidate
    fs.mkdirSync(REPORT_DIR, { recursive: true })
    fs.writeFileSync(BASELINE_FILE, `${JSON.stringify(newBaseline, null, 2)}\n`)
    baselineUpdated = true
    regressions = []
  }
  const accepted = baselineUpdated || Boolean(baseline && !regressions.length)
  checks.push({
    id: 'regressions',
    label: 'Quality regressions',
    status: accepted ? 'pass' : baseline ? 'fail' : 'error',
    ok: accepted,
    error: baselineUpdated ? undefined : (baselineError ?? undefined),
  })
  const duplication = checks.find(check => check.id === 'duplication')?.duplication ?? { clones: null, percent: null }
  const architecture = checks.find(check => check.id === 'architecture')?.architecture ?? {
    cycles: null,
    baseline: 0,
    cycleList: [],
    topCycles: [],
  }

  return {
    consistent,
    comparison,
    coverageRegressions,
    regressions,
    baselineUpdated,
    baselineCandidate,
    duplication,
    architecture,
  }
}

module.exports = { collectAnalysis, compareQuality }

function strictTypeFindings(parsed) {
  const findings = []
  const strictProgram = ts.createProgram(parsed.fileNames, {
    ...parsed.options,
    noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true,
  })
  for (const diagnostic of ts.getPreEmitDiagnostics(strictProgram)) {
    const file = diagnostic.file ? relative(diagnostic.file.fileName) : 'tsconfig.json'
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')
    const line =
      diagnostic.file && diagnostic.start != null
        ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line + 1
        : 1
    const snippet = diagnostic.file?.text.split(/\r?\n/)[line - 1]?.trim() ?? ''
    findings.push({
      rule: 'strict-types',
      file,
      line,
      identity: `${diagnostic.code}:${message}:${snippet}`,
      value: 1,
      limit: 0,
      message,
    })
  }

  return findings
}

function compareCoverage(coverage, baseline) {
  const coverageRegressions = []
  if (coverage && baseline) {
    for (const file of coverage.files) {
      const previous = baseline.coverage.find(old => old.file === file.file)
      const floor = previous ? previous.branches.pct : 80
      if (file.branches.pct < floor)
        coverageRegressions.push({ rule: 'branch-coverage', file: file.file, value: file.branches.pct, limit: floor })
    }
  }

  return coverageRegressions
}
