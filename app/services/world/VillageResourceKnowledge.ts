import { BUILDING_TYPES, BUCKET_SIZE } from '../../constants'
import { VILLAGE_ACTIVITY_RADIUS } from '../../config/villageActivity'
import { CompactResourceSet, currentResourceRecord } from '../../classes/resources/CompactResourceSet'
import type { AIStrategyPlayerLike } from '../../ai/types'
import type { ResourceEntity, RuntimeEntity } from '../../types/entities'
import type { RuntimeMap } from '../../types/map'

type Point = { i: number; j: number; spaceId?: string | null }
type Index = {
  anchor: Point
  resources: Map<string, ResourceEntity>
  pending: Map<string, ResourceEntity>
  nextCheck: number
}
const maps = new WeakMap<object, { indexes: Set<Index>; lastCheck: number }>()
const owners = new WeakMap<object, { map: RuntimeMap; indexes: Map<object, Index> }>()
const radius = VILLAGE_ACTIVITY_RADIUS
const key = (value: Point) => `${value.i}:${value.j}`
const outside = (value: Point) => !value.spaceId || value.spaceId === 'outside'
const near = (a: Point, b: Point) => outside(b) && (a.i - b.i) ** 2 + (a.j - b.j) ** 2 <= radius ** 2

export function villageEconomicAnchors(ai: Pick<AIStrategyPlayerLike, 'buildingsByTypes' | 'getHomeAnchor'>): Point[] {
  const centers = ai
    .buildingsByTypes([BUILDING_TYPES.townCenter])
    .filter(b => b.isBuilt && !b.isDead && !b.isDestroyed && outside(b))
  const fallback = ai.getHomeAnchor()
  return centers.length ? centers : fallback ? [fallback] : []
}

/** Resource events are coalesced only into existing nearby village indexes. No world event log is retained. */
export function updateVillageResource(map: object, resource: ResourceEntity): void {
  for (const index of maps.get(map)?.indexes ?? []) {
    if (near(index.anchor, resource)) index.pending.set(key(resource), resource)
  }
}

export function* localInstances(map: RuntimeMap, anchor: Point): Iterable<RuntimeEntity> {
  const buckets = map.instanceBuckets
  if (buckets) {
    for (
      let i = Math.max(0, Math.floor((anchor.i - radius) / BUCKET_SIZE));
      i <= Math.floor((anchor.i + radius) / BUCKET_SIZE);
      i++
    )
      for (
        let j = Math.max(0, Math.floor((anchor.j - radius) / BUCKET_SIZE));
        j <= Math.floor((anchor.j + radius) / BUCKET_SIZE);
        j++
      )
        for (const entity of buckets[i]?.[j] ?? []) if (near(anchor, entity)) yield entity
  } else {
    // Small maps without buckets still inspect only the local cells.
    for (let i = Math.max(0, Math.floor(anchor.i - radius)); i <= anchor.i + radius; i++)
      for (let j = Math.max(0, Math.floor(anchor.j - radius)); j <= anchor.j + radius; j++) {
        const cell = map.grid[i]?.[j]
        if (cell?.has && near(anchor, cell.has)) yield cell.has
        for (const corpse of cell?.corpses ?? []) if (near(anchor, corpse)) yield corpse
      }
  }
}

function rebuild(map: RuntimeMap, index: Index, now: number): void {
  index.resources.clear()
  const { anchor } = index
  if (map.resources instanceof CompactResourceSet)
    for (const resource of map.resources.readArea(
      anchor.i - radius,
      anchor.j - radius,
      anchor.i + radius,
      anchor.j + radius,
      true
    ))
      if (near(anchor, resource)) index.resources.set(key(resource), resource)
  for (const resource of localInstances(map, anchor))
    if (resource.family === 'resource' && !resource.isDestroyed)
      index.resources.set(key(resource), resource as ResourceEntity)
  index.pending.clear()
  // Stagger the fallback; resource events do not reset this deadline.
  index.nextCheck = now + 15000 + (Math.abs(anchor.i * 31 + anchor.j * 17) % 5000)
}

/** Each village owns an index; quantities and destruction always come from the authoritative resource. */
export function* villageResources(ai: AIStrategyPlayerLike, now: number): Iterable<ResourceEntity> {
  const map = ai.context.map
  let state = maps.get(map)
  if (!state) maps.set(map, (state = { indexes: new Set(), lastCheck: -Infinity }))
  let owner = owners.get(ai)
  if (owner?.map !== map) {
    if (owner) for (const index of owner.indexes.values()) maps.get(owner.map)?.indexes.delete(index)
    owners.set(ai, (owner = { map, indexes: new Map() }))
  }
  const anchors = villageEconomicAnchors(ai)
  // Fallback anchors may be freshly allocated coordinates on each call.
  const identities: object[] = anchors.map(anchor => ('label' in anchor ? anchor : ai))
  for (const [identity, index] of owner.indexes)
    if (!identities.includes(identity)) {
      owner.indexes.delete(identity)
      state.indexes.delete(index)
    }
  const seen = new Set<string>()
  for (let n = 0; n < anchors.length; n++) {
    const anchor = anchors[n]
    const identity = identities[n]
    let index = owner.indexes.get(identity)
    if (!index) {
      index = { anchor: { i: anchor.i, j: anchor.j }, resources: new Map(), pending: new Map(), nextCheck: 0 }
      owner.indexes.set(identity, index)
      state.indexes.add(index)
      rebuild(map, index, now)
    } else if (
      index.anchor.i !== anchor.i ||
      index.anchor.j !== anchor.j ||
      (now >= index.nextCheck && now - state.lastCheck >= 250)
    ) {
      index.anchor = { i: anchor.i, j: anchor.j }
      rebuild(map, index, now)
      state.lastCheck = now
    }
    // At most 64 changed cells per village step; overflow is naturally coalesced by cell.
    let processed = 0
    for (const [position, resource] of index.pending) {
      if (processed++ >= 64) break
      index.pending.delete(position)
      if (resource.isDestroyed) index.resources.delete(position)
      else index.resources.set(position, resource)
    }
    for (const [position, stored] of index.resources) {
      const resource = currentResourceRecord(stored)
      if (!resource || resource.isDestroyed) {
        index.resources.delete(position)
        continue
      }
      if (seen.has(position)) continue
      seen.add(position)
      yield resource
    }
  }
}

export function* villageAnimals(
  ai: Pick<AIStrategyPlayerLike, 'context' | 'buildingsByTypes' | 'getHomeAnchor'>
): Iterable<RuntimeEntity> {
  const seen = new Set<RuntimeEntity>()
  for (const anchor of villageEconomicAnchors(ai))
    for (const entity of localInstances(ai.context.map, anchor))
      if (entity.family === 'animal' && !entity.isDestroyed && !seen.has(entity)) {
        seen.add(entity)
        yield entity
      }
}
