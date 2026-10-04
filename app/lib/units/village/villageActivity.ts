import { notifyVillageStateChanged } from './villageStateEvents'
import { VILLAGE_ACTIVITY_RADIUS } from '../../../config/villageActivity'
import type { UnitEntity } from '../../../types/entities'
import type { GridPosition } from '../../../types/grid'

// Ownership is runtime-only. Saves flush to ordinary entity data first.
const distantOwners = new WeakMap<object, () => void>()
export function setDistantOwner(owner: object, wake?: () => void): void {
  const wasDistant = distantOwners.has(owner)
  if (wake) distantOwners.set(owner, wake)
  else distantOwners.delete(owner)
  if (wasDistant !== Boolean(wake)) notifyVillageStateChanged(owner)
}
export function isDistantOwner(owner: object): boolean {
  return distantOwners.has(owner)
}
export function wakeDistantOwner(owner: object): void {
  distantOwners.get(owner)?.()
}

const dailyPlanners = new WeakMap<object, () => void>()
export function registerDistantDailyPlanning(context: object, plan?: () => void): void {
  if (plan) dailyPlanners.set(context, plan)
  else dailyPlanners.delete(context)
}
export function planDistantVillages(context: object): void {
  dailyPlanners.get(context)?.()
}

export type VillageHome = GridPosition & { id: string; spaceId: string }

export function villageHome(unit: UnitEntity): VillageHome | null {
  if (
    unit.owner?.isPlayed ||
    unit.controlMode === 'hero' ||
    unit.followingHero ||
    unit.type === 'Scout' ||
    (unit as UnitEntity & { factionExpedition?: unknown }).factionExpedition
  )
    return null
  return unit.villageHome ?? null
}

export function withinVillageActivity(unit: UnitEntity, target: GridPosition & { spaceId?: string | null }): boolean {
  const home = villageHome(unit)
  if (!home) return true
  const spaceId = target.spaceId || 'outside'
  // Interior tasks belong to their exterior building, not to room coordinates.
  const point =
    spaceId === home.spaceId
      ? target
      : unit.context?.map?.spaces?.get(spaceId)?.portals?.find(portal => portal.targetSpaceId === home.spaceId)
          ?.targetCell
  return Boolean(point && Math.hypot(point.i - home.i, point.j - home.j) <= VILLAGE_ACTIVITY_RADIUS)
}

const flushers = new WeakMap<object, () => void>()
export function registerVillageFlush(context: object, flush?: () => void): void {
  if (flush) flushers.set(context, flush)
  else flushers.delete(context)
}
export function flushVillageSimulation(context: object): void {
  flushers.get(context)?.()
}
