import { villageHome, withinVillageActivity } from './village/villageActivity'
import { getEntitySpaceId } from '../mapSpaces'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'
import type { RuntimeMapSpace } from '../../types/map'

const CAMP_CHASE_RANGE = 20
import { CAMP_TETHER_RANGE } from '../../config/campActivity'
export { CAMP_TETHER_RANGE }
export const CAMP_RETURN_RANGE = 4

export function campAnchor(unit: UnitEntity) {
  if (unit.owner?.isPlayed) return null
  return unit.campPatrolAnchor ?? unit.banditCampAnchor ?? villageHome(unit)
}

export function campSpaceAllowed(unit: UnitEntity, spaceId: string): boolean {
  if (!campAnchor(unit)) return true
  if (spaceId === (unit.campBehavior?.homeSpaceId ?? 'outside')) return true
  if (villageHome(unit)) return withinVillageActivity(unit, { i: 0, j: 0, spaceId })
  const space = unit.context?.map?.spaces?.get(spaceId) as
    | (RuntimeMapSpace & { building?: { cave?: { id: string } } })
    | undefined
  return Boolean(unit.campBehavior?.caveId && space?.building?.cave?.id === unit.campBehavior.caveId)
}

export function campDistance(unit: UnitEntity): number {
  const anchor = campAnchor(unit)
  if (!anchor) return 0
  const home = unit.campBehavior?.homeSpaceId ?? 'outside'
  const spaceId = getEntitySpaceId(unit)
  const point =
    spaceId === home
      ? unit
      : unit.context?.map?.spaces?.get(spaceId)?.portals?.find(portal => portal.targetSpaceId === home)?.targetCell
  return point ? Math.hypot(point.i - anchor.i, point.j - anchor.j) : Infinity
}

/** Shared by camp guards, retaliation, movement orders and portal pursuit. */
export function canCampPursue(unit: UnitEntity, target: RuntimeEntity): boolean {
  if (!campAnchor(unit)) return true
  if (unit.campBehavior?.phase === 'return' || target.isDead || target.isDestroyed) return false
  if (!campSpaceAllowed(unit, getEntitySpaceId(target))) return false
  if (campDistance(unit) > (unit.campBehavior?.tetherRange ?? CAMP_TETHER_RANGE)) return false
  return (
    getEntitySpaceId(unit) !== getEntitySpaceId(target) ||
    Math.hypot(unit.i - target.i, unit.j - target.j) <= (unit.campBehavior?.chaseRange ?? CAMP_CHASE_RANGE)
  )
}
