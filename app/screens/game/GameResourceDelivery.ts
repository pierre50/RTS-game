import { readyConstructionSite } from '../../lib/economy/collectiveTasks'
import { isResourceDeliveryStalled, rejectDeliveryTarget } from '../../lib/resources/resourceDeliveryRecovery'
import { notifyVillageWorkChanged } from '../../lib/units/villageWorkEvents'
import { hasPriorityCombat } from '../../lib/units/autonomy/villagerAutonomyAvailability'
import { automaticDepositAmount } from '../../lib/resources/resourceDelivery'
import { withdrawDepotResources } from '../../lib/economy/depotPickup'
import { ACTION_TYPES, BUILDING_TYPES, SOUND_CUES } from '../../constants'
import { getBuildingInteriorBlueprintType } from '../../lib/buildings/interiors'
import { createInventoryContainer, moveInventoryResource } from '../../lib/inventory/inventoryContainers'
import { getEntitySpaceId, sameMapSpace } from '../../lib/mapSpaces'
import { syncPlayerResourceFieldsFromChests } from '../../lib/resources/playerResourceTotals'
import { playAudibleSoundCue } from '../../lib/audio/sound'
import { resumeVillagerJobIntent } from '../../lib/units/villagerTaskRecovery'

import {
  findResourceDeliveryTarget,
  buildingAcceptsInventoryResource,
  getBuildingStorageRemaining,
  unitHasDeliverableResourcesForBuilding,
} from '../../lib/resources/resourceDelivery'
import { canResumeVillagerReturnTaskBeforeRest } from '../../services/rest/UnitRestRules'
import {
  ensureBuildingInteriorSpace,
  getBuildingInteriorSpaceForUnit,
  routeUnitIntoBuildingInteriorSpace,
  routeUnitOutOfBuildingInteriorSpace,
} from '../../services/BuildingInteriorSpaceSystem'
import { continueRestAfterDelivery, sendUnitToRest } from '../../services/rest/UnitRestLifecycle'
import type { GameContextLike } from '../../types/context'
import type { ResourceAmount } from '../../types/common'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../../types/entities'

const RESOURCE_DELIVERY_CHECK_INTERVAL_MS = 250

type InteriorBlueprint = Parameters<typeof ensureBuildingInteriorSpace>[2]

export type ResourceDeliveryGame = {
  _gameContext(): GameContextLike
  _loadRequiredInteriorBlueprint(options?: {
    buildingSize?: number
    buildingType?: string
    interiorType?: string
    random?: () => number
  }): Promise<InteriorBlueprint>
}

function isBuildingEntity(value: UnitEntity['dest'] | RuntimeEntity | null | undefined): value is BuildingEntity {
  return Boolean(value && !('has' in value) && value.family === 'building')
}

function findInteriorStorageChest(spaceId: string, owner: BuildingEntity['owner']): BuildingEntity | null {
  const label = `${spaceId}:default:storage-chest`
  return (
    (owner?.buildings ?? []).find(
      building =>
        building.label === label && building.type === BUILDING_TYPES.chest && !building.isDead && !building.isDestroyed
    ) ?? null
  )
}

function clearResourceDeliveryState(unit: UnitEntity): void {
  const taskId = unit.resourceDeliveryState?.taskId
  if (taskId != null) unit.context?.scheduler?.remove(taskId)
  unit.resourceDeliveryState = null
}

function scheduleResourceDeliveryUpdate(context: GameContextLike, unit: UnitEntity): void {
  const state = unit.resourceDeliveryState
  if (!state || state.taskId != null) return
  state.taskId = context.scheduler.add(
    () => updateResourceDeliveryState(context, unit),
    RESOURCE_DELIVERY_CHECK_INTERVAL_MS,
    'resource.delivery'
  )
}

