const { grade } = require('./scoring.cjs')
const { QUALITY_GATE_SCORE, TARGET_SCORE, maxFiles } = require('./config.cjs')
const { markdownTable } = require('./format.cjs')

function renderCodeHealthReport({ generatedAt }) {
  return `# Code Health Report

Generated: ${generatedAt}

`
}

function renderGlobalScore({
  coverage,
  duplication,
  architecture,
  hotspots,
  componentScores,
  score,
  gate,
  grade,
  QUALITY_GATE_SCORE,
  TARGET_SCORE,
}) {
  return `## Global Score

**${score}/100 (${grade(score)})**

Minimum required score: **${QUALITY_GATE_SCORE}/100**. Target score: **${TARGET_SCORE}/100**. Quality gate: **${gate.status.toUpperCase()}**.

| Component | Score |
| --- | --- |
| Gates | ${componentScores.gates}/25 |
| Duplication | ${componentScores.duplication}/20 |
| Structure | ${componentScores.structure}/20 |
| Architecture | ${componentScores.architecture}/15 |
| Hotspots | ${componentScores.hotspots}/10 |
| Tests and critical coverage | ${componentScores.tests}/10 |

> The score is an indicator, not a certification. Every required check must pass, no cycle or duplication is allowed, and quality debt must not regress. Missing measurements make the audit INCOMPLETE.

`
}

function renderWhyNotHigher({ hotspots, score, scoreLosses, hotspotPlan, gate, mainLoss, markdownTable }) {
  return `## Why Not Higher?

${markdownTable(scoreLosses, [
  { label: 'Component', value: row => row.component },
  { label: 'Score', value: row => `${row.score}/${row.max}` },
  { label: 'Lost', value: row => row.lost },
])}

Largest score loss: **${mainLoss.lost > 0 ? `${mainLoss.component} (${mainLoss.lost} points)` : 'none'}**. Gate blockers: ${gate.reasons.join('; ') || 'none'}.

${markdownTable(hotspotPlan, [
  { label: 'Target Score', value: row => `${row.target}+` },
  { label: 'Max Risky Hotspots', value: row => row.maxHotspots },
  {
    label: 'Hotspots To Clear',
    value: row => (row.reachableByHotspotsOnly ? row.toClear : 'Not reachable through hotspots alone'),
  },
])}

`
}

function renderSummary({ files, baseline, totals, duplication, architecture }) {
  return `## Summary

- Files analyzed: ${totals.files}
- Total lines: ${totals.loc}
- Code lines: ${totals.codeLines}
- AST branch decisions: ${totals.branches}
- AST functions/methods: ${totals.functions}
- Duplication: ${duplication.clones == null ? 'not measured' : `${duplication.clones} clones, ${duplication.percent}%`}
- Import cycles: ${
    architecture.cycles == null ? 'not measured' : `${architecture.cycles} cycles / baseline ${architecture.baseline}`
  }

`
}

function renderChecks({ checks, checkRows, markdownTable }) {
  return `## Checks

${
  checks.length
    ? markdownTable(checkRows, [
        { label: 'Check', value: row => row.name },
        { label: 'Status', value: row => row.status },
        { label: 'Detail', value: row => row.detail },
      ])
    : 'Checks skipped with `--skip-checks`.'
}

`
}

function renderRegressionControl({ findings, baseline, regressions, baselineUpdated, markdownTable }) {
  return `## Regression Control

Baseline: ${baselineUpdated ? 'explicitly updated' : baseline ? 'loaded' : 'missing or invalid'}. Existing debt: **${findings.length}**. New or worsened findings: **${regressions.length}**.

${markdownTable(regressions.slice(0, maxFiles), [
  { label: 'Rule', value: row => row.rule },
  { label: 'File', value: row => `${row.file}:${row.line ?? 1}` },
  { label: 'Value', value: row => row.value },
  { label: 'Limit', value: row => row.limit },
])}

`
}

function renderCriticalTestCoverage({ files, coverage, report, markdownTable }) {
  return `## Critical Test Coverage

${coverage ? `Branch coverage: **${coverage.summary.branches.pct}%** (${coverage.summary.branches.covered}/${coverage.summary.branches.total}). All files in the configured critical domains are included, including files never loaded by tests. Existing per-file coverage cannot decrease; new files require 80% branch coverage.` : 'Not measured. This report cannot certify test coverage.'}

${
  coverage
    ? markdownTable([...coverage.files].sort((a, b) => a.branches.pct - b.branches.pct).slice(0, maxFiles), [
        { label: 'File', value: row => row.file },
        { label: 'Branches covered', value: row => `${row.branches.covered}/${row.branches.total}` },
        { label: 'Percent', value: row => row.branches.pct },
      ])
    : ''
}

`
}

function renderFunctionComplexity({ files, markdownTable }) {
  return `## Function Complexity

${markdownTable(
  files
    .flatMap(file => file.functions)
    .sort((a, b) => b.complexity - a.complexity)
    .slice(0, maxFiles),
  [
    { label: 'Function', value: row => `${row.file}:${row.line} ${row.name}` },
    { label: 'Complexity', value: row => row.complexity },
    { label: 'Nesting', value: row => row.nesting },
    { label: 'Lines', value: row => row.lines },
  ]
)}

`
}

module.exports = {
  renderCodeHealthReport,
  renderGlobalScore,
  renderWhyNotHigher,
  renderSummary,
  renderChecks,
  renderRegressionControl,
  renderCriticalTestCoverage,
  renderFunctionComplexity,
}
