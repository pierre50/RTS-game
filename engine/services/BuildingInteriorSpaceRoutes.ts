import { createReservedPassageCellLookup } from '../../app/lib/buildings/passageCells'
import { getEntitySpaceId, sameMapSpace } from '../../app/lib/mapSpaces'
import { applyBuildingInteriorIdleFacing } from '../../app/services/buildingInterior/InteriorIdleFacing'
import type { SpacePortalRouteOptions } from '../../app/services/SpacePortalSystem'
import { routeUnitThroughSpacePortal, transferUnitThroughSpacePortal } from '../../app/services/SpacePortalSystem'
import type { GameContextLike } from '../../app/types/context'
import type { UnitEntity } from '../../app/types/entities'
import type { RuntimeCell } from '../../app/types/map'
import { findFreeCellNear } from './BuildingInteriorSpaceLayout'
import { getBuildingInteriorSpaceForUnit } from './BuildingInteriorSpaceLookup'
import type { BuildingInteriorRuntimeSpace } from './BuildingInteriorSpaceTypes'
import { deactivateBuildingInteriorSpace } from './BuildingInteriorSpaceVisibility'

const INTERIOR_IDLE_FACING_CHECK_MS = 180

const INTERIOR_IDLE_FACING_TIMEOUT_MS = 5000

function scheduleBuildingInteriorIdleFacing(
  context: GameContextLike,
  unit: UnitEntity,
  space: BuildingInteriorRuntimeSpace,
  targetCell: RuntimeCell
): void {
  const scheduler = context.scheduler
  if (!scheduler?.add || !scheduler.remove) return
  const startedAtMs = scheduler.elapsedMs ?? 0
  const taskId = scheduler.add(
    () => {
      const timedOut = (scheduler.elapsedMs ?? 0) - startedAtMs >= INTERIOR_IDLE_FACING_TIMEOUT_MS
      const arrived = unit.i === targetCell.i && unit.j === targetCell.j && getEntitySpaceId(unit) === space.id
      const stillHeadingThere =
        unit.dest === targetCell || (unit.dest?.i === targetCell.i && unit.dest?.j === targetCell.j)
      if (arrived && (!unit.path?.length || !stillHeadingThere)) {
        scheduler.remove(taskId)
        applyBuildingInteriorIdleFacing(unit, space, targetCell)
        return
      }
      if (timedOut || unit.isDead || unit.isDestroyed || getEntitySpaceId(unit) !== space.id || !stillHeadingThere) {
        scheduler.remove(taskId)
      }
    },
    INTERIOR_IDLE_FACING_CHECK_MS,
    'buildingInterior.idleFacing'
  )
}

function moveUnitIntoBuildingInteriorSpace(
  context: GameContextLike,
  unit: UnitEntity,
  space: BuildingInteriorRuntimeSpace
): boolean {
  return transferUnitThroughSpacePortal(context, unit, space.entryPortal)
}

export function routeUnitIntoBuildingInteriorSpace(
  context: GameContextLike,
  unit: UnitEntity,
  space: BuildingInteriorRuntimeSpace
): boolean {
  return routeUnitThroughSpacePortal(context, unit, space.entryPortal)
}

export function routeUnitIntoBuildingInteriorSpaceAndMoveBack(
  context: GameContextLike,
  unit: UnitEntity,
  space: BuildingInteriorRuntimeSpace
): boolean {
  const passageLookup = createReservedPassageCellLookup(context)
  return routeUnitThroughSpacePortal(context, unit, space.entryPortal, {
    onTransferred: () => {
      const preferredCell = space.idleCells[0] ?? space.entryCell
      const targetCell = findFreeCellNear(space, preferredCell, unit, passageLookup)
      if (targetCell && (unit.i !== targetCell.i || unit.j !== targetCell.j)) {
        unit.sendToEvt?.(targetCell, null, { forceRepath: true, preserveAutonomy: true })
        scheduleBuildingInteriorIdleFacing(context, unit, space, targetCell)
      } else {
        applyBuildingInteriorIdleFacing(unit, space, targetCell)
      }
    },
  })
}

function moveUnitOutOfBuildingInteriorSpace(
  context: GameContextLike,
  unit: UnitEntity,
  space: BuildingInteriorRuntimeSpace
): boolean {
  return transferUnitThroughSpacePortal(context, unit, space.exitPortal)
}

export function routeUnitOutOfBuildingInteriorSpace(
  context: GameContextLike,
  unit: UnitEntity,
  space: BuildingInteriorRuntimeSpace | null = getBuildingInteriorSpaceForUnit(unit),
  options: SpacePortalRouteOptions = {}
): boolean {
  if (!space || unit.isDead || unit.isDestroyed) return false
  return routeUnitThroughSpacePortal(context, unit, space.exitPortal, options)
}

function getUnitsFollowingInSameSpace(hero: UnitEntity): UnitEntity[] {
  return (hero.owner?.units ?? []).filter(
    unit => unit !== hero && unit.followingHero && !unit.isDead && !unit.isDestroyed && sameMapSpace(hero, unit)
  )
}

export function moveHeroPartyIntoBuildingInteriorSpace(
  context: GameContextLike,
  hero: UnitEntity,
  space: BuildingInteriorRuntimeSpace
): boolean {
  const followers = getUnitsFollowingInSameSpace(hero)
  if (!moveUnitIntoBuildingInteriorSpace(context, hero, space)) return false
  for (const follower of followers) routeUnitIntoBuildingInteriorSpace(context, follower, space)
  return true
}

export function moveHeroPartyOutOfBuildingInteriorSpace(
  context: GameContextLike,
  hero: UnitEntity,
  space: BuildingInteriorRuntimeSpace
): boolean {
  const followers = getUnitsFollowingInSameSpace(hero)
  if (!moveUnitOutOfBuildingInteriorSpace(context, hero, space)) return false
  for (const follower of followers) routeUnitOutOfBuildingInteriorSpace(context, follower, space)
  deactivateBuildingInteriorSpace(context, space)
  context.controls?.updateVisibleCells?.()
  return true
}
