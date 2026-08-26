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
const QUALITY_GATE_SCORE = 80
const TARGET_SCORE = 90
const HOTSPOT_CHURN_THRESHOLD = 8
const HOTSPOT_LOC_THRESHOLD = 600
const HOTSPOT_BRANCH_THRESHOLD = 80
const LARGE_FILE_THRESHOLD = 1000
const HUGE_FILE_THRESHOLD = 1500
const COMPLEX_BRANCH_THRESHOLD = 120
const COMPLEX_BLOCK_THRESHOLD = 160
const MAX_FILES_PER_FOLDER_WARNING = 24
const MAX_FILES_PER_FOLDER_SEVERE = 48
const MAX_LOC_PER_FOLDER_WARNING = 8000
const MAX_BRANCHES_PER_FOLDER_WARNING = 1200
const MAX_FOLDER_DEPTH_WARNING = 5
const INDEX_FILE_LOC_WARNING = 300

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

function scoreStructure(files, folders) {
  const structureDebt = getStructureDebt(files, folders)
  const penalty = structureDebt.reduce((sum, item) => sum + item.penalty, 0)
  return Math.max(0, 20 - penalty)
}

function getStructureDebt(files, folders = analyzeFolders(files)) {
  const largeFiles = files.filter(file => file.loc >= LARGE_FILE_THRESHOLD).length
  const hugeFiles = files.filter(file => file.loc >= HUGE_FILE_THRESHOLD).length
  const complexFiles = files.filter(
    file => file.branchCount >= COMPLEX_BRANCH_THRESHOLD || file.maxBlockLines >= COMPLEX_BLOCK_THRESHOLD
  ).length
  const crowdedFolders = folders.filter(folder => folder.files > MAX_FILES_PER_FOLDER_WARNING).length
  const severeFolders = folders.filter(folder => folder.files > MAX_FILES_PER_FOLDER_SEVERE).length
  const highLocFolders = folders.filter(folder => folder.loc > MAX_LOC_PER_FOLDER_WARNING).length
  const highBranchFolders = folders.filter(folder => folder.branches > MAX_BRANCHES_PER_FOLDER_WARNING).length
  const deepFolders = folders.filter(folder => folder.depth > MAX_FOLDER_DEPTH_WARNING).length
  const heavyIndexes = getHeavyIndexFiles(files).length
  const namingViolations = getNamingViolations(files).length

  return [
    {
      signal: 'Large files',
      count: largeFiles,
      threshold: `LOC >= ${LARGE_FILE_THRESHOLD}`,
      penalty: largeFiles * 0.9,
    },
    {
      signal: 'Huge files',
      count: hugeFiles,
      threshold: `LOC >= ${HUGE_FILE_THRESHOLD}`,
      penalty: hugeFiles * 1.3,
    },
    {
      signal: 'Complex files',
      count: complexFiles,
      threshold: `branches >= ${COMPLEX_BRANCH_THRESHOLD} or max block >= ${COMPLEX_BLOCK_THRESHOLD}`,
      penalty: complexFiles * 0.8,
    },
    {
      signal: 'Crowded folders',
      count: crowdedFolders,
      threshold: `files > ${MAX_FILES_PER_FOLDER_WARNING}`,
      penalty: crowdedFolders * 0.7,
    },
    {
      signal: 'Severely crowded folders',
      count: severeFolders,
      threshold: `files > ${MAX_FILES_PER_FOLDER_SEVERE}`,
      penalty: severeFolders * 1.4,
    },
    {
      signal: 'High LOC folders',
      count: highLocFolders,
      threshold: `LOC > ${MAX_LOC_PER_FOLDER_WARNING}`,
      penalty: highLocFolders * 0.8,
    },
    {
      signal: 'High branch folders',
      count: highBranchFolders,
      threshold: `branches > ${MAX_BRANCHES_PER_FOLDER_WARNING}`,
      penalty: highBranchFolders * 0.8,
    },
    {
      signal: 'Deep folders',
      count: deepFolders,
      threshold: `depth > ${MAX_FOLDER_DEPTH_WARNING}`,
      penalty: deepFolders * 0.5,
    },
    {
      signal: 'Heavy index files',
      count: heavyIndexes,
      threshold: `index.ts LOC > ${INDEX_FILE_LOC_WARNING}`,
      penalty: heavyIndexes * 0.9,
    },
    {
      signal: 'Naming mismatches',
      count: namingViolations,
      threshold: 'folder naming convention mismatch',
      penalty: Math.min(2, namingViolations * 0.2),
    },
  ].map(row => ({ ...row, penalty: Math.round(row.penalty * 10) / 10 }))
}

