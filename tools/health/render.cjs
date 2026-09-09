const {
  renderCodeHealthReport,
  renderGlobalScore,
  renderWhyNotHigher,
  renderSummary,
  renderChecks,
  renderRegressionControl,
  renderCriticalTestCoverage,
  renderFunctionComplexity,
} = require('./render-summary.cjs')
const {
  renderTopPriorities,
  renderScoreMoves,
  renderLargestFiles,
  renderDataAndConfigFiles,
  renderComplexitySignals,
  renderGitHotspots,
} = require('./render-files.cjs')
const {
  renderProjectHygiene,
  renderStructureDebt,
  renderFolderRefactorCandidates,
  renderCrowdedFolders,
  renderNamingStyles,
  renderNamingMismatches,
  renderHeavyIndexFiles,
  renderDependencyCycles,
  renderCycleHubs,
} = require('./render-structure.cjs')
const { renderSampleCycles, renderNotes } = require('./render-architecture.cjs')

function renderMarkdown(context) {
  return [
    renderCodeHealthReport(context),
    renderGlobalScore(context),
    renderWhyNotHigher(context),
    renderSummary(context),
    renderChecks(context),
    renderRegressionControl(context),
    renderCriticalTestCoverage(context),
    renderFunctionComplexity(context),
    renderTopPriorities(context),
    renderScoreMoves(context),
    renderLargestFiles(context),
    renderDataAndConfigFiles(context),
    renderComplexitySignals(context),
    renderGitHotspots(context),
    renderProjectHygiene(context),
    renderStructureDebt(context),
    renderFolderRefactorCandidates(context),
    renderCrowdedFolders(context),
    renderNamingStyles(context),
    renderNamingMismatches(context),
    renderHeavyIndexFiles(context),
    renderDependencyCycles(context),
    renderCycleHubs(context),
    renderSampleCycles(context),
    renderNotes(context),
  ].join('')
}

module.exports = { renderMarkdown }
