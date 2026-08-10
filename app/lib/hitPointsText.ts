export function formatHitPointsText(hitPoints: string | number, totalHitPoints: string | number): string {
  if (hitPoints === '') return ''

  const current = Number(hitPoints)
  const max = Number(totalHitPoints)
  const safeCurrent = Number.isFinite(current) ? Math.round(current) : 0
  const safeMax = Number.isFinite(max) ? Math.round(max) : 0
  return `${safeCurrent}/${safeMax}`
}
