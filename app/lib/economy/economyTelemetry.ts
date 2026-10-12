import { resetEconomyObjectives, readEconomyObjectives } from './economyObjectives'
/** Opt-in diagnostic counters. No save state, gameplay decisions or per-impact event history. */
type Amounts = Record<string, number | undefined>
export type EconomyFlowKind =
  | 'gathered'
  | 'construction'
  | 'meals'
  | 'craftConsumed'
  | 'craftProduced'
  | 'renewed'
  | 'supplied'
  | 'payment'
  | 'refund'
type EconomyFlowMode = 'live' | 'offline'
type Actor = {
  label?: string
  civ?: string
  owner?: Owner | null
  interiorBuildings?: Actor[]
  inventory?: { resources?: Amounts }
  constructionMaterials?: { delivered?: Amounts }
  isDead?: boolean
  isDestroyed?: boolean
}
type Owner = Actor & { units?: Actor[]; buildings?: Actor[] }
type EconomyFlowRow = {
  mode: EconomyFlowMode
  player: string
  kind: EconomyFlowKind
  resource: string
  amount: number
}
export type EconomyFlowCapture = {
  format: 'economy-flow-capture'
  version: 1
  active: boolean
  startedAtMs: number
  endedAtMs: number
  elapsedMs: number
  rows: EconomyFlowRow[]
  stocks: { player: string; before: Amounts; after: Amounts; delta: Amounts }[]
  offlineWindows: { fromMs: number; toMs: number; players: string[] }[]
  incomplete: boolean
  objectives?: ReturnType<typeof readEconomyObjectives>
}
type Session = {
  clock: () => number
  players: () => Owner[]
  startedAtMs: number
  rows: Map<string, EconomyFlowRow>
  opening: Map<string, Amounts>
  offlineWindows: EconomyFlowCapture['offlineWindows']
  incomplete: boolean
}
let session: Session | undefined
let completed: EconomyFlowCapture | undefined
let mode: EconomyFlowMode = 'live'
let owners = new WeakMap<object, Owner>()
const playerKey = (actor: Actor) => actor.label || actor.civ || 'sans-identifiant'

/** @public Read by diagnostic integration tests. */
export function economyTelemetryActive(): boolean {
  return Boolean(session)
}
export function bindEconomyActors(players: Owner[]): void {
  if (!session) return
  for (const player of players) {
    const seen = new Set<object>()
    const visit = (actor: Actor) => {
      if (seen.has(actor)) return
      seen.add(actor)
      owners.set(actor, player)
      for (const child of actor.interiorBuildings ?? []) visit(child)
    }
    visit(player)
    for (const entity of [...(player.units ?? []), ...(player.buildings ?? [])]) visit(entity)
  }
}
function stockSnapshots(players: Owner[]): Map<string, Amounts> {
  const result = new Map<string, Amounts>()
  for (const player of players) {
    const total: Amounts = {},
      seen = new Set<object>()
    const visit = (actor: Actor) => {
      if (seen.has(actor) || actor.isDead || actor.isDestroyed) return
      if (actor.owner && actor.owner !== player && actor.owner.label !== player.label) return
      seen.add(actor)
      for (const [key, value] of Object.entries(actor.inventory?.resources ?? {}))
        if (typeof value === 'number' && Number.isFinite(value)) total[key] = (total[key] ?? 0) + value
      // Reserved construction cargo is still stock until the first work impact commits it.
      for (const [key, value] of Object.entries(actor.constructionMaterials?.delivered ?? {}))
        if (typeof value === 'number' && Number.isFinite(value)) total[key] = (total[key] ?? 0) + value
      for (const child of actor.interiorBuildings ?? []) visit(child)
    }
    for (const entity of [...(player.units ?? []), ...(player.buildings ?? [])]) visit(entity)
    result.set(playerKey(player), total)
  }
  return result
}
export function startEconomyTelemetry(clock: () => number, players: () => Owner[]): boolean {
  if (session) return false
  resetEconomyObjectives()
  completed = undefined
  owners = new WeakMap()
  session = {
    clock,
    players,
    startedAtMs: clock(),
    rows: new Map(),
    opening: stockSnapshots(players()),
    offlineWindows: [],
    incomplete: false,
  }
  bindEconomyActors(players())
  return true
}
export function recordEconomyFlow(actor: object | null | undefined, kind: EconomyFlowKind, amounts: Amounts): void {
  if (!session) return
  const entity = actor as Actor | undefined
  const owner = entity && (owners.get(entity) ?? entity.owner ?? entity)
  const player = owner ? playerKey(owner) : 'monde'
  for (const [resource, amount] of Object.entries(amounts)) {
    if (resource === 'food' && ['berry', 'meat', 'wheat'].some(key => Object.hasOwn(amounts, key))) continue
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) continue
    const key = JSON.stringify([mode, player, kind, resource])
    let row = session.rows.get(key)
    if (!row) {
      if (session.rows.size >= 20000) {
        session.incomplete = true
        continue
      }
      row = { mode, player, kind, resource, amount: 0 }
      session.rows.set(key, row)
    }
    row.amount += amount
  }
}
/** A synchronous scope: always restores the mode, including nested simulations and exceptions. */
export function withOfflineEconomyTelemetry<T>(players: Owner[], fromMs: number, toMs: number, run: () => T): T {
  if (!session) return run()
  if (mode !== 'offline' && Number.isFinite(fromMs) && Number.isFinite(toMs) && toMs > fromMs) {
    if (session.offlineWindows.length < 10000)
      session.offlineWindows.push({ fromMs, toMs, players: players.map(playerKey) })
    else session.incomplete = true
  }
  bindEconomyActors(players)
  const previous = mode
  mode = 'offline'
  try {
    return run()
  } finally {
    mode = previous
  }
}
export function readEconomyTelemetry(stop = false): EconomyFlowCapture | undefined {
  if (!session) return completed
  const end = session.clock(),
    closing = stockSnapshots(session.players())
  const stocks = [...new Set([...session.opening.keys(), ...closing.keys()])].map(player => {
    const before = session!.opening.get(player) ?? {},
      after = closing.get(player) ?? {}
    const delta = Object.fromEntries(
      [...new Set([...Object.keys(before), ...Object.keys(after)])].map(key => [
        key,
        (after[key] ?? 0) - (before[key] ?? 0),
      ])
    )
    return { player, before, after, delta }
  })
  const result: EconomyFlowCapture = {
    format: 'economy-flow-capture',
    version: 1,
    active: !stop,
    startedAtMs: session.startedAtMs,
    endedAtMs: end,
    elapsedMs: Math.max(0, end - session.startedAtMs),
    rows: [...session.rows.values()].map(row => ({ ...row })),
    stocks,
    offlineWindows: session.offlineWindows.map(window => ({ ...window, players: [...window.players] })),
    incomplete: session.incomplete,
    objectives: readEconomyObjectives(end, stop),
  }
  if (stop) {
    completed = result
    session = undefined
    owners = new WeakMap()
    mode = 'live'
  }
  return result
}
/** Measure real removals/additions around a committed action, never around its affordability preview. */
export function observeEconomyChange<T>(
  actor: object | null | undefined,
  kind: EconomyFlowKind,
  read: () => Amounts,
  direction: 'removed' | 'added',
  run: () => T
): T {
  if (!session) return run()
  const before = { ...read() }
  const result = run(),
    after = read()
  const amounts: Amounts = {}
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const difference = (after[key] ?? 0) - (before[key] ?? 0)
    amounts[key] = direction === 'added' ? difference : -difference
  }
  recordEconomyFlow(actor, kind, amounts)
  return result
}
