import { VILLAGE_ACTIVITY_RADIUS, VILLAGE_PATH_MARGIN } from '../../../config/villageActivity'
import { sameMapSpace } from '../../mapSpaces'
import { villageHome, withinVillageActivity } from './villageActivity'
import type { RuntimeEntity, UnitEntity } from '../../../types/entities'
import type { RuntimeCell } from '../../../types/map'

const RESOURCE_JOBS = new Set(['wood', 'food', 'stone', 'gold', 'copper', 'iron'])
const GATHER_ACTIONS = new Set(['chopwood', 'forageberry', 'farm', 'minestone', 'minegold', 'minecopper', 'mineiron'])

/** Supply trips belong to settled workers, never to guards, chiefs or expeditions. */
export function isVillageResourceWorker(unit: UnitEntity): boolean {
  return Boolean(
    unit.type === 'Villager' && villageHome(unit) && !unit.isChief && !unit.campPatrolAnchor && !unit.banditCampAnchor
  )
}

export function canSeekVillageResource(unit: UnitEntity, target: RuntimeEntity): boolean {
  return isVillageResourceWorker(unit) && target.family === 'resource' && sameMapSpace(unit, target)
}

/** This exception authorizes a specific harvesting destination, not unrestricted wandering. */
export function canMoveForVillageSupply(
  unit: UnitEntity,
  target: RuntimeEntity | RuntimeCell,
  action: string | null | undefined
): boolean {
  if (!isVillageResourceWorker(unit) || !sameMapSpace(unit, target)) return false
  const resource = 'has' in target ? target.has : target
  if (
    !resource ||
    resource.family !== 'resource' ||
    resource.isDead ||
    resource.isDestroyed ||
    (resource.quantity ?? 0) <= 0
  )
    return false
  return action ? GATHER_ACTIONS.has(action) : RESOURCE_JOBS.has(unit.autonomousJob ?? '')
}

/** A return to a local depot/project is part of the same trip even outside the home radius. */
export function isVillageSupplyTrip(unit: UnitEntity): boolean {
  if (!isVillageResourceWorker(unit) || unit.combatMode || unit.action === 'attack' || unit.action === 'flee')
    return false
  const target = unit.blockedGatherApproach?.target ?? unit.dest
  if (!target) return false
  if (canMoveForVillageSupply(unit, target, unit.blockedGatherApproach?.action ?? unit.action)) return true
  return Boolean(
    withinVillageActivity(unit, target) &&
      (unit.action === 'delivery' ||
        unit.action === 'build' ||
        unit.resourceDeliveryState ||
        (!unit.action && (RESOURCE_JOBS.has(unit.autonomousJob ?? '') || unit.autonomousJob === 'construction')))
  )
}

/** A bounded catch-up cannot discover the next distant deposit or follow an old exploration order. */
export function villageWorkNeedsLiveSearch(unit: UnitEntity): boolean {
  const home = villageHome(unit)
  return (
    unit.type === 'Villager' &&
    Boolean(
      (home &&
        unit.path?.some(
          cell => Math.hypot(cell.i - home.i, cell.j - home.j) > VILLAGE_ACTIVITY_RADIUS + VILLAGE_PATH_MARGIN
        )) ||
        unit.exploringForAutonomy ||
        unit.autonomyBlockedJob ||
        (RESOURCE_JOBS.has(unit.autonomousJob ?? '') && !unit.dest && !unit.offlineWork)
    )
  )
}