function depositUnitResourcesIntoChest(unit: UnitEntity, building: BuildingEntity, chest: BuildingEntity): boolean {
  if (!unitHasDeliverableResourcesForBuilding(unit, building) || !unitHasDeliverableResourcesForBuilding(unit, chest))
    return false
  const source = createInventoryContainer(unit, { id: unit.label ?? 'unit', labelKey: 'unit' })
  const destination = createInventoryContainer(chest, {
    id: chest.label ?? 'storage-chest',
    labelKey: 'storageChest',
    canAcceptResource: (resource, amount) => buildingAcceptsInventoryResource(building, resource, amount),
    maxAcceptableResourceAmount: () => getBuildingStorageRemaining(building),
  })

  let moved = 0
  for (const resource of Object.keys(unit.inventory?.resources ?? {}) as Array<keyof ResourceAmount>) {
    moved += moveInventoryResource(source, destination, resource, automaticDepositAmount(unit, resource))
  }
  if (moved > 0) {
    syncPlayerResourceFieldsFromChests(building.owner)
    playAudibleSoundCue(chest, SOUND_CUES.building.chestOpen, { profile: 'surface' })
  }
  if (unit.context?.controls?.heroUnit === unit) unit.context.menu?.refreshInventory?.()
  return moved > 0
}

function finishResourceDelivery(context: GameContextLike, unit: UnitEntity): void {
  const returnTask = unit.resourceDeliveryState?.returnTask ?? null

  clearResourceDeliveryState(unit)
  context.menu?.refreshInventory?.()
  if (unit.followingHero || hasPriorityCombat(unit)) return
  if (unit.shelterState?.status === 'delivering' && continueRestAfterDelivery(unit)) {
    return
  }
  if (!canResumeVillagerReturnTaskBeforeRest(unit, returnTask) && sendUnitToRest(unit, 'sleep')) {
    return
  }
  if (returnTask?.action === ACTION_TYPES.takemeat) {
    const nextDepot = findResourceDeliveryTarget(unit)
    if (nextDepot && unit.sendToDelivery?.(nextDepot, returnTask)) return
  }
  const site = unit.owner && !unit.followingHero && !hasPriorityCombat(unit) && readyConstructionSite(unit.owner, unit)
  if (site) {
    unit.collectiveTask = 'construction'
    unit.sendToBuilding?.(site as BuildingEntity)
    return
  }
  const resumed = resumeVillagerJobIntent(unit, returnTask)

  if (!resumed) unit.stop?.()
}

function stopResourceDelivery(context: GameContextLike, unit: UnitEntity): void {
  clearResourceDeliveryState(unit)
  unit.stop?.()
  context.menu?.refreshInventory?.()
}

