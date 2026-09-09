const path = require('node:path')
const { markdownTable, cycleArea } = require('./format.cjs')

function renderSampleCycles({ architecture, markdownTable, cycleArea }) {
  return `### Sample Cycles

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

`
}

function renderNotes({ baseline, checks, duplication, hotspots, score, gate }) {
  return `## Notes

- Complexity uses the TypeScript syntax tree; nested functions are measured independently. Comments and strings do not count as branches.
- Extended type safety (unchecked indexed access and exact optional properties), escape hatches and domain-to-UI imports are tracked against the explicit baseline.
- Existing debt remains visible even when the regression gate passes.
- Churn is advisory: it never grants an exemption from function or dependency rules.
- Churn is based on Git commits from the last 90 days.
- Every import cycle fails the audit; the allowed cycle count is zero.
- The score is intentionally project-local: it rewards passing checks, low duplication, smaller modules, and lower-risk hotspots.
`
}

module.exports = { renderSampleCycles, renderNotes }
