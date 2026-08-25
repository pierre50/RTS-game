#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')
const { execFileSync, execSync } = require('node:child_process')

const ROOT = path.resolve(__dirname, '..')
const APP_DIR = path.join(ROOT, 'app')
const REPORT_DIR = path.join(ROOT, 'reports')
const MD_REPORT = path.join(REPORT_DIR, 'code-health.md')
const JSON_REPORT = path.join(REPORT_DIR, 'code-health.json')
const ARCHITECTURE_CYCLE_BASELINE = 0
const ARCHITECTURE_TOP_CYCLE_LIMIT = 20
const MINIMUM_SCORE = 90

const CHECKS = [
  { id: 'lint', label: 'ESLint', command: 'pnpm lint' },
  { id: 'typecheck', label: 'TypeScript', command: 'pnpm typecheck' },
  { id: 'duplication', label: 'Duplication', command: 'pnpm duplication' },
  { id: 'deadcode', label: 'Dead code', command: 'pnpm deadcode' },
  { id: 'architecture', label: 'Import cycles', command: 'pnpm architecture:json' },
]

const skipChecks = process.argv.includes('--skip-checks')
const maxFiles = Number(process.argv.find(arg => arg.startsWith('--max-files='))?.split('=')[1] ?? 12)

function run(command) {
  try {
    const output = execSync(command, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 1024 * 1024 * 20,
    })
    return { ok: true, output }
  } catch (error) {
    return {
      ok: false,
      output: `${error.stdout?.toString() ?? ''}${error.stderr?.toString() ?? ''}`.trim(),
    }
  }
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walk(absolute))
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      files.push(absolute)
    }
  }
  return files
}

function relative(file) {
  return path.relative(ROOT, file)
}

function countMatches(source, pattern) {
  return source.match(pattern)?.length ?? 0
}