function recoverStalledDelivery(context: GameContextLike, unit: UnitEntity): void {
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

function updateResourceDeliveryState(context: GameContextLike, unit: UnitEntity): void {
  const state = unit.resourceDeliveryState
  if (!state) return
  if (unit.followingHero || hasPriorityCombat(unit)) {
    clearResourceDeliveryState(unit)
    return
  }
  const building = state.building
  const chest = state.chest
  if (!building || unit.isDead || unit.isDestroyed || building.isDead || building.isDestroyed) {
    finishResourceDelivery(context, unit)
    return
  }
  if (!state.pickup && state.phase !== 'leaving' && !unitHasDeliverableResourcesForBuilding(unit, building)) {
    finishResourceDelivery(context, unit)
    return
  }

  if (state.phase !== 'leaving' && isResourceDeliveryStalled(unit, context.scheduler.elapsedMs ?? performance.now())) {
    recoverStalledDelivery(context, unit)
    return
  }

  if (state.phase === 'toBuilding') {
    if (!unit.spacePortalState && (unit.dest !== building || unit.action !== ACTION_TYPES.delivery)) {
      unit.sendToEvt?.(building, ACTION_TYPES.delivery, { forceRepath: true, preserveAutonomy: true })
    }
    return
  }

  if (!chest) {
    stopResourceDelivery(context, unit)
    return
  }

  if (state.phase === 'entering') {
    const space = getBuildingInteriorSpaceForUnit(unit)
    if ((!space || space.id !== state.spaceId) && !unit.spacePortalState) {
      if (unit.dest !== building || unit.action !== ACTION_TYPES.delivery) {
        unit.sendToEvt?.(building, ACTION_TYPES.delivery, { forceRepath: true, preserveAutonomy: true })
      }
    }
    if (!space || space.id !== state.spaceId) return
    state.phase = 'toChest'

    unit.sendToEvt?.(chest, ACTION_TYPES.delivery, { forceRepath: true, preserveAutonomy: true })
    return
  }

  if (state.phase === 'toChest') {
    if (unit.dest !== chest || unit.action !== ACTION_TYPES.delivery) {
      unit.sendToEvt?.(chest, ACTION_TYPES.delivery, { forceRepath: true, preserveAutonomy: true })
    }
    return
  }

  if (state.phase === 'leaving' && getEntitySpaceId(unit) !== state.spaceId) {
    finishResourceDelivery(context, unit)
  }
}

function updateResourceDeliveryUnits(context: GameContextLike): void {
  for (const player of context.players ?? []) {
    for (const unit of player.units ?? []) {
      if (unit.resourceDeliveryState) updateResourceDeliveryState(context, unit)
    }
  }
}

export class ResourceDeliverySystem {
  context: GameContextLike
  taskId: number | null

  constructor(context: GameContextLike) {
    this.context = context
    this.taskId = context.scheduler.add(
      () => updateResourceDeliveryUnits(context),
      RESOURCE_DELIVERY_CHECK_INTERVAL_MS,
      'resource.delivery'
    )
    updateResourceDeliveryUnits(context)
  }

  destroy(): void {
    if (this.taskId == null) return
    this.context.scheduler.remove(this.taskId)
    this.taskId = null
  }
}

export async function routeUnitResourceDelivery(
  game: ResourceDeliveryGame,
  unit: UnitEntity,
  building: BuildingEntity
): Promise<boolean> {
  const context = game._gameContext()
  if (!unit.resourceDeliveryState?.pickup && !unitHasDeliverableResourcesForBuilding(unit, building)) return false

  const pendingDelivery = unit.resourceDeliveryState
  const blueprint = await game._loadRequiredInteriorBlueprint({
    buildingSize: building.size,
    buildingType: getBuildingInteriorBlueprintType(building),
    random: () => context.map.random(),
  })
  if (
    unit.resourceDeliveryState !== pendingDelivery ||
    unit.isDead ||
    unit.isDestroyed ||
    building.isDead ||
    building.isDestroyed
  )
    return false
  const space = ensureBuildingInteriorSpace(context, building, blueprint)
  const chest = findInteriorStorageChest(space.id, building.owner)
  if (!chest) {
    stopResourceDelivery(context, unit)
    return false
  }

  const returnTask = unit.resourceDeliveryState?.returnTask ?? null
  const pickup = unit.resourceDeliveryState?.pickup
  clearResourceDeliveryState(unit)
  unit.resourceDeliveryState = {
    building,
    chest,
    phase: 'entering',
    pickup,
    returnTask,
    spaceId: space.id,
  }

  scheduleResourceDeliveryUpdate(context, unit)
  return routeUnitIntoBuildingInteriorSpace(context, unit, space)
}

export function handleResourceDeliveryAction(context: GameContextLike, unit: UnitEntity): boolean {
  if (unit.followingHero || hasPriorityCombat(unit)) return false
  const target = isBuildingEntity(unit.dest) ? unit.dest : null
  if (!target || unit.action !== ACTION_TYPES.delivery || unit.isDead || unit.isDestroyed) return false
  if (target.isDead || target.isDestroyed || !sameMapSpace(unit, target)) return false
  // Action callbacks can outlive the movement that scheduled them.
  if (unit.spacePortalState || !unit.isUnitAtDest?.(ACTION_TYPES.delivery, target)) {
    if (!unit.spacePortalState && !unit.path?.length) {
      unit.sendToEvt?.(target, ACTION_TYPES.delivery, { forceRepath: true, preserveAutonomy: true })
    }
    return false
  }

  const state = unit.resourceDeliveryState
  if (state?.phase === 'leaving') return false
  if (state?.phase === 'toChest' && state.chest === target && state.building) {
    if (state.pickup) {
      withdrawDepotResources(unit, target.inventory?.resources ?? {}, state.pickup)
      state.pickup = {}
      syncPlayerResourceFieldsFromChests(state.building.owner)
    } else depositUnitResourcesIntoChest(unit, state.building, target)
    state.phase = 'leaving'

    const space = getBuildingInteriorSpaceForUnit(unit)
    if (
      !routeUnitOutOfBuildingInteriorSpace(context, unit, space, {
        onTransferred: () => {
          finishResourceDelivery(context, unit)
        },
      })
    ) {
      finishResourceDelivery(context, unit)
    }
    return true
  }

  // A standalone chest has no walk-in interior (unlike TownCenter/Granary/StoragePit) —
  // deposit straight into it instead of routing through the building-interior system.
  if (target.type === BUILDING_TYPES.chest) {
    depositUnitResourcesIntoChest(unit, target, target)
    finishResourceDelivery(context, unit)
    return true
  }

  context.routeUnitResourceDelivery?.(unit, target)
  return true
}
