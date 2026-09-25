import type { ResourceEntity } from '../types/entities'
import type { SaveEntityState } from '../types/save'

/** Only touched/growing resources, never the immutable baseline. */
const growing = new WeakMap<object, Set<ResourceEntity>>()
export function naturalGrowthFor(map: object): Set<ResourceEntity> {
  let set = growing.get(map)
  if (!set) growing.set(map, (set = new Set()))
  return set
}
export function trackNaturalGrowth(value: object): void {
  const resource = value as ResourceEntity
  if (resource.type !== 'Berrybush' && resource.type !== 'Wheat') return
  const map = resource.context?.map
  if (!map) return
  naturalGrowthFor(map).add(resource)
}
export function clearNaturalGrowth(map: object): void {
  growing.delete(map)
}

/** Date buckets avoid examining every depleted site on every new day. */
export class ResourceRenewalQueue {
  private days = new Map<number, SaveEntityState[]>()
  add(slot: SaveEntityState, day: number): void {
    let bucket = this.days.get(day)
    if (!bucket) this.days.set(day, (bucket = []))
    bucket.push(slot)
  }
  *due(day: number): Iterable<SaveEntityState> {
    for (const deadline of [...this.days.keys()].sort((a, b) => a - b)) {
      if (deadline > day) break
      const bucket = this.days.get(deadline)!
      this.days.delete(deadline)
      yield* bucket
    }
  }
}

const flushers = new WeakMap<object, () => void>()
export function registerGrowthFlush(map: object, flush: () => void): () => void {
  flushers.set(map, flush)
  return () => {
    flushers.delete(map)
  }
}
export function flushNaturalGrowth(map: object): void {
  flushers.get(map)?.()
}
