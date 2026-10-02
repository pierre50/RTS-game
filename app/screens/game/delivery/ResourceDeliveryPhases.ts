import { ACTION_TYPES } from '../../../constants'
import { getEntitySpaceId } from '../../../lib/mapSpaces'
import { isResourceDeliveryStalled } from '../../../lib/resources/resourceDeliveryRecovery'
import { unitHasDeliverableResourcesForBuilding } from '../../../lib/resources/resourceDelivery'
import { hasPriorityCombat } from '../../../lib/units/autonomy/villagerAutonomyAvailability'
import { getBuildingInteriorSpaceForUnit } from '../../../services/BuildingInteriorSpaceSystem'
import type { GameContextLike } from '../../../types/context'
import type { BuildingEntity, UnitEntity } from '../../../types/entities'
import {
  clearResourceDeliveryState,
  finishResourceDelivery,
  recoverStalledDelivery,
  stopResourceDelivery,
} from './ResourceDeliveryCompletion'

type ResourceDeliveryState = NonNullable<UnitEntity['resourceDeliveryState']>

function routeDeliveryToTarget(unit: UnitEntity, target: BuildingEntity): void {
  if (unit.dest !== target || unit.action !== ACTION_TYPES.delivery) {
    unit.sendToEvt?.(target, ACTION_TYPES.delivery, { forceRepath: true, preserveAutonomy: true })
  }
}

function isDeliveryOver(unit: UnitEntity, state: ResourceDeliveryState, building: BuildingEntity): boolean {
  if (unit.isDead || unit.isDestroyed || building.isDead || building.isDestroyed) return true
  return !state.pickup && state.phase !== 'leaving' && !unitHasDeliverableResourcesForBuilding(unit, building)
}

function updateEnteringPhase(
  unit: UnitEntity,
  state: ResourceDeliveryState,
  building: BuildingEntity,
  chest: BuildingEntity
): void {
  const space = getBuildingInteriorSpaceForUnit(unit)
  if (!space || space.id !== state.spaceId) {
    if (!unit.spacePortalState) routeDeliveryToTarget(unit, building)
    return
  }
  state.phase = 'toChest'

  unit.sendToEvt?.(chest, ACTION_TYPES.delivery, { forceRepath: true, preserveAutonomy: true })
}

function updateInteriorPhase(
  context: GameContextLike,
  unit: UnitEntity,
  state: ResourceDeliveryState,
  building: BuildingEntity
): void {
  const chest = state.chest
  if (!chest) {
    stopResourceDelivery(context, unit)
    return
  }
  if (state.phase === 'entering') updateEnteringPhase(unit, state, building, chest)
  else if (state.phase === 'toChest') routeDeliveryToTarget(unit, chest)
  else if (state.phase === 'leaving' && getEntitySpaceId(unit) !== state.spaceId) finishResourceDelivery(context, unit)
}

export function updateResourceDeliveryState(context: GameContextLike, unit: UnitEntity): void {
  const state = unit.resourceDeliveryState
  if (!state) return
  if (unit.followingHero || hasPriorityCombat(unit)) {
    clearResourceDeliveryState(unit)
    return
  }
  const building = state.building
  if (!building || isDeliveryOver(unit, state, building)) {
    finishResourceDelivery(context, unit)
    return
  }

  if (state.phase !== 'leaving' && isResourceDeliveryStalled(unit, context.scheduler.elapsedMs ?? performance.now())) {
    recoverStalledDelivery(context, unit)
    return
  }

  if (state.phase === 'toBuilding') {
    if (!unit.spacePortalState) routeDeliveryToTarget(unit, building)
    return
  }
  updateInteriorPhase(context, unit, state, building)
}
