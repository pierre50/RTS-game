import type { UnitEntity } from '../../../types/entities'
import type { SaveEntityState } from '../../../types/save'
import type { RoadPoint } from '../RoadRoute'

export const MAX_TRAFFIC_GROUPS = 28

/** Night traffic runs from 20:00 through 05:59. Existing visible encounters finish normally. */
export function trafficActiveAtHour(group: TrafficGroup, hour: number): boolean {
  const night = hour >= 20 || hour < 6
  if (group.kind === 'bandits') return night || !group.id.endsWith(':night')
  if (!night) return true
  let hash = 0
  for (const char of group.id) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0
  return hash % 2 === 0
}

type TrafficKind = 'villagers' | 'military' | 'bandits'
export type TrafficGroup = {
  id: string
  kind: TrafficKind
  owner: string
  from: RoadPoint & { label: string; owner: string; name?: string }
  to: RoadPoint & { label: string; owner: string; name?: string }
  campId?: string
  campGeneration?: number
  route: RoadPoint[]
  progress: number
  reverse: boolean
  pauseMs: number
  retired?: boolean
  materialized?: boolean
  members: SaveEntityState[]
}
export type AmbientTrafficState = { version: 1; groups: TrafficGroup[] }
const states = new WeakMap<object, AmbientTrafficState>()
const flushers = new WeakMap<object, () => void>()
export function ambientTrafficState(map: object): AmbientTrafficState {
  let state = states.get(map)
  if (!state) states.set(map, (state = { version: 1, groups: [] }))
  return state
}
export function restoreAmbientTraffic(map: object, state?: AmbientTrafficState): void {
  states.set(map, state ? structuredClone(state) : { version: 1, groups: [] })
}
export function registerAmbientTrafficFlush(map: object, flush?: () => void): void {
  if (flush) flushers.set(map, flush)
  else flushers.delete(map)
}
export function serializeAmbientTraffic(map: object): AmbientTrafficState {
  flushers.get(map)?.()
  return structuredClone(ambientTrafficState(map))
}

/** No cell, entity, AI or collision work while abstract. Pauses are part of the itinerary. */
export function advanceTraffic(group: TrafficGroup, seconds: number): void {
  if (group.retired || group.route.length < 2 || seconds <= 0) return
  const speed = group.kind === 'military' ? 0.65 : group.kind === 'bandits' ? 0.5 : 0.45
  const end = group.route.length - 1
  const rest = group.kind === 'bandits' ? 45 : 30
  // Whole round trips return to exactly the same state, including endpoint pauses.
  seconds %= 2 * (end / speed + rest)
  for (let n = 0; n < 6 && seconds > 0; n++) {
    const waiting = Math.min(seconds, group.pauseMs / 1000)
    group.pauseMs -= waiting * 1000
    seconds -= waiting
    if (!seconds) break
    const remaining = (group.reverse ? group.progress : end - group.progress) / speed
    const elapsed = Math.min(seconds, remaining)
    group.progress += (group.reverse ? -1 : 1) * elapsed * speed
    seconds -= elapsed
    if (elapsed === remaining) {
      group.reverse = !group.reverse
      group.pauseMs = rest * 1000
    }
  }
}

/** Intentionally excludes runtime orders, village jobs and references to live entities. */
export function snapshotTrafficActor(actor: UnitEntity): SaveEntityState {
  const keys = [
    'label',
    'type',
    'name',
    'i',
    'j',
    'hitPoints',
    'totalHitPoints',
    'inventory',
    'equipment',
    'gender',
    'assetCiv',
    'appearanceVariants',
    'equipmentDurability',
    'isDead',
    'isDestroyed',
    'energy',
    'assetLevel',
  ]
  const source = actor as unknown as Record<string, unknown>
  return structuredClone(
    Object.fromEntries(keys.filter(key => source[key] !== undefined).map(key => [key, source[key]]))
  ) as SaveEntityState
}
