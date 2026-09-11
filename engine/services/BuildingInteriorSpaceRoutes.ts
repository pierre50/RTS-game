import { hasInteriorCombatCapacity } from '../../app/lib/buildings/interiorCombatCapacity'
import { ACTION_TYPES } from '../../app/constants'
import { canUnitEnterBuildingInterior } from '../../app/lib/buildings/interiorAccess'
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

function getBuildingPursuers(
  context: GameContextLike,
  hero: UnitEntity,
  space: BuildingInteriorRuntimeSpace,
  entering: boolean
): UnitEntity[] {
  return (context.players ?? [])
    .flatMap(player => player.units ?? [])
    .filter(
      unit =>
        unit !== hero &&
        unit.controlMode !== 'hero' &&
        !unit.isDead &&
        !unit.isDestroyed &&
        sameMapSpace(hero, unit) &&
        Boolean(unit.owner?.isEnemy?.(hero.owner) || hero.owner?.isEnemy?.(unit.owner)) &&
        (((unit.dest === hero || unit.realDest === hero) && unit.action === ACTION_TYPES.attack) ||
          unit.spacePortalState?.combatTarget === hero) &&
        (!entering || canUnitEnterBuildingInterior(unit, space.building))
    )
}

function routeBuildingPursuers(
  context: GameContextLike,
  hero: UnitEntity,
  space: BuildingInteriorRuntimeSpace,
  pursuers: UnitEntity[],
  entering: boolean
): void {
  for (const unit of pursuers) {
    routeUnitThroughSpacePortal(context, unit, entering ? space.entryPortal : space.exitPortal, {
      combatTarget: hero,
      shouldContinue: () =>
        !hero.isDead &&
        !hero.isDestroyed &&
        !space.building.isDead &&
        !space.building.isDestroyed &&
        Boolean(unit.owner?.isEnemy?.(hero.owner) || hero.owner?.isEnemy?.(unit.owner)) &&
        getEntitySpaceId(hero) === (entering ? space.id : space.exitPortal.targetSpaceId) &&
        (!entering || canUnitEnterBuildingInterior(unit, space.building)),
      canTransfer: entering ? () => hasInteriorCombatCapacity(context, space, unit) : undefined,
      onTransferred: () => {
        if (!hero.isDead && !hero.isDestroyed && sameMapSpace(unit, hero)) {
          unit.sendToEvt?.(hero, ACTION_TYPES.attack, { forceRepath: true })
        }
      },
    })
  }
}

export function moveHeroPartyIntoBuildingInteriorSpace(
  context: GameContextLike,
  hero: UnitEntity,
  space: BuildingInteriorRuntimeSpace
): boolean {
  const followers = getUnitsFollowingInSameSpace(hero)
  const pursuers = getBuildingPursuers(context, hero, space, true)
  if (!moveUnitIntoBuildingInteriorSpace(context, hero, space)) return false
  for (const follower of followers) routeUnitIntoBuildingInteriorSpace(context, follower, space)
  routeBuildingPursuers(context, hero, space, pursuers, true)
  return true
}

export function moveHeroPartyOutOfBuildingInteriorSpace(
  context: GameContextLike,
  hero: UnitEntity,
  space: BuildingInteriorRuntimeSpace
): boolean {
  const followers = getUnitsFollowingInSameSpace(hero)
  const pursuers = getBuildingPursuers(context, hero, space, false)
  if (!moveUnitOutOfBuildingInteriorSpace(context, hero, space)) return false
  for (const follower of followers) routeUnitOutOfBuildingInteriorSpace(context, follower, space)
  routeBuildingPursuers(context, hero, space, pursuers, false)
  deactivateBuildingInteriorSpace(context, space)
  context.controls?.updateVisibleCells?.()
  return true
}
