const { getStructureDebt } = require('./structure.cjs')
const { HOTSPOT_CHURN_THRESHOLD, HOTSPOT_LOC_THRESHOLD, HOTSPOT_BRANCH_THRESHOLD } = require('./config.cjs')

function scoreChecks(checks) {
  if (checks.length === 0) return 0
  const qualityChecks = checks.filter(
    check =>
      !['duplication', 'architecture', 'tests', 'coverage', 'regressions', 'snapshot', 'extendedLint'].includes(
        check.id
      )
  )
  const passed = qualityChecks.filter(check => check.ok).length
  return (passed / Math.max(1, qualityChecks.length)) * 25
}

function scoreDuplication(duplication) {
  if (duplication.clones == null) return 0
  const penalty = Math.min(20, duplication.clones * 2 + duplication.percent * 30)
  return Math.max(0, 20 - penalty)
}

function scoreStructure(files, folders) {
  const structureDebt = getStructureDebt(files, folders)
  const penalty = structureDebt.reduce((sum, item) => sum + item.penalty, 0)
  return Math.max(0, 20 - penalty)
}

function scoreArchitecture(architecture) {
  if (architecture.cycles == null) return 0
  const penalty = Math.min(15, architecture.cycles * 1)
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

function scoreTests(checks, coverage) {
  return checks.find(check => check.id === 'tests')?.ok ? 5 + (coverage?.summary.branches.pct ?? 0) / 20 : 0
}

function grade(score) {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'E'
}

function componentLosses(componentScores) {
  return [
    { component: 'Gates', score: componentScores.gates, max: 25 },
    { component: 'Duplication', score: componentScores.duplication, max: 20 },
    { component: 'Structure', score: componentScores.structure, max: 20 },
    { component: 'Architecture', score: componentScores.architecture, max: 15 },
    { component: 'Hotspots', score: componentScores.hotspots, max: 10 },
    { component: 'Tests and critical coverage', score: componentScores.tests, max: 10 },
  ].map(row => ({ ...row, lost: row.max - row.score }))
}

function hotspotGainPlan(hotspotCount, otherScore) {
  const rows = []
  for (const target of [91, 95, 100]) {
    const requiredHotspotScore = Math.max(0, target - otherScore)
    const maxHotspotsForTarget = Math.floor((10 - requiredHotspotScore) / 0.8)
    rows.push({
      target,
      maxHotspots: Math.max(0, maxHotspotsForTarget),
      toClear: Math.max(0, hotspotCount - maxHotspotsForTarget),
      reachableByHotspotsOnly: requiredHotspotScore <= 10,
    })
  }
  return rows
}

module.exports = {
  grade,
  getRiskyHotspots,
  scoreChecks,
  scoreDuplication,
  scoreStructure,
  scoreArchitecture,
  scoreHotspots,
  scoreTests,
  componentLosses,
  hotspotGainPlan,
}
