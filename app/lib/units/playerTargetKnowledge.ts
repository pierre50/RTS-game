import { isWheatMature } from '../combat/resourceActionConditions'
import { getEntitySpaceId, sameMapSpace } from '../mapSpaces'
import { instanceIsInInsightRange } from './insightDetection'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'

export type TargetObservation = Pick<
  RuntimeEntity,
  'i' | 'j' | 'label' | 'type' | 'family' | 'hitPoints' | 'quantity' | 'isDead' | 'isDestroyed'
> & { spaceId: string; mature?: boolean }
const memories = new WeakMap<object, Map<string, TargetObservation>>()
const knownEntities = new WeakMap<object, Map<string, RuntimeEntity>>()
const key = (target: { label: string; spaceId?: string | null }) => target.label

/** Gameplay perception: never use renderer visibility or the active camera's space. */
export function playerSeesTarget(owner: PlayerLike | undefined, target: RuntimeEntity): boolean {
  if (!owner) return false
  if (target.owner === owner) return true
  const views = owner.views
  const inspect = () => {
    const viewers = views?.getViewers?.(target.i, target.j)
    const candidates = viewers
      ? [...viewers].flatMap(viewer =>
          typeof viewer === 'string'
            ? [...(owner.units ?? []), ...(owner.buildings ?? [])].filter(entity => entity.label === viewer)
            : [viewer]
        )
      : [...(owner.units ?? []), ...(owner.buildings ?? [])]
    return candidates.some(candidate => {
      const observer = candidate as UnitEntity
      return (
        !observer.isDead &&
        !observer.isDestroyed &&
        observer.providesVision !== false &&
        sameMapSpace(observer, target) &&
        instanceIsInInsightRange(observer, target)
      )
    })
  }
  return views?.withSpace?.(target.spaceId, inspect) ?? inspect()
}

export function observeTarget(owner: PlayerLike | undefined, target: RuntimeEntity): TargetObservation | undefined {
  if (!owner || !target.label || !target.family || !target.type || !playerSeesTarget(owner, target)) return undefined
  return rememberTarget(owner, target)
}

function rememberTarget(owner: PlayerLike, target: RuntimeEntity): TargetObservation {
  let memory = memories.get(owner)
  if (!memory) {
    memory = new Map()
    memories.set(owner, memory)
  }
  const observation: TargetObservation = {
    i: target.i,
    j: target.j,
    label: target.label,
    type: target.type,
    family: target.family,
    spaceId: getEntitySpaceId(target),
    hitPoints: target.hitPoints,
    quantity: target.quantity,
    mature: target.type === 'Wheat' ? isWheatMature(target) : undefined,
    isDead: target.isDead,
    isDestroyed: target.isDestroyed,
  }
  let entities = knownEntities.get(owner)
  if (!entities) {
    entities = new Map()
    knownEntities.set(owner, entities)
  }
  entities.set(key(target), target)
  memory.set(key(target), observation)
  return observation
}

export function knownTarget(owner: PlayerLike | undefined, target: RuntimeEntity): TargetObservation | undefined {
  return observeTarget(owner, target) ?? (owner && memories.get(owner)?.get(key(target)))
}

export function exportTargetKnowledge(owner: object): TargetObservation[] {
  return [...(memories.get(owner)?.values() ?? [])].map(observation => ({ ...observation }))
}

export function validateTargetKnowledge(records: unknown): asserts records is TargetObservation[] | undefined {
  if (records === undefined) return
  if (!Array.isArray(records)) throw new Error('Invalid target knowledge')
  const labels = new Set<string>()
  for (const record of records) {
    if (
      !record ||
      typeof record.label !== 'string' ||
      !record.label ||
      labels.has(record.label) ||
      typeof record.spaceId !== 'string' ||
      !record.spaceId ||
      !Number.isInteger(record.i) ||
      record.i < 0 ||
      !Number.isInteger(record.j) ||
      record.j < 0 ||
      typeof record.family !== 'string' ||
      typeof record.type !== 'string' ||
      ['hitPoints', 'quantity'].some(field => record[field] !== undefined && !Number.isFinite(record[field])) ||
      ['isDead', 'isDestroyed', 'mature'].some(
        field => record[field] !== undefined && typeof record[field] !== 'boolean'
      )
    ) {
      throw new Error('Invalid target knowledge record')
    }
    labels.add(record.label)
  }
}

export function restoreTargetKnowledge(owner: object, records: TargetObservation[] = []): void {
  validateTargetKnowledge(records)
  knownEntities.delete(owner)
  memories.set(owner, new Map(records.map(record => [key(record), { ...record }])))
}

/** Retain discovered static targets until their disappearance is actually observed. */
export function rememberedStaticTargets(owner: PlayerLike | undefined): RuntimeEntity[] {
  if (!owner) return []
  return [...(knownEntities.get(owner)?.values() ?? [])].filter(target => {
    const record = memories.get(owner)?.get(key(target))
    return record && (record.family === 'resource' || (record.family === 'animal' && record.isDead))
  })
}

/** One-time migration: old saves recorded explored terrain but no target snapshots. */
export function restoreLegacyStaticKnowledge(owner: PlayerLike, targets: Iterable<RuntimeEntity>): void {
  for (const target of targets) {
    if (target.family !== 'resource' || !target.label) continue
    const viewed = () => owner.views?.isViewed(target.i, target.j)
    if (owner.views?.withSpace?.(target.spaceId, viewed) ?? viewed()) rememberTarget(owner, target)
  }
}
