import { markEconomyObjective } from '../../lib/economy/economyObjectives'
import { economyTelemetryActive } from '../../lib/economy/economyTelemetry'
import { readEconomyTelemetry, startEconomyTelemetry } from '../../lib/economy/economyTelemetry'
import type { CommandResult, DevConsoleContext } from '../types'

export function economyFlowCommand(args: string[], context: DevConsoleContext): CommandResult {
  const action = args[0] ?? 'show'
  if (['goal', 'phase', 'finish'].includes(action)) {
    if (!economyTelemetryActive()) return { ok: false, message: 'Démarrez une capture avec economy-flow start.' }
    if ((action === 'finish' && args.length !== 1) || (action !== 'finish' && args.length !== 2))
      return {
        ok: false,
        message: 'Usage: economy-flow goal identifiant | phase harvest|travel|pause|build|craft|other | finish',
      }
    return { ok: true, message: markEconomyObjective(action, args[1], context.dayNight?.getElapsedMs?.() ?? 0) }
  }
  if (args.length > 1 || !['start', 'stop', 'show', 'export'].includes(action))
    return { ok: false, message: 'Usage: economy-flow [start|stop|show|export]' }
  if (action === 'start') {
    if (!context.dayNight?.getElapsedMs) return { ok: false, message: 'Horloge du jeu indisponible.' }
    const started = startEconomyTelemetry(
      () => context.dayNight?.getElapsedMs?.() ?? 0,
      () => context.players
    )
    return {
      ok: started,
      message: started
        ? 'Mesure économique démarrée. Jouez normalement, puis economy-flow stop et economy-flow export.'
        : 'Une mesure est déjà active. Arrêtez-la avant d’en démarrer une autre.',
    }
  }
  const capture = readEconomyTelemetry(action === 'stop')
  if (!capture) return { ok: false, message: 'Aucune mesure. Utilisez economy-flow start.' }
  if (action === 'export') {
    const blob = new Blob([JSON.stringify(capture, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'economy-flow.json'
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return {
      ok: true,
      message:
        'Capture exportée. Importez-la dans le rapport économique, ou utilisez pnpm economy:audit --capture chemin/economy-flow.json.',
    }
  }
  const totals = new Map<string, number>()
  for (const row of capture.rows) {
    const key = `${row.mode} | ${row.kind} | ${row.resource}`
    totals.set(key, (totals.get(key) ?? 0) + row.amount)
  }
  return {
    ok: true,
    message: [
      `Mesure ${capture.active ? 'en cours' : 'arrêtée'} : ${(capture.elapsedMs / 1000).toFixed(1)} secondes d’horloge du jeu.`,
      `${capture.offlineWindows.length} périodes simulées observées ; leurs dates peuvent précéder le début de capture.`,
      ...[...totals].map(([key, amount]) => `${key}: ${amount}`),
      'Transferts exclus. Les renouvellements sont du potentiel sur la carte, pas des entrées en stock.',
      ...(capture.incomplete ? ['Limite de capture atteinte : données partielles.'] : []),
    ].join('\n'),
  }
}
