const fs = require('node:fs')
const path = require('node:path')
const health = require('./analyze.cjs')
const { execFileSync, execSync } = require('node:child_process')
const crypto = require('node:crypto')
const { ROOT, HOTSPOT_LOC_THRESHOLD, HOTSPOT_BRANCH_THRESHOLD, BASELINE_FILE } = require('./config.cjs')

function walk(dir, includeDeclarations = false) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walk(absolute, includeDeclarations))
    } else if (
      entry.isFile() &&
      /\.(ts|cjs|js)$/.test(entry.name) &&
      (includeDeclarations || !entry.name.endsWith('.d.ts'))
    ) {
      files.push(absolute)
    }
  }
  return files
}

function relative(file) {
  return path.relative(ROOT, file)
}

function analyzeFile(file, churn) {
  const source = fs.readFileSync(file, 'utf8')
  const lines = source.split(/\r?\n/)
  const loc = lines.length
  const metrics = health.analyzeSource(relative(file), source)
  const { codeLines, branchCount, functionCount, importCount, exportCount, maxBlockLines } = metrics
  const rel = relative(file)
  const basename = path.basename(file, '.ts')
  const churnCount = churn.get(rel) ?? 0
  const category = classifyFile(rel, basename)
  const churnWeight =
    loc >= HOTSPOT_LOC_THRESHOLD || branchCount >= HOTSPOT_BRANCH_THRESHOLD
      ? 3
      : loc >= 300 || branchCount >= 40
        ? 2
        : category === 'types' || category === 'data/config'
          ? 0.4
          : 0.8
  const risk =
    loc * 0.025 +
    branchCount * 1.5 +
    Math.max(0, maxBlockLines - 80) * 0.8 +
    churnCount * churnWeight +
    Math.max(0, importCount - 20) * 1.2

  return {
    ...metrics,
    file: rel,
    loc,
    codeLines,
    branchCount,
    functionCount,
    importCount,
    exportCount,
    maxBlockLines,
    churn90d: churnCount,
    category,
    risk: Math.round(risk * 10) / 10,
  }
}

function classifyFile(file, basename = path.basename(file, '.ts')) {
  if (file.includes('/types/') || basename.endsWith('Types')) return 'types'
  if (
    basename.endsWith('Data') ||
    basename.endsWith('Manifest') ||
    file.includes('/config/') ||
    file.includes('/constants/') ||
    file.includes('/i18n/')
  ) {
    return 'data/config'
  }
  if (file.includes('/dev-console/')) return 'tooling'
  if (file.includes('/ui/') || file.includes('/screens/')) return 'ui'
  if (file.includes('/classes/') || file.includes('/services/') || file.includes('/controllers/')) return 'runtime'
  if (file.includes('/lib/')) return 'library'
  return 'app'
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

function sourceSnapshot() {
  const hash = crypto.createHash('sha256')
  const paths = ['app', 'engine', 'tools', 'tests']
    .flatMap(dir => walk(path.join(ROOT, dir), true))
    .concat(
      [
        'main.js',
        'preload.js',
        'package.json',
        'pnpm-lock.yaml',
        'tsconfig.json',
        'eslint.config.mjs',
        '.babelrc',
        '.madgerc',
        'knip.json',
        'pnpm-workspace.yaml',
      ].map(file => path.join(ROOT, file))
    )
    .concat(fs.existsSync(BASELINE_FILE) ? [BASELINE_FILE] : [])
    .sort()
  for (const file of paths) hash.update(relative(file)).update('\0').update(fs.readFileSync(file)).update('\0')
  return hash.digest('hex')
}

module.exports = { relative, sourceSnapshot, getChurn90d, walk, analyzeFile }
