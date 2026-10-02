import { outsideWildlifeHome } from './WildlifeHabitat'
import type { SaveEntityState } from '../../types/save'

const WILDLIFE_ZONE_SIZE = 32
export const WILDLIFE_RENEW_DAYS = 3
export type WildlifeEntry = { state: SaveEntityState; zone: string }
const stores = new WeakMap<object, WildlifeStore>()
export const getWildlifeStore = (map: object): WildlifeStore | undefined => stores.get(map)
export function installWildlifeStore(map: object, animals: SaveEntityState[], prefix: string): WildlifeStore {
  const store = new WildlifeStore(animals, prefix)
  stores.set(map, store)
  return store
}
export function clearWildlifeStore(map: object): void {
  stores.delete(map)
}
export function isWildlife(state: SaveEntityState): boolean {
  return !state.trapPrey && state.tamingStatus !== 'tamed' && (!state.spaceId || state.spaceId === 'outside')
}

/** Plain records only. Sleeping animals never own graphics, cells, controllers or scheduler callbacks. */
export class WildlifeStore {
  readonly entries = new Map<string, WildlifeEntry>()
  readonly zones = new Map<string, Set<string>>()
  readonly pending = new Set<string>()
  readonly displaced = new Set<string>()
  constructor(animals: SaveEntityState[], prefix: string) {
    animals.forEach((source, index) => {
      const state = structuredClone(source)
      state.label ??= `${prefix}:${index}`
      if (this.entries.has(state.label)) throw new Error(`Duplicate wildlife label: ${state.label}`)
      if (!state.isDead && state.action !== 'attack' && !state.isFleeing) {
        state.path = []
        state.dest = null
        state.previousDest = null
        state.realDest = null
        state.action = null
        state.inactif = true
        delete state.x
        delete state.y
        delete state.currentSheet
        delete state.currentFrame
      }
      state.wildlife ??= { homeI: state.i, homeJ: state.j, generation: 0 }
      this.put(state)
    })
  }
  put(state: SaveEntityState): void {
    const label = state.label!
    const old = this.entries.get(label)
    if (old) this.zones.get(old.zone)?.delete(label)
    const zone = `${Math.floor(state.i / WILDLIFE_ZONE_SIZE)}:${Math.floor(state.j / WILDLIFE_ZONE_SIZE)}`
    this.entries.set(label, { state, zone })
    let members = this.zones.get(zone)
    if (!members) this.zones.set(zone, (members = new Set()))
    members.add(label)
    if (state.isDead || state.isDestroyed) this.pending.add(label)
    else this.pending.delete(label)
    if (!state.isDead && !state.isDestroyed && state.wildlife && outsideWildlifeHome(state, state.wildlife))
      this.displaced.add(label)
    else this.displaced.delete(label)
  }
  remove(label: string): void {
    const entry = this.entries.get(label)
    if (entry) this.zones.get(entry.zone)?.delete(label)
    this.entries.delete(label)
    this.pending.delete(label)
    this.displaced.delete(label)
  }
  *near(i: number, j: number, radius: number): Iterable<string> {
    for (let x = Math.floor((i - radius) / WILDLIFE_ZONE_SIZE); x <= Math.floor((i + radius) / WILDLIFE_ZONE_SIZE); x++)
      for (
        let y = Math.floor((j - radius) / WILDLIFE_ZONE_SIZE);
        y <= Math.floor((j + radius) / WILDLIFE_ZONE_SIZE);
        y++
      )
        for (const label of this.zones.get(`${x}:${y}`) ?? []) {
          const state = this.entries.get(label)!.state
          if (Math.hypot(state.i - i, state.j - j) <= radius) yield label
        }
  }
}

export function markWildlifeDeath(map: object, label: string, day: number): void {
  const store = stores.get(map),
    entry = store?.entries.get(label)
  if (!store || !entry) return
  entry.state.wildlife!.renewDay ??= day + WILDLIFE_RENEW_DAYS
  store.pending.add(label)
}
