/** Manual diagnostic marks; no automatic claim that a gameplay objective was completed. */
const phases = ['harvest', 'travel', 'pause', 'build', 'craft', 'other'] as const
type Phase = (typeof phases)[number]
type Segment = { phase: Phase; gameMs: number; realMs: number }
type Measurement = {
  id: string
  completed: boolean
  gameMs: number
  realMs: number
  segments: Segment[]
}
let measurements: Measurement[] = []
let active: { result: Measurement; phase: Phase; game: number; real: number } | undefined
export function resetEconomyObjectives(): void {
  measurements = []
  active = undefined
}
function flush(game: number, real: number): void {
  if (!active) return
  const segment = {
    phase: active.phase,
    gameMs: Math.max(0, game - active.game),
    realMs: Math.max(0, real - active.real),
  }
  const previous = active.result.segments.at(-1)
  if (previous?.phase === segment.phase) {
    previous.gameMs += segment.gameMs
    previous.realMs += segment.realMs
  } else active.result.segments.push(segment)
  active.result.gameMs += segment.gameMs
  active.result.realMs += segment.realMs
  active.game = game
  active.real = real
}
export function markEconomyObjective(
  action: string,
  value: string | undefined,
  game: number,
  real = performance.now()
): string {
  if (action === 'goal') {
    if (active) return 'Un objectif est déjà en cours. Utilisez economy-flow finish.'
    if (!value || value.length > 100) return 'Indiquez un identifiant d’objectif de 1 à 100 caractères.'
    if (measurements.length >= 100)
      return 'Limite de 100 objectifs atteinte. Exportez puis démarrez une nouvelle capture.'
    const result: Measurement = { id: value, completed: false, gameMs: 0, realMs: 0, segments: [] }
    measurements.push(result)
    active = { result, phase: 'other', game, real }
    return `Objectif ${value} démarré ; phase initiale : other.`
  }
  if (!active) return 'Aucun objectif actif. Utilisez economy-flow goal maison.'
  if (action === 'phase') {
    if (!phases.includes(value as Phase)) return `Phases : ${phases.join(', ')}.`
    if (active.result.segments.length >= 2000) return 'Limite d’étapes atteinte. Terminez cet objectif.'
    flush(game, real)
    active.phase = value as Phase
    return `Phase : ${value}.`
  }
  flush(game, real)
  if (action === 'finish') {
    active.result.completed = true
    active = undefined
    return 'Objectif déclaré terminé. Mesure conservée dans l’export.'
  }
  return 'Action inconnue.'
}
export function readEconomyObjectives(game: number, stop = false, real = performance.now()): Measurement[] {
  flush(game, real)
  if (stop) active = undefined // Interrupted objectives remain explicitly incomplete.
  return measurements.map(m => ({ ...m, segments: m.segments.map(s => ({ ...s })) }))
}
