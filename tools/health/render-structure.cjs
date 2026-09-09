const { markdownTable, architectureFixText } = require('./format.cjs')

function renderProjectHygiene({ professionalRules, markdownTable }) {
  return `## Project Hygiene

${markdownTable(professionalRules, [
  { label: 'Rule', value: row => row.rule },
  { label: 'Status', value: row => row.status },
  { label: 'Detail', value: row => row.detail },
])}

`
}

function renderStructureDebt({ architecture, structureDebt, score, report, markdownTable }) {
  return `### Structure Debt

These signals now reduce the Structure score. This makes the report stricter: a folder can be technically valid but still count as architecture debt when it becomes a catch-all.

${markdownTable(structureDebt, [
  { label: 'Signal', value: row => row.signal },
  { label: 'Count', value: row => row.count },
  { label: 'Threshold', value: row => row.threshold },
  { label: 'Penalty', value: row => row.penalty },
])}

`
}

function renderFolderRefactorCandidates({ files, folderRefactorCandidates, markdownTable }) {
  return `### Folder Refactor Candidates

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

`
}

function renderCrowdedFolders({ files, crowdedFolders, markdownTable }) {
  return `### Crowded Folders

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

`
}

function renderNamingStyles({ naming, markdownTable }) {
  return `### Naming Styles

${markdownTable(naming, [
  { label: 'Style', value: row => row.style },
  { label: 'Files', value: row => row.count },
])}

`
}

function renderNamingMismatches({ naming, namingViolations, markdownTable }) {
  return `### Naming Mismatches

${
  namingViolations.length
    ? markdownTable(namingViolations, [
        { label: 'File', value: row => row.file },
        { label: 'Style', value: row => row.style },
        { label: 'Expected', value: row => row.expected },
      ])
    : 'No naming mismatch detected for folder-level conventions.'
}

`
}

function renderHeavyIndexFiles({ heavyIndexFiles, markdownTable }) {
  return `### Heavy Index Files

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

`
}

function renderDependencyCycles({ baseline, architecture, componentScores, score, gate, architectureFixText }) {
  return `## Dependency Cycles

${
  architecture.cycles == null
    ? 'Import cycles were not measured.'
    : `Madge found **${architecture.cycles} circular dependencies**. Architecture score: **${componentScores.architecture}/15**. Baseline gate: **${architecture.baseline}**.`
}

${architectureFixText(architecture)}

`
}

function renderCycleHubs({ cycleHubs, markdownTable }) {
  return `### Cycle Hubs

${
  cycleHubs.length
    ? markdownTable(cycleHubs, [
        { label: 'File', value: row => row.file },
        { label: 'Cycles', value: row => row.count },
      ])
    : 'No cycle hubs measured.'
}

`
}

module.exports = {
  renderProjectHygiene,
  renderStructureDebt,
  renderFolderRefactorCandidates,
  renderCrowdedFolders,
  renderNamingStyles,
  renderNamingMismatches,
  renderHeavyIndexFiles,
  renderDependencyCycles,
  renderCycleHubs,
}
