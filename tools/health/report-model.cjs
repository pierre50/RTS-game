const health = require('./analyze.cjs')
const fs = require('node:fs')
const {
  maxFiles,
  MAX_FILES_PER_FOLDER_WARNING,
  QUALITY_GATE_SCORE,
  TARGET_SCORE,
  REPORT_DIR,
  MD_REPORT,
  JSON_REPORT,
} = require('./config.cjs')
const {
  getRiskyHotspots,
  scoreChecks,
  scoreDuplication,
  scoreStructure,
  scoreArchitecture,
  scoreHotspots,
  scoreTests,
  componentLosses,
  hotspotGainPlan,
  grade,
} = require('./scoring.cjs')
const {
  analyzeFolders,
  getFolderRefactorCandidates,
  getStructureDebt,
  getHeavyIndexFiles,
  analyzeNaming,
  getNamingViolations,
  professionalRuleRows,
} = require('./structure.cjs')
const {
  countCycleFiles,
  priorityReason,
  hotspotReason,
  hotspotExitTarget,
  architectureFixText,
  markdownTable,
  cycleArea,
} = require('./format.cjs')
const { renderMarkdown } = require('./render.cjs')
const { relative } = require('./files.cjs')

function rankFiles({ files, config, architecture }) {
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

  return {
    topRisk,
    largest,
    complex,
    hotspots,
    riskyHotspots,
    dataConfigFiles,
    folders,
    crowdedFolders,
    folderRefactorCandidates,
    structureDebt,
    heavyIndexFiles,
    naming,
    namingViolations,
    professionalRules,
    cycleHubs,
  }
}

function scoreReport({
  files,
  coverage,
  checks,
  regressions,
  duplication,
  architecture,
  hotspots,
  riskyHotspots,
  folders,
}) {
  const componentScores = {
    gates: Math.round(scoreChecks(checks)),
    duplication: Math.round(scoreDuplication(duplication)),
    structure: Math.round(scoreStructure(files, folders)),
    architecture: Math.round(scoreArchitecture(architecture)),
    hotspots: Math.round(scoreHotspots(files)),
    tests: Math.round(scoreTests(checks, coverage)),
  }
  const score = Math.round(Object.values(componentScores).reduce((sum, value) => sum + value, 0))
  const scoreLosses = componentLosses(componentScores)
  const hotspotPlan = hotspotGainPlan(riskyHotspots.length, score - componentScores.hotspots)
  const gate = health.evaluateGate(checks, score, regressions, QUALITY_GATE_SCORE)
  const generatedAt = new Date().toISOString()
  const mainLoss = [...scoreLosses].sort((a, b) => b.lost - a.lost)[0]

  return { componentScores, score, scoreLosses, hotspotPlan, gate, generatedAt, mainLoss }
}

function assembleReport({
  initialSnapshot,
  findings,
  totals,
  coverage,
  checks,
  comparison,
  regressions,
  baselineUpdated,
  duplication,
  architecture,
  topRisk,
  largest,
  complex,
  hotspots,
  riskyHotspots,
  dataConfigFiles,
  folders,
  crowdedFolders,
  folderRefactorCandidates,
  structureDebt,
  heavyIndexFiles,
  naming,
  namingViolations,
  professionalRules,
  cycleHubs,
  componentScores,
  score,
  scoreLosses,
  hotspotPlan,
  gate,
  generatedAt,
}) {
  const report = {
    generatedAt,
    score,
    grade: grade(score),
    qualityGateScore: QUALITY_GATE_SCORE,
    targetScore: TARGET_SCORE,
    qualityGate: gate.status,
    gateReasons: gate.reasons,
    schemaVersion: 2,
    sourceHash: initialSnapshot,
    baselineUpdated,
    findings,
    regressions,
    resolvedFindings: comparison.resolved,
    coverage,
    scope: ['app/**/*.ts', 'engine/**/*.ts', 'tools/**/*.{js,cjs}', 'main.js', 'preload.js'],
    totals,
    checks: checks.map(({ stdout: _stdout, ...check }) => ({ ...check, output: check.ok ? undefined : check.output })),
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

  return { report }
}

function renderReport(state) {
  const { checks } = state
  const checkRows = checks.map(check => ({
    name: check.label,
    status: check.status.toUpperCase(),
    detail:
      check.id === 'duplication' && check.duplication
        ? `${check.duplication.clones} clones, ${check.duplication.percent}%`
        : check.id === 'architecture' && check.architecture
          ? `${check.architecture.cycles ?? 'unknown'} cycles / baseline gate ${check.architecture.baseline}`
          : (check.error ?? (check.tests ? `${check.tests.passed}/${check.tests.total} passed` : '')),
  }))

  const md = renderMarkdown({
    ...state,
    checkRows,
    grade,
    priorityReason,
    hotspotReason,
    hotspotExitTarget,
    architectureFixText,
    markdownTable,
    cycleArea,
    QUALITY_GATE_SCORE,
    TARGET_SCORE,
  })

  return { checkRows, md }
}

function writeReport({ baseline, duplication, architecture, topRisk, score, gate, report, md }) {
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
  console.log(`Quality gate: ${gate.status.toUpperCase()}`)
  if (gate.status !== 'pass') {
    console.error(`Code health gate ${gate.status}: ${gate.reasons.join('; ')}`)
    process.exitCode = 1
  }

  return {}
}

module.exports = { rankFiles, scoreReport, assembleReport, renderReport, writeReport }
