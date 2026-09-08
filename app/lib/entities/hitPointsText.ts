export function formatDisplayedHitPoints(value: string | number): number {
  const hitPoints = Number(value)
  if (!Number.isFinite(hitPoints)) return 0
  if (hitPoints > 0 && hitPoints < 1) return 1
  return Math.round(hitPoints)
}

export function formatHitPointsText(hitPoints: string | number, totalHitPoints: string | number): string {
  if (hitPoints === '') return ''

  const max = Number(totalHitPoints)
  const safeCurrent = formatDisplayedHitPoints(hitPoints)
  const safeMax = Number.isFinite(max) ? Math.round(max) : 0
  return `${safeCurrent}/${safeMax}`
}
