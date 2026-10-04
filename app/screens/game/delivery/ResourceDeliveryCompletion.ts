import { ACTION_TYPES } from '../../../constants'
import { readyConstructionSite } from '../../../lib/economy/collectiveTasks'
import { rejectDeliveryTarget } from '../../../lib/resources/resourceDeliveryRecovery'
import { findResourceDeliveryTarget } from '../../../lib/resources/resourceDelivery'
import { hasPriorityCombat } from '../../../lib/units/autonomy/villagerAutonomyAvailability'
import { notifyVillageWorkChanged } from '../../../lib/units/village/villageWorkEvents'
import { resumeVillagerJobIntent } from '../../../lib/units/autonomy/villagerTaskRecovery'
import { continueRestAfterDelivery, sendUnitToRest } from '../../../services/rest/UnitRestLifecycle'
import { canResumeVillagerReturnTaskBeforeRest } from '../../../services/rest/UnitRestRules'
import type { GameContextLike } from '../../../types/context'
import type { BuildingEntity, UnitEntity, UnitResourceDeliveryReturnTask } from '../../../types/entities'

export function clearResourceDeliveryState(unit: UnitEntity): void {
  const taskId = unit.resourceDeliveryState?.taskId
  if (taskId != null) unit.context?.scheduler?.remove(taskId)
  unit.resourceDeliveryState = null
}

function resumeMeatDelivery(unit: UnitEntity, returnTask: UnitResourceDeliveryReturnTask | null): boolean {
  if (returnTask?.action !== ACTION_TYPES.takemeat) return false
  const nextDepot = findResourceDeliveryTarget(unit)
  return Boolean(nextDepot && unit.sendToDelivery?.(nextDepot, returnTask))
}

function joinReadyConstruction(unit: UnitEntity): boolean {
  const site = unit.owner && !unit.followingHero && !hasPriorityCombat(unit) && readyConstructionSite(unit.owner, unit)
  if (!site) return false
  unit.collectiveTask = 'construction'
  unit.sendToBuilding?.(site as BuildingEntity)
  return true
}

function restAfterDelivery(unit: UnitEntity, returnTask: UnitResourceDeliveryReturnTask | null): boolean {
  if (unit.shelterState?.status === 'delivering' && continueRestAfterDelivery(unit)) return true
  return !canResumeVillagerReturnTaskBeforeRest(unit, returnTask) && sendUnitToRest(unit, 'sleep')
}

export function finishResourceDelivery(context: GameContextLike, unit: UnitEntity): void {
  const returnTask = unit.resourceDeliveryState?.returnTask ?? null

  clearResourceDeliveryState(unit)
  context.menu?.refreshInventory?.()
  if (unit.followingHero || hasPriorityCombat(unit)) return
  if (restAfterDelivery(unit, returnTask)) return
  if (resumeMeatDelivery(unit, returnTask) || joinReadyConstruction(unit)) return
  const resumed = resumeVillagerJobIntent(unit, returnTask)

  if (!resumed) unit.stop?.()
}

export function stopResourceDelivery(context: GameContextLike, unit: UnitEntity): void {
  clearResourceDeliveryState(unit)
  unit.stop?.()
  context.menu?.refreshInventory?.()
}

export function recoverStalledDelivery(context: GameContextLike, unit: UnitEntity): void {
  const state = unit.resourceDeliveryState
  if (!state?.building) return
  rejectDeliveryTarget(unit, state.building)
  const returnTask = state.returnTask ?? null
  clearResourceDeliveryState(unit)
  // Stop must not immediately resume the same autonomous order.
  unit.autonomousJob = null
  unit.stop?.()
  unit.work = null
  if (state.pickup) unit.collectiveTask ??= returnTask?.autonomousJob ?? 'food'
  if (!unit.collectiveTask) {
    const next = findResourceDeliveryTarget(unit)
    if (!next || unit.sendToDelivery?.(next, returnTask) !== true) resumeVillagerJobIntent(unit, returnTask)
  }
  notifyVillageWorkChanged(unit.owner)
  context.menu?.refreshInventory?.()
}
