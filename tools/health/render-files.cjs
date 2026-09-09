const { priorityReason, markdownTable, hotspotReason, hotspotExitTarget } = require('./format.cjs')
const { maxFiles } = require('./config.cjs')

function renderTopPriorities({ topRisk, priorityReason, markdownTable }) {
  return `## Top Priorities

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

`
}

function renderScoreMoves({
  churn,
  files,
  hotspots,
  riskyHotspots,
  score,
  hotspotReason,
  hotspotExitTarget,
  markdownTable,
}) {
  return `## Score Moves

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

`
}

function renderLargestFiles({ largest, markdownTable }) {
  return `## Largest Files

${markdownTable(largest, [
  { label: 'File', value: row => row.file },
  { label: 'Kind', value: row => row.category },
  { label: 'LOC', value: row => row.loc },
  { label: 'Branches', value: row => row.branchCount },
  { label: 'Imports', value: row => row.importCount },
])}

`
}

function renderDataAndConfigFiles({ files, config, dataConfigFiles, markdownTable }) {
  return `## Data And Config Files

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

`
}

function renderComplexitySignals({ complex, markdownTable }) {
  return `## Complexity Signals

${markdownTable(complex, [
  { label: 'File', value: row => row.file },
  { label: 'Branches', value: row => row.branchCount },
  { label: 'Max Block', value: row => row.maxBlockLines },
  { label: 'LOC', value: row => row.loc },
])}

`
}

function renderGitHotspots({ hotspots, markdownTable }) {
  return `## Git Hotspots

${markdownTable(hotspots, [
  { label: 'File', value: row => row.file },
  { label: 'Churn 90d', value: row => row.churn90d },
  { label: 'Risk', value: row => row.risk },
  { label: 'LOC', value: row => row.loc },
])}

`
}

module.exports = {
  renderTopPriorities,
  renderScoreMoves,
  renderLargestFiles,
  renderDataAndConfigFiles,
  renderComplexitySignals,
  renderGitHotspots,
}
