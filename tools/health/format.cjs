const { HOTSPOT_LOC_THRESHOLD, HOTSPOT_BRANCH_THRESHOLD, HOTSPOT_CHURN_THRESHOLD } = require('./config.cjs')

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
  return targets.join(' et ')
}

function architectureFixText(architecture) {
  if (architecture.cycles == null) {
    return 'No architecture fix plan available because import cycles were not measured.'
  }
  if (architecture.cycles === 0) {
    return 'No import-cycle fix needed. Keep the baseline gate so new cycles cannot sneak in.'
  }
  return 'Review the measured cycle paths below and remove dependencies at their shared hubs.'
}

function markdownTable(rows, columns) {
  const header = `| ${columns.map(column => column.label).join(' | ')} |`
  const divider = `| ${columns.map(() => '---').join(' | ')} |`
  const body = rows.map(
    row =>
      `| ${columns.map(column => String(column.value(row)).replace(/\|/g, '&#124;').replace(/\r?\n/g, '<br>')).join(' | ')} |`
  )
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

module.exports = {
  markdownTable,
  priorityReason,
  hotspotReason,
  hotspotExitTarget,
  architectureFixText,
  cycleArea,
  countCycleFiles,
}
