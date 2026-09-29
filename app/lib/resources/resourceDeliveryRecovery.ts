import type { UnitEntity } from '../../types/entities'

const STALLED_DELIVERY_MS = 15000
const REJECTED_DEPOT_MS = 30000
const rejected = new WeakMap<object, Map<object, number>>()
const progress = new WeakMap<object, { state: unknown; position: unknown[]; since: number }>()

function now(unit: Pick<UnitEntity, 'context'>): number {
  return unit.context?.scheduler?.elapsedMs ?? performance.now()
}

export function rejectDeliveryTarget(unit: UnitEntity, building: object): void {
  const targets = rejected.get(unit) ?? new Map<object, number>()
  targets.set(building, now(unit) + REJECTED_DEPOT_MS)
  rejected.set(unit, targets)
}

export function isDeliveryTargetRejected(unit: Pick<UnitEntity, 'context'>, building: object): boolean {
  const targets = rejected.get(unit)
  const expires = targets?.get(building)
  if (expires == null) return false
  if (expires > now(unit)) return true
  targets?.delete(building)
  return false
}

/** Reissued commands are not progress. Movement and delivery phases are. */
export function isResourceDeliveryStalled(unit: UnitEntity, time: number): boolean {
  const state = unit.resourceDeliveryState
  if (!state || unit.spacePortalState || unit.interiorExitState || unit.waitingForEnergyAction) {
    progress.delete(unit)
    return false
  }
  const position = [unit.i, unit.j, unit.x, unit.y, unit.spaceId, state.phase]
  const previous = progress.get(unit)
  if (!previous || previous.state !== state || position.some((value, index) => value !== previous.position[index])) {
    progress.set(unit, { state, position, since: time })
    return false
  }
  return time - previous.since >= STALLED_DELIVERY_MS
}
