const fs = require('node:fs')
const { collectAnalysis, compareQuality } = require('./health/analysis-pipeline.cjs')
const { measureChecks } = require('./health/checks.cjs')
const { rankFiles, scoreReport, assembleReport, renderReport, writeReport } = require('./health/report-model.cjs')
const { REPORT_DIR, JSON_REPORT, MD_REPORT } = require('./health/config.cjs')

function main() {
  const state = {}
  for (const stage of [
    collectAnalysis,
    measureChecks,
    compareQuality,
    rankFiles,
    scoreReport,
    assembleReport,
    renderReport,
    writeReport,
  ])
    Object.assign(state, stage(state))
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(`Audit failed: ${error.stack ?? error.message}`)
    process.exitCode = 1
    fs.mkdirSync(REPORT_DIR, { recursive: true })
    const failure = {
      schemaVersion: 2,
      generatedAt: new Date().toISOString(),
      qualityGate: 'incomplete',
      score: null,
      gateReasons: [error.message],
    }
    fs.writeFileSync(JSON_REPORT, `${JSON.stringify(failure, null, 2)}\n`)
    fs.writeFileSync(
      MD_REPORT,
      `# Code Health Report\n\nGenerated: ${failure.generatedAt}\n\nQuality gate: **INCOMPLETE**. No score is certified.\n\n${error.message}\n`
    )
  }
}
