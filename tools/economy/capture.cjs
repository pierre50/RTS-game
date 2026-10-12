const kinds = [
  'gathered',
  'construction',
  'meals',
  'craftConsumed',
  'craftProduced',
  'renewed',
  'supplied',
  'payment',
  'refund',
]
function validateCapture(capture) {
  const number = n => typeof n === 'number' && Number.isFinite(n) && n >= 0
  const amounts = value =>
    value && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every(number)
  if (
    capture?.format !== 'economy-flow-capture' ||
    capture.version !== 1 ||
    !number(capture.startedAtMs) ||
    !number(capture.endedAtMs) ||
    !number(capture.elapsedMs) ||
    capture.endedAtMs < capture.startedAtMs ||
    Math.abs(capture.elapsedMs - (capture.endedAtMs - capture.startedAtMs)) > 0.001 ||
    typeof capture.active !== 'boolean' ||
    typeof capture.incomplete !== 'boolean' ||
    !Array.isArray(capture.rows) ||
    capture.rows.length > 20000 ||
    !capture.rows.every(
      row =>
        row &&
        ['live', 'offline'].includes(row.mode) &&
        kinds.includes(row.kind) &&
        typeof row.player === 'string' &&
        typeof row.resource === 'string' &&
        number(row.amount)
    ) ||
    !Array.isArray(capture.stocks) ||
    !capture.stocks.every(row => row && typeof row.player === 'string' && amounts(row.before) && amounts(row.after)) ||
    !Array.isArray(capture.offlineWindows) ||
    capture.offlineWindows.length > 10000 ||
    !capture.offlineWindows.every(
      w =>
        w &&
        number(w.fromMs) &&
        number(w.toMs) &&
        w.toMs >= w.fromMs &&
        Array.isArray(w.players) &&
        w.players.every(p => typeof p === 'string')
    )
  )
    throw new Error('Capture économique invalide ou version non prise en charge.')
  if (
    capture.objectives !== undefined &&
    (!Array.isArray(capture.objectives) ||
      capture.objectives.length > 100 ||
      !capture.objectives.every(
        m =>
          m &&
          typeof m.id === 'string' &&
          m.id.length > 0 &&
          m.id.length <= 100 &&
          typeof m.completed === 'boolean' &&
          number(m.gameMs) &&
          number(m.realMs) &&
          Array.isArray(m.segments) &&
          m.segments.length <= 2001 &&
          m.segments.every(
            s =>
              s &&
              ['harvest', 'travel', 'pause', 'build', 'craft', 'other'].includes(s.phase) &&
              number(s.gameMs) &&
              number(s.realMs)
          ) &&
          Math.abs(m.segments.reduce((n, s) => n + s.gameMs, 0) - m.gameMs) < 0.01 &&
          Math.abs(m.segments.reduce((n, s) => n + s.realMs, 0) - m.realMs) < 0.01
      ))
  )
    throw new Error('Mesures d’objectifs invalides.')
  return capture
}
module.exports = { validateCapture }