function scoreArchitecture(architecture) {
  if (architecture.cycles == null) return 5
  const penalty = Math.min(15, architecture.cycles * 0.12)
  return Math.max(0, 15 - penalty)
}

function scoreHotspots(files) {
  const riskyHotspots = getRiskyHotspots(files).length
  return Math.max(0, 10 - riskyHotspots * 0.8)
}

function getRiskyHotspots(files) {
  return files.filter(
    file =>
      file.churn90d >= HOTSPOT_CHURN_THRESHOLD &&
      (file.loc >= HOTSPOT_LOC_THRESHOLD || file.branchCount >= HOTSPOT_BRANCH_THRESHOLD)
  )
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

function hotspotReason(file) {
  const reasons = []
  if (file.loc >= HOTSPOT_LOC_THRESHOLD) reasons.push(`LOC >= ${HOTSPOT_LOC_THRESHOLD}`)
  if (file.branchCount >= HOTSPOT_BRANCH_THRESHOLD) reasons.push(`branches >= ${HOTSPOT_BRANCH_THRESHOLD}`)
  if (file.churn90d >= HOTSPOT_CHURN_THRESHOLD) reasons.push(`churn >= ${HOTSPOT_CHURN_THRESHOLD}`)
  return reasons.join(', ')
}

function hotspotExitTarget(file) {
  const targets = []
  if (file.loc >= HOTSPOT_LOC_THRESHOLD) targets.push(`LOC < ${HOTSPOT_LOC_THRESHOLD}`)
  if (file.branchCount >= HOTSPOT_BRANCH_THRESHOLD) targets.push(`branches < ${HOTSPOT_BRANCH_THRESHOLD}`)
  return targets.join(' ou ')
}

function componentLosses(componentScores) {
  return [
    { component: 'Gates', score: componentScores.gates, max: 25 },
    { component: 'Duplication', score: componentScores.duplication, max: 20 },
    { component: 'Structure', score: componentScores.structure, max: 20 },
    { component: 'Architecture', score: componentScores.architecture, max: 15 },
    { component: 'Hotspots', score: componentScores.hotspots, max: 10 },
    { component: 'Type/Lint confidence', score: componentScores.typeAndLintConfidence, max: 10 },
  ].map(row => ({ ...row, lost: row.max - row.score }))
}

function hotspotGainPlan(hotspotCount) {
  const rows = []
  for (const target of [91, 95, 100]) {
    const requiredHotspotScore = Math.max(0, target - 90)
    const maxHotspotsForTarget = Math.floor((10 - requiredHotspotScore) / 0.8)
    rows.push({
      target,
      maxHotspots: Math.max(0, maxHotspotsForTarget),
      toClear: Math.max(0, hotspotCount - maxHotspotsForTarget),
    })
  }
  return rows
}

function analyzeFolders(files) {
  const folders = new Map()
  for (const file of files) {
    const dir = path.dirname(file.file)
    const parts = dir.split(path.sep)
    const entry = folders.get(dir) ?? {
      folder: dir,
      files: 0,
      loc: 0,
      branches: 0,
      depth: parts.length,
    }
    entry.files += 1
    entry.loc += file.loc
    entry.branches += file.branchCount
    folders.set(dir, entry)
  }
  return [...folders.values()].sort((a, b) => b.files - a.files || b.loc - a.loc)
}

function folderRefactorReason(folder) {
  const reasons = []
  if (folder.files > MAX_FILES_PER_FOLDER_SEVERE) reasons.push(`severe file count > ${MAX_FILES_PER_FOLDER_SEVERE}`)
  else if (folder.files > MAX_FILES_PER_FOLDER_WARNING) reasons.push(`file count > ${MAX_FILES_PER_FOLDER_WARNING}`)
  if (folder.loc > MAX_LOC_PER_FOLDER_WARNING) reasons.push(`LOC > ${MAX_LOC_PER_FOLDER_WARNING}`)
  if (folder.branches > MAX_BRANCHES_PER_FOLDER_WARNING) reasons.push(`branches > ${MAX_BRANCHES_PER_FOLDER_WARNING}`)
  if (folder.depth > MAX_FOLDER_DEPTH_WARNING) reasons.push(`depth > ${MAX_FOLDER_DEPTH_WARNING}`)
  return reasons.join(', ')
}

function folderRefactorSuggestion(folder) {
  if (folder.folder === 'app/lib') return 'Split by domain: i18n, lpc, map/terrain, gameplay helpers, rendering helpers.'
  if (folder.folder === 'app/ui') return 'Group related UI panels and overlays into feature folders.'
  if (folder.folder === 'app/classes/map') return 'Keep map orchestration thin; move terrain, resources, fog, blueprints, and water into focused modules.'
  if (folder.folder === 'app/classes/unit') return 'Keep Unit as composition root; move movement, actions, resources, experience, and runtime state into narrow modules.'
  return 'Split files by feature/domain until the folder has a clear single responsibility.'
}

function folderStructureRisk(folder) {
  return (
    Math.max(0, folder.files - MAX_FILES_PER_FOLDER_WARNING) * 2 +
    Math.max(0, folder.loc - MAX_LOC_PER_FOLDER_WARNING) / 120 +
    Math.max(0, folder.branches - MAX_BRANCHES_PER_FOLDER_WARNING) / 12 +
    Math.max(0, folder.depth - MAX_FOLDER_DEPTH_WARNING) * 8
  )
}

function getFolderRefactorCandidates(folders) {
  return folders
    .filter(
      folder =>
        folder.files > MAX_FILES_PER_FOLDER_WARNING ||
        folder.loc > MAX_LOC_PER_FOLDER_WARNING ||
        folder.branches > MAX_BRANCHES_PER_FOLDER_WARNING ||
        folder.depth > MAX_FOLDER_DEPTH_WARNING
    )
    .map(folder => ({
      ...folder,
      risk: Math.round(folderStructureRisk(folder) * 10) / 10,
      why: folderRefactorReason(folder),
      suggestion: folderRefactorSuggestion(folder),
    }))
    .sort((a, b) => b.risk - a.risk || b.files - a.files)
}

function namingStyle(file) {
  const name = path.basename(file.file, '.ts')
  if (/^[A-Z][A-Za-z0-9]*$/.test(name)) return 'PascalCase'
  if (/^[a-z][A-Za-z0-9]*$/.test(name)) return 'camelCase'
  if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) return 'kebab-case'
  return 'mixed'
}