function getMaxBlockLines(lines) {
  let max = 0
  const starters =
    /^\s*(export\s+)?(async\s+)?(function\s+\w+|[A-Za-z_$][\w$]*\s*\([^)]*\)\s*:?[\w<>,\s[\]|.'"]*\s*\{|[A-Za-z_$][\w$]*\s*=\s*(async\s*)?\([^)]*\)\s*=>)/

  for (let index = 0; index < lines.length; index++) {
    if (!starters.test(lines[index])) continue
    let depth = 0
    let seenBrace = false
    for (let cursor = index; cursor < lines.length; cursor++) {
      const line = lines[cursor]
      depth += countMatches(line, /\{/g)
      if (line.includes('{')) seenBrace = true
      depth -= countMatches(line, /\}/g)
      if (seenBrace && depth <= 0) {
        max = Math.max(max, cursor - index + 1)
        break
      }
    }
  }

  return max
}

function analyzeFile(file, churn) {
  const source = fs.readFileSync(file, 'utf8')
  const lines = source.split(/\r?\n/)
  const loc = lines.length
  const codeLines = lines.filter(line => line.trim() && !line.trim().startsWith('//')).length
  const branchCount =
    countMatches(source, /\b(if|else if|for|while|case|catch)\b/g) +
    countMatches(source, /&&|\|\|/g)
  const functionCount =
    countMatches(source, /\bfunction\s+\w+/g) +
    countMatches(source, /=>/g) +
    countMatches(source, /^\s*(async\s+)?[A-Za-z_$][\w$]*\s*\([^)]*\)\s*[:{]/gm)
  const importCount = countMatches(source, /^\s*import\s/gm)
  const exportCount = countMatches(source, /^\s*export\s/gm)
  const maxBlockLines = getMaxBlockLines(lines)
  const rel = relative(file)
  const churnCount = churn.get(rel) ?? 0
  const risk =
    loc * 0.025 +
    branchCount * 1.5 +
    Math.max(0, maxBlockLines - 80) * 0.8 +
    churnCount * 3 +
    Math.max(0, importCount - 20) * 1.2

  return {
    file: rel,
    loc,
    codeLines,
    branchCount,
    functionCount,
    importCount,
    exportCount,
    maxBlockLines,
    churn90d: churnCount,
    risk: Math.round(risk * 10) / 10,
  }
}

function getChurn90d() {
  const result = new Map()
  try {
    const output = execFileSync('git', ['log', '--since=90 days ago', '--name-only', '--pretty=format:', '--', 'app'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    for (const line of output.split(/\r?\n/)) {
      const file = line.trim()
      if (!file.endsWith('.ts')) continue
      result.set(file, (result.get(file) ?? 0) + 1)
    }
  } catch {
    // Git history is a nice-to-have signal; keep the report useful without it.
  }
  return result
}

function parseDuplication(output) {
  const clones = Number(output.match(/Found\s+(\d+)\s+clones?/)?.[1] ?? 0)
  const percent = Number(output.match(/Total:[\s\S]*?\(([\d.]+)%\)/)?.[1] ?? 0)
  return { clones, percent }
}

function parseCircularDependencies(output) {
  const source = output.trim()
  const start = source.startsWith('[') ? 0 : source.lastIndexOf('\n[') + 1
  const lifecycleIndex = source.indexOf('\n[ELIFECYCLE]')
  const searchEnd = lifecycleIndex === -1 ? source.length : lifecycleIndex
  const end = source.lastIndexOf(']', searchEnd)
  if (start === -1 || end === -1 || end < start) {
    return { cycles: null, baseline: ARCHITECTURE_CYCLE_BASELINE, topCycles: [] }
  }

  try {
    const cycles = JSON.parse(source.slice(start, end + 1))
    return {
      cycles: Array.isArray(cycles) ? cycles.length : null,
      baseline: ARCHITECTURE_CYCLE_BASELINE,
      cycleList: Array.isArray(cycles) ? cycles : [],
      topCycles: Array.isArray(cycles) ? cycles.slice(0, ARCHITECTURE_TOP_CYCLE_LIMIT) : [],
    }
  } catch {
    return { cycles: null, baseline: ARCHITECTURE_CYCLE_BASELINE, cycleList: [], topCycles: [] }
  }
}

function scoreChecks(checks) {
  if (checks.length === 0) return 25
  const qualityChecks = checks.filter(check => check.id !== 'duplication' && check.id !== 'architecture')
  const passed = qualityChecks.filter(check => check.ok).length
  return (passed / Math.max(1, qualityChecks.length)) * 25
}

function scoreDuplication(duplication) {
  if (duplication.clones == null) return 12
  const penalty = Math.min(20, duplication.clones * 2 + duplication.percent * 30)
  return Math.max(0, 20 - penalty)
}

function scoreStructure(files) {
  const largeFiles = files.filter(file => file.loc >= 1000).length
  const hugeFiles = files.filter(file => file.loc >= 1500).length
  const complexFiles = files.filter(file => file.branchCount >= 120 || file.maxBlockLines >= 160).length
  const penalty = largeFiles * 0.9 + hugeFiles * 1.3 + complexFiles * 0.8
  return Math.max(0, 20 - penalty)
}

function scoreArchitecture(architecture) {
  if (architecture.cycles == null) return 5
  const penalty = Math.min(15, architecture.cycles * 0.12)
  return Math.max(0, 15 - penalty)
}

function scoreHotspots(files) {
  const riskyHotspots = files.filter(file => file.churn90d >= 8 && (file.loc >= 600 || file.branchCount >= 80)).length
  return Math.max(0, 10 - riskyHotspots * 0.8)
}

function scoreTests(checks) {
  const typecheck = checks.find(check => check.id === 'typecheck')
  const lint = checks.find(check => check.id === 'lint')
  return (typecheck?.ok ? 5 : 0) + (lint?.ok ? 5 : 0)
}

function grade(score) {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'E'
}

function priorityReason(file) {
  const reasons = []
  if (file.loc >= 1500) reasons.push('fichier tres volumineux')
  else if (file.loc >= 1000) reasons.push('fichier volumineux')
  if (file.branchCount >= 160) reasons.push('beaucoup de branches')
  else if (file.branchCount >= 100) reasons.push('complexite elevee')
  if (file.maxBlockLines >= 180) reasons.push('gros bloc/fonction')
  if (file.churn90d >= 8) reasons.push('souvent modifie')
  if (file.importCount >= 25) reasons.push('beaucoup de dependances')
  return reasons.join(', ') || 'score de risque relatif eleve'
}

function markdownTable(rows, columns) {
  const header = `| ${columns.map(column => column.label).join(' | ')} |`
  const divider = `| ${columns.map(() => '---').join(' | ')} |`
  const body = rows.map(row => `| ${columns.map(column => String(column.value(row))).join(' | ')} |`)
  return [header, divider, ...body].join('\n')
}

function cycleArea(cycle) {
  const areas = new Set(cycle.map(file => file.split('/')[0] ?? 'app'))
  return [...areas].join(', ')
}

function countCycleFiles(cycles) {
  const counts = new Map()
  for (const cycle of cycles) {
    for (const file of cycle) {
      counts.set(file, (counts.get(file) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([file, count]) => ({ file, count }))
    .sort((a, b) => b.count - a.count || a.file.localeCompare(b.file))
}

function main() {
  const churn = getChurn90d()
  const files = walk(APP_DIR).map(file => analyzeFile(file, churn))
  const totals = {
    files: files.length,
    loc: files.reduce((sum, file) => sum + file.loc, 0),
    codeLines: files.reduce((sum, file) => sum + file.codeLines, 0),
    branches: files.reduce((sum, file) => sum + file.branchCount, 0),
    functions: files.reduce((sum, file) => sum + file.functionCount, 0),
  }

  const checks = skipChecks
    ? []
    : CHECKS.map(check => {
        const result = run(check.command)
        const architecture = check.id === 'architecture' ? parseCircularDependencies(result.output) : undefined
        const ok =
          check.id === 'architecture' && architecture?.cycles != null
            ? architecture.cycles <= architecture.baseline
            : result.ok
        return {
          ...check,
          ok,
          output: result.output.slice(-4000),
          duplication: check.id === 'duplication' ? parseDuplication(result.output) : undefined,
          architecture,
        }
      })
  const duplication = checks.find(check => check.id === 'duplication')?.duplication ?? { clones: null, percent: null }
  const architecture = checks.find(check => check.id === 'architecture')?.architecture ?? {
    cycles: null,
    baseline: ARCHITECTURE_CYCLE_BASELINE,
    cycleList: [],
    topCycles: [],
  }

  const topRisk = [...files].sort((a, b) => b.risk - a.risk).slice(0, maxFiles)
  const largest = [...files].sort((a, b) => b.loc - a.loc).slice(0, maxFiles)
  const complex = [...files].sort((a, b) => b.branchCount - a.branchCount).slice(0, maxFiles)
  const hotspots = [...files].sort((a, b) => b.churn90d - a.churn90d || b.risk - a.risk).slice(0, maxFiles)
  const cycleHubs = countCycleFiles(architecture.cycleList).slice(0, maxFiles)

  const componentScores = {
    gates: Math.round(scoreChecks(checks)),
    duplication: Math.round(scoreDuplication(duplication)),
    structure: Math.round(scoreStructure(files)),
    architecture: Math.round(scoreArchitecture(architecture)),
    hotspots: Math.round(scoreHotspots(files)),
    typeAndLintConfidence: Math.round(scoreTests(checks)),
  }
  const score = Math.round(Object.values(componentScores).reduce((sum, value) => sum + value, 0))
  const generatedAt = new Date().toISOString()
  const report = {
    generatedAt,
    score,
    grade: grade(score),
    minimumScore: MINIMUM_SCORE,
    qualityGate: score >= MINIMUM_SCORE ? 'pass' : 'fail',
    totals,
    checks: checks.map(({ output: _output, ...check }) => check),
    componentScores,
    duplication,
    architecture,
    topRisk,
    largest,
    complex,
    hotspots,
    cycleHubs,
  }

  const checkRows = checks.map(check => ({
    name: check.label,
    status: check.ok ? 'OK' : 'FAIL',
    detail:
      check.id === 'duplication' && check.duplication
        ? `${check.duplication.clones} clones, ${check.duplication.percent}%`
        : check.id === 'architecture' && check.architecture
          ? `${check.architecture.cycles ?? 'unknown'} cycles / baseline gate ${check.architecture.baseline}`
        : '',
  }))

  const md = `# Code Health Report

Generated: ${generatedAt}

## Global Score

**${score}/100 (${grade(score)})**

Minimum required score: **${MINIMUM_SCORE}/100**. Quality gate: **${score >= MINIMUM_SCORE ? 'PASS' : 'FAIL'}**.

| Component | Score |
| --- | --- |
| Gates | ${componentScores.gates}/25 |
| Duplication | ${componentScores.duplication}/20 |
| Structure | ${componentScores.structure}/20 |
| Architecture | ${componentScores.architecture}/15 |
| Hotspots | ${componentScores.hotspots}/10 |
| Type/Lint confidence | ${componentScores.typeAndLintConfidence}/10 |

> Architecture is scored separately from the baseline gate: staying at or below the baseline keeps the check green, but existing cycles still reduce the global quality score.

## Summary

- Files analyzed: ${totals.files}
- Total lines: ${totals.loc}
- Code lines: ${totals.codeLines}
- Approx branches: ${totals.branches}
- Approx functions/methods: ${totals.functions}
- Duplication: ${
    duplication.clones == null ? 'not measured' : `${duplication.clones} clones, ${duplication.percent}%`
  }
- Import cycles: ${
    architecture.cycles == null ? 'not measured' : `${architecture.cycles} cycles / baseline ${architecture.baseline}`
  }

## Checks

${
  checks.length
    ? markdownTable(checkRows, [
        { label: 'Check', value: row => row.name },
        { label: 'Status', value: row => row.status },
        { label: 'Detail', value: row => row.detail },
      ])
    : 'Checks skipped with `--skip-checks`.'
}

## Top Priorities

${markdownTable(topRisk, [
  { label: 'File', value: row => row.file },
  { label: 'Risk', value: row => row.risk },
  { label: 'LOC', value: row => row.loc },
  { label: 'Branches', value: row => row.branchCount },
  { label: 'Max Block', value: row => row.maxBlockLines },
  { label: 'Churn 90d', value: row => row.churn90d },
  { label: 'Why', value: priorityReason },
])}

## Largest Files

${markdownTable(largest, [
  { label: 'File', value: row => row.file },
  { label: 'LOC', value: row => row.loc },
  { label: 'Branches', value: row => row.branchCount },
  { label: 'Imports', value: row => row.importCount },
])}

## Complexity Signals

${markdownTable(complex, [
  { label: 'File', value: row => row.file },
  { label: 'Branches', value: row => row.branchCount },
  { label: 'Max Block', value: row => row.maxBlockLines },
  { label: 'LOC', value: row => row.loc },
])}

## Git Hotspots

${markdownTable(hotspots, [
  { label: 'File', value: row => row.file },
  { label: 'Churn 90d', value: row => row.churn90d },
  { label: 'Risk', value: row => row.risk },
  { label: 'LOC', value: row => row.loc },
])}

## Dependency Cycles

${
  architecture.cycles == null
    ? 'Import cycles were not measured.'
    : `Madge found **${architecture.cycles} circular dependencies**. Architecture score: **${componentScores.architecture}/15**. Baseline gate: **${architecture.baseline}**.`
}

Fix priority:

1. Break barrel/helper cycles around \`lib/index.ts\`, \`types/entities.ts\`, and projectile helpers.
2. Then handle local two-way feature splits such as AI, map generation, controls, menu, building, and unit modules.
3. Keep the baseline gate so new cycles cannot sneak in while old ones are being removed.

### Cycle Hubs

${
  cycleHubs.length
    ? markdownTable(cycleHubs, [
        { label: 'File', value: row => row.file },
        { label: 'Cycles', value: row => row.count },
      ])
    : 'No cycle hubs measured.'
}

### Sample Cycles

${
  architecture.topCycles.length
    ? markdownTable(
        architecture.topCycles.map((cycle, index) => ({
          index: index + 1,
          length: cycle.length,
          area: cycleArea(cycle),
          path: cycle.join(' -> '),
        })),
        [
          { label: '#', value: row => row.index },
          { label: 'Len', value: row => row.length },
          { label: 'Area', value: row => row.area },
          { label: 'Cycle', value: row => row.path },
        ]
      )
    : ''
}

## Notes

- Complexity is an approximation based on branch keywords/operators; use it as a prioritization signal.
- Churn is based on Git commits from the last 90 days.
- Import-cycle baseline avoids making existing architecture debt fail the audit, while preventing regressions.
- The score is intentionally project-local: it rewards passing checks, low duplication, smaller modules, and lower-risk hotspots.
`

  fs.mkdirSync(REPORT_DIR, { recursive: true })
  fs.writeFileSync(MD_REPORT, md)
  fs.writeFileSync(JSON_REPORT, `${JSON.stringify(report, null, 2)}\n`)

  console.log(`Code health: ${score}/100 (${grade(score)})`)
  console.log(`Markdown: ${relative(MD_REPORT)}`)
  console.log(`JSON: ${relative(JSON_REPORT)}`)
  if (duplication.clones != null) console.log(`Duplication: ${duplication.clones} clones, ${duplication.percent}%`)
  if (architecture.cycles != null) {
    console.log(`Import cycles: ${architecture.cycles} / baseline ${architecture.baseline}`)
  }
  if (topRisk.length) {
    console.log('Top priorities:')
    topRisk.slice(0, 5).forEach((file, index) => {
      console.log(`${index + 1}. ${file.file} - risk ${file.risk} (${priorityReason(file)})`)
    })
  }
  if (score < MINIMUM_SCORE) {
    console.error(`Code health gate failed: ${score}/100 is below required ${MINIMUM_SCORE}/100.`)
    process.exitCode = 1
  }
}

main()
