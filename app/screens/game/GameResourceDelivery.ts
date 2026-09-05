import { ACTION_TYPES, BUILDING_TYPES, SOUND_CUES } from '../../constants'
import { getBuildingInteriorBlueprintType } from '../../lib/buildings/interiors'
import { createInventoryContainer, moveInventoryResource } from '../../lib/inventory/inventoryContainers'
import { getEntitySpaceId } from '../../lib/mapSpaces'
import { syncPlayerResourceFieldsFromChests } from '../../lib/resources/playerResourceTotals'
import { playAudibleSoundCue } from '../../lib/audio/sound'
import { resumeVillagerJobIntent } from '../../lib/units/villagerTaskRecovery'
import { logGoldMinerFlow } from '../../lib/units/villagerJobDiagnostics'
import {
  buildingAcceptsInventoryResource,
  unitHasDeliverableResourcesForBuilding,
} from '../../lib/resources/resourceDelivery'
import {
  ensureBuildingInteriorSpace,
  getBuildingInteriorSpaceForUnit,
  routeUnitIntoBuildingInteriorSpace,
  routeUnitOutOfBuildingInteriorSpace,
} from '../../services/BuildingInteriorSpaceSystem'
import { continueRestAfterDelivery } from '../../services/rest/UnitRestLifecycle'
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
  const source = createInventoryContainer(unit, { id: unit.label ?? 'unit', labelKey: 'unit' })
  const destination = createInventoryContainer(chest, {
    id: chest.label ?? 'storage-chest',
    labelKey: 'storageChest',
    canAcceptResource: resource => buildingAcceptsInventoryResource(building, resource),
  })

  let moved = 0
  for (const resource of Object.keys(unit.inventory?.resources ?? {}) as Array<keyof ResourceAmount>) {
    moved += moveInventoryResource(source, destination, resource)
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
  logGoldMinerFlow(unit, 'delivery.finishing', {}, returnTask)
  clearResourceDeliveryState(unit)
  context.menu?.refreshInventory?.()
  if (unit.shelterState?.status === 'delivering' && continueRestAfterDelivery(unit)) {
    logGoldMinerFlow(unit, 'delivery.continued-to-shelter', {}, returnTask)
    return
  }
  const resumed = resumeVillagerJobIntent(unit, returnTask)
  logGoldMinerFlow(unit, resumed ? 'delivery.work-resumed' : 'delivery.work-stopped', {}, returnTask)
  if (!resumed) unit.stop?.()
}

function stopResourceDelivery(context: GameContextLike, unit: UnitEntity): void {
  logGoldMinerFlow(unit, 'delivery.aborted')
  clearResourceDeliveryState(unit)
  unit.stop?.()
  context.menu?.refreshInventory?.()
}

function updateResourceDeliveryState(context: GameContextLike, unit: UnitEntity): void {
  const state = unit.resourceDeliveryState
  if (!state) return
  const building = state.building
  const chest = state.chest
  if (!building || unit.isDead || unit.isDestroyed || building.isDead || building.isDestroyed) {
    finishResourceDelivery(context, unit)
    return
  }
  if (state.phase !== 'leaving' && !unitHasDeliverableResourcesForBuilding(unit, building)) {
    finishResourceDelivery(context, unit)
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
    logGoldMinerFlow(unit, 'delivery.entered-building')
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
  if (!unitHasDeliverableResourcesForBuilding(unit, building)) return false

  const blueprint = await game._loadRequiredInteriorBlueprint({
    buildingSize: building.size,
    buildingType: getBuildingInteriorBlueprintType(building),
    random: () => context.map.random(),
  })
  const space = ensureBuildingInteriorSpace(context, building, blueprint)
  const chest = findInteriorStorageChest(space.id, building.owner)
  if (!chest) {
    stopResourceDelivery(context, unit)
    return false
  }

  const returnTask = unit.resourceDeliveryState?.returnTask ?? null
  clearResourceDeliveryState(unit)
  unit.resourceDeliveryState = {
    building,
    chest,
    phase: 'entering',
    returnTask,
    spaceId: space.id,
  }
  logGoldMinerFlow(unit, 'delivery.interior-ready', { chest: chest.label, interior: space.id }, returnTask)
  scheduleResourceDeliveryUpdate(context, unit)
  return routeUnitIntoBuildingInteriorSpace(context, unit, space)
}

export function handleResourceDeliveryAction(context: GameContextLike, unit: UnitEntity): boolean {
  const target = isBuildingEntity(unit.dest) ? unit.dest : null
  if (!target) return false

  const state = unit.resourceDeliveryState
  if (state?.phase === 'toChest' && state.chest === target && state.building) {
    depositUnitResourcesIntoChest(unit, state.building, target)
    state.phase = 'leaving'
    logGoldMinerFlow(unit, 'delivery.deposited-requesting-exit')
    const space = getBuildingInteriorSpaceForUnit(unit)
    if (
      !routeUnitOutOfBuildingInteriorSpace(context, unit, space, {
        onTransferred: () => {
          logGoldMinerFlow(unit, 'delivery.exit-confirmed')
          finishResourceDelivery(context, unit)
        },
      })
    ) {
      finishResourceDelivery(context, unit)
    }
    return true
  }

  context.routeUnitResourceDelivery?.(unit, target)
  return true
}