function analyzeNaming(files) {
  const counts = new Map()
  for (const file of files) {
    const style = namingStyle(file)
    counts.set(style, (counts.get(style) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([style, count]) => ({ style, count }))
    .sort((a, b) => b.count - a.count || a.style.localeCompare(b.style))
}

function expectedNamingStyle(file) {
  if (file.file.endsWith('/index.ts')) return null
  const basename = path.basename(file.file, '.ts')
  if (['config', 'constants', 'types', 'unitGroups'].includes(basename)) return 'camelCase'
  if (
    file.file.includes('/ui/utils/') ||
    file.file.includes('/ui/modals/') ||
    basename === 'pausableRuntime' ||
    basename === 'runtimeServices' ||
    basename === 'locomotion'
  ) {
    return 'camelCase'
  }
  if (
    file.file.includes('/ui/') ||
    file.file.includes('/screens/') ||
    file.file.includes('/classes/') ||
    file.file.includes('/ai/') ||
    file.file.includes('/services/') ||
    file.file.includes('/controllers/') ||
    file.file.includes('/serialization/')
  ) {
    return 'PascalCase'
  }
  if (
    file.file.includes('/lib/') ||
    file.file.includes('/config/') ||
    file.file.includes('/constants/')
  ) {
    return 'camelCase'
  }
  return null
}

function getNamingViolations(files) {
  return files
    .map(file => ({
      file: file.file,
      style: namingStyle(file),
      expected: expectedNamingStyle(file),
    }))
    .filter(row => row.expected && row.style !== row.expected)
}

function getHeavyIndexFiles(files) {
  return files
    .filter(file => file.file.endsWith('/index.ts') && file.loc > INDEX_FILE_LOC_WARNING)
    .sort((a, b) => b.loc - a.loc)
}

function professionalRuleRows(files, folders) {
  const crowdedFolders = folders.filter(folder => folder.files > MAX_FILES_PER_FOLDER_WARNING).length
  const severeFolders = folders.filter(folder => folder.files > MAX_FILES_PER_FOLDER_SEVERE).length
  const highLocFolders = folders.filter(folder => folder.loc > MAX_LOC_PER_FOLDER_WARNING).length
  const highBranchFolders = folders.filter(folder => folder.branches > MAX_BRANCHES_PER_FOLDER_WARNING).length
  const deepFolders = folders.filter(folder => folder.depth > MAX_FOLDER_DEPTH_WARNING).length
  const heavyIndexes = getHeavyIndexFiles(files).length
  const namingViolations = getNamingViolations(files).length
  return [
    {
      rule: 'Dossiers trop charges',
      status: severeFolders ? 'FAIL' : crowdedFolders ? 'WARN' : 'OK',
      detail: `${crowdedFolders} dossier(s) avec plus de ${MAX_FILES_PER_FOLDER_WARNING} fichiers TS`,
    },
    {
      rule: 'Dossiers severement charges',
      status: severeFolders ? 'FAIL' : 'OK',
      detail: `${severeFolders} dossier(s) avec plus de ${MAX_FILES_PER_FOLDER_SEVERE} fichiers TS`,
    },
    {
      rule: 'Dossiers trop volumineux',
      status: highLocFolders ? 'WARN' : 'OK',
      detail: `${highLocFolders} dossier(s) avec plus de ${MAX_LOC_PER_FOLDER_WARNING} lignes`,
    },
    {
      rule: 'Dossiers trop branches',
      status: highBranchFolders ? 'WARN' : 'OK',
      detail: `${highBranchFolders} dossier(s) avec plus de ${MAX_BRANCHES_PER_FOLDER_WARNING} branches approx.`,
    },
    {
      rule: 'Profondeur de dossiers',
      status: deepFolders ? 'WARN' : 'OK',
      detail: `${deepFolders} dossier(s) au-dela de ${MAX_FOLDER_DEPTH_WARNING} niveaux`,
    },
    {
      rule: 'Index trop lourds',
      status: heavyIndexes ? 'WARN' : 'OK',
      detail: `${heavyIndexes} index.ts avec plus de ${INDEX_FILE_LOC_WARNING} lignes`,
    },
    {
      rule: 'Nomenclature par zone',
      status: namingViolations ? 'WARN' : 'OK',
      detail: `${namingViolations} fichier(s) ne suivent pas la convention attendue de leur dossier`,
    },
  ]
}

function architectureFixText(architecture) {
  if (architecture.cycles == null) {
    return 'No architecture fix plan available because import cycles were not measured.'
  }
  if (architecture.cycles === 0) {
    return 'No import-cycle fix needed. Keep the baseline gate so new cycles cannot sneak in.'
  }
  return `Fix priority:

1. Break barrel/helper cycles around \`lib/index.ts\`, \`types/entities.ts\`, and projectile helpers.
2. Then handle local two-way feature splits such as AI, map generation, controls, menu, building, and unit modules.
3. Keep the baseline gate so new cycles cannot sneak in while old ones are being removed.`
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
  const riskyHotspots = getRiskyHotspots(files).sort((a, b) => b.risk - a.risk)
  const dataConfigFiles = files
    .filter(file => file.category === 'data/config')
    .sort((a, b) => b.loc - a.loc)
    .slice(0, maxFiles)
  const folders = analyzeFolders(files)
  const crowdedFolders = folders.filter(folder => folder.files > MAX_FILES_PER_FOLDER_WARNING).slice(0, maxFiles)
  const folderRefactorCandidates = getFolderRefactorCandidates(folders).slice(0, maxFiles)
  const structureDebt = getStructureDebt(files, folders)
  const heavyIndexFiles = getHeavyIndexFiles(files).slice(0, maxFiles)
  const naming = analyzeNaming(files)
  const namingViolations = getNamingViolations(files).slice(0, maxFiles)
  const professionalRules = professionalRuleRows(files, folders)
  const cycleHubs = countCycleFiles(architecture.cycleList).slice(0, maxFiles)

  const componentScores = {
    gates: Math.round(scoreChecks(checks)),
    duplication: Math.round(scoreDuplication(duplication)),
    structure: Math.round(scoreStructure(files, folders)),
    architecture: Math.round(scoreArchitecture(architecture)),
    hotspots: Math.round(scoreHotspots(files)),
    typeAndLintConfidence: Math.round(scoreTests(checks)),
  }
  const score = Math.round(Object.values(componentScores).reduce((sum, value) => sum + value, 0))
  const scoreLosses = componentLosses(componentScores)
  const hotspotPlan = hotspotGainPlan(riskyHotspots.length)
  const generatedAt = new Date().toISOString()
  const report = {
    generatedAt,
    score,
    grade: grade(score),
    qualityGateScore: QUALITY_GATE_SCORE,
    targetScore: TARGET_SCORE,
    qualityGate: score >= QUALITY_GATE_SCORE ? 'pass' : 'fail',
    totals,
    checks: checks.map(({ output: _output, ...check }) => check),
    componentScores,
    scoreLosses,
    duplication,
    architecture,
    riskyHotspots,
    hotspotPlan,
    dataConfigFiles,
    folders: {
      topByFileCount: folders.slice(0, maxFiles),
      crowded: crowdedFolders,
      refactorCandidates: folderRefactorCandidates,
      structureDebt,
      heavyIndexFiles,
      naming,
      namingViolations,
      professionalRules,
    },
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

Minimum required score: **${QUALITY_GATE_SCORE}/100**. Target score: **${TARGET_SCORE}/100**. Quality gate: **${score >= QUALITY_GATE_SCORE ? 'PASS' : 'FAIL'}**.

| Component | Score |
| --- | --- |
| Gates | ${componentScores.gates}/25 |
| Duplication | ${componentScores.duplication}/20 |
| Structure | ${componentScores.structure}/20 |
| Architecture | ${componentScores.architecture}/15 |
| Hotspots | ${componentScores.hotspots}/10 |
| Type/Lint confidence | ${componentScores.typeAndLintConfidence}/10 |

> Architecture is scored separately from the baseline gate: staying at or below the baseline keeps the check green, but existing cycles still reduce the global quality score.

## Why Not Higher?

${markdownTable(scoreLosses, [
  { label: 'Component', value: row => row.component },
  { label: 'Score', value: row => `${row.score}/${row.max}` },
  { label: 'Lost', value: row => row.lost },
])}

Main blocker: **${riskyHotspots.length} risky hotspot(s)**. The hotspot score is **${componentScores.hotspots}/10**, so this is the current ceiling.

${markdownTable(hotspotPlan, [
  { label: 'Target Score', value: row => `${row.target}+` },
  { label: 'Max Risky Hotspots', value: row => row.maxHotspots },
  { label: 'Hotspots To Clear', value: row => row.toClear },
])}

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
  { label: 'Kind', value: row => row.category },
  { label: 'Risk', value: row => row.risk },
  { label: 'LOC', value: row => row.loc },
  { label: 'Branches', value: row => row.branchCount },
  { label: 'Max Block', value: row => row.maxBlockLines },
  { label: 'Churn 90d', value: row => row.churn90d },
  { label: 'Why', value: priorityReason },
])}

## Score Moves

These files currently count against the hotspot score. Clear a hotspot by reducing the listed exit target while keeping churn unchanged.

${
  riskyHotspots.length
    ? markdownTable(riskyHotspots.slice(0, maxFiles), [
        { label: 'File', value: row => row.file },
        { label: 'Kind', value: row => row.category },
        { label: 'Risk', value: row => row.risk },
        { label: 'Why', value: hotspotReason },
        { label: 'Exit Target', value: hotspotExitTarget },
      ])
    : 'No risky hotspots currently count against the score.'
}

## Largest Files

${markdownTable(largest, [
  { label: 'File', value: row => row.file },
  { label: 'Kind', value: row => row.category },
  { label: 'LOC', value: row => row.loc },
  { label: 'Branches', value: row => row.branchCount },
  { label: 'Imports', value: row => row.importCount },
])}

## Data And Config Files

Large data/config/type-heavy files are useful to track, but they should not drive the same refactor decisions as gameplay/runtime files.

${
  dataConfigFiles.length
    ? markdownTable(dataConfigFiles, [
        { label: 'File', value: row => row.file },
        { label: 'Kind', value: row => row.category },
        { label: 'LOC', value: row => row.loc },
        { label: 'Branches', value: row => row.branchCount },
      ])
    : 'No large data/config files detected.'
}

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

## Project Hygiene

${markdownTable(professionalRules, [
  { label: 'Rule', value: row => row.rule },
  { label: 'Status', value: row => row.status },
  { label: 'Detail', value: row => row.detail },
])}

### Structure Debt

These signals now reduce the Structure score. This makes the report stricter: a folder can be technically valid but still count as architecture debt when it becomes a catch-all.

${markdownTable(structureDebt, [
  { label: 'Signal', value: row => row.signal },
  { label: 'Count', value: row => row.count },
  { label: 'Threshold', value: row => row.threshold },
  { label: 'Penalty', value: row => row.penalty },
])}

### Folder Refactor Candidates

${
  folderRefactorCandidates.length
    ? markdownTable(folderRefactorCandidates, [
        { label: 'Folder', value: row => row.folder },
        { label: 'Risk', value: row => row.risk },
        { label: 'Files', value: row => row.files },
        { label: 'LOC', value: row => row.loc },
        { label: 'Branches', value: row => row.branches },
        { label: 'Why', value: row => row.why },
        { label: 'Suggested Split', value: row => row.suggestion },
      ])
    : 'No folder currently needs a structural split.'
}

### Crowded Folders

${
  crowdedFolders.length
    ? markdownTable(crowdedFolders, [
        { label: 'Folder', value: row => row.folder },
        { label: 'Files', value: row => row.files },
        { label: 'LOC', value: row => row.loc },
        { label: 'Branches', value: row => row.branches },
      ])
    : 'No folder exceeds the current file-count warning.'
}

### Naming Styles

${markdownTable(naming, [
  { label: 'Style', value: row => row.style },
  { label: 'Files', value: row => row.count },
])}

### Naming Mismatches

${
  namingViolations.length
    ? markdownTable(namingViolations, [
        { label: 'File', value: row => row.file },
        { label: 'Style', value: row => row.style },
        { label: 'Expected', value: row => row.expected },
      ])
    : 'No naming mismatch detected for folder-level conventions.'
}

### Heavy Index Files

${
  heavyIndexFiles.length
    ? markdownTable(heavyIndexFiles, [
        { label: 'File', value: row => row.file },
        { label: 'LOC', value: row => row.loc },
        { label: 'Branches', value: row => row.branchCount },
        { label: 'Exports', value: row => row.exportCount },
      ])
    : 'No heavy index.ts file detected.'
}

## Dependency Cycles

${
  architecture.cycles == null
    ? 'Import cycles were not measured.'
    : `Madge found **${architecture.cycles} circular dependencies**. Architecture score: **${componentScores.architecture}/15**. Baseline gate: **${architecture.baseline}**.`
}

${architectureFixText(architecture)}

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
  if (score < QUALITY_GATE_SCORE) {
    console.error(`Code health gate failed: ${score}/100 is below required ${QUALITY_GATE_SCORE}/100.`)
    process.exitCode = 1
  }
}

main()
