import { RESOURCE_GATHER_SWINGS, RESOURCE_TYPES } from '../../constants'
import {
  getResourceKeyForLoadingType,
  getUnitResourceCapacityRemaining,
  unitShouldDeliverResource,
} from '../../lib/resources/resourceDelivery'
import { getGatherXpBonus } from '../../lib/units/unitExperience'
import { t } from '../../lib/lang'
import type { BuildingEntity, ResourceEntity, RuntimeEntity, UnitEntity } from '../../types/entities'

const DEPLETED_BERRYBUSH_HIT_POINTS = 4

export function isRuntimeEntity(value: UnitEntity['dest'] | null | undefined): value is RuntimeEntity {
  return Boolean(value && !('has' in value && 'corpses' in value))
}

export function isBuildingEntity(value: UnitEntity['dest'] | null | undefined): value is BuildingEntity {
  return isRuntimeEntity(value) && value.family === 'building'
}

export function isResourceEntity(value: UnitEntity['dest'] | null | undefined): value is ResourceEntity {
  return isRuntimeEntity(value) && value.family === 'resource'
}

function isDepletedBerrybush(value: RuntimeEntity | null | undefined): value is RuntimeEntity {
  return Boolean(RESOURCE_TYPES.berrybush && value?.type === RESOURCE_TYPES.berrybush && (value.quantity ?? 0) <= 0)
}

export function isChoppableBerrybush(value: RuntimeEntity | null | undefined): boolean {
  return isDepletedBerrybush(value) && (value.hitPoints ?? 0) > 0
}

export function showDepletedBerrybushMessage(unit: UnitEntity, target: RuntimeEntity | null | undefined): void {
  if (
    isDepletedBerrybush(target) &&
    unit.owner?.isPlayed &&
    target &&
    (unit.context?.controls?.instanceInCamera?.(target) ?? true)
  ) {
    unit.context?.menu?.showMessage(t('berrybushDepleted'), 'warning')
  }
}

export function markBerrybushDepleted(target: RuntimeEntity): void {
  if (!isDepletedBerrybush(target)) return
  target.totalHitPoints = Math.min(
    target.totalHitPoints ?? DEPLETED_BERRYBUSH_HIT_POINTS,
    DEPLETED_BERRYBUSH_HIT_POINTS
  )
  target.hitPoints = Math.min(target.hitPoints ?? DEPLETED_BERRYBUSH_HIT_POINTS, DEPLETED_BERRYBUSH_HIT_POINTS)
  target.updateTexture?.()
}

export function clampDepletedBerrybushHitPoints(target: RuntimeEntity): void {
  if (!isChoppableBerrybush(target)) return
  markBerrybushDepleted(target)
}

export function isFarmHarvestTarget(
  value: UnitEntity['dest'] | null | undefined
): value is BuildingEntity | ResourceEntity {
  return isResourceEntity(value) && value.type === RESOURCE_TYPES.wheat
}

export function getGatherAmount(unit: UnitEntity): number {
  return Math.max(1, Math.round(unit.gatherAmount?.[unit.work ?? ''] ?? 1)) + getGatherXpBonus(unit)
}

export function addGatheredResource(unit: UnitEntity, loadingType: string, amount: number): number {
  const resourceKey = getResourceKeyForLoadingType(loadingType)
  const gatheredAmount = Math.min(Math.max(0, Math.floor(amount)), getUnitResourceCapacityRemaining(unit, loadingType))
  if (!resourceKey || gatheredAmount <= 0) return 0
  unit.inventory = unit.inventory ?? {}
  unit.inventory.resources = unit.inventory.resources ?? {}
  unit.inventory.resources[resourceKey] = (unit.inventory.resources[resourceKey] ?? 0) + gatheredAmount
  if (unit.context?.controls?.heroUnit === unit) unit.context.menu?.refreshInventory?.()
  return gatheredAmount
}

export function sendVillagerToDeliveryIfFull(unit: UnitEntity, loadingType: string): boolean {
  if (!unitShouldDeliverResource(unit, loadingType)) return false
  if (unit.sendToDelivery?.() === true) return true
  if (unit.owner?.isPlayed) {
    unit.gatherProgressState = null
    unit.stop?.()
    return true
  }
  return false
}

function getResourceGatherSwings(loadingType: string, override?: number): number {
  return Math.max(1, override ?? RESOURCE_GATHER_SWINGS?.[loadingType as keyof typeof RESOURCE_GATHER_SWINGS] ?? 1)
}

function getGatherProgressState(
  unit: UnitEntity,
  target: RuntimeEntity,
  loadingType: string,
  gatherEvery: number
): NonNullable<UnitEntity['gatherProgressState']> {
  const current = unit.gatherProgressState
  if (
    current &&
    current.target === target &&
    current.action === unit.action &&
    current.loadingType === loadingType &&
    current.gatherEvery === gatherEvery
  ) {
    return current
  }
  const next = {
    action: unit.action,
    gatherEvery,
    loadingType,
    progress: 0,
    target,
  }
  unit.gatherProgressState = next
  return next
}

export function shouldReleaseGatheredResource(
  unit: UnitEntity,
  target: RuntimeEntity,
  loadingType: string,
  gatherEvery?: number
): boolean {
  const requiredSwings = getResourceGatherSwings(loadingType, gatherEvery)
  const gatherState = getGatherProgressState(unit, target, loadingType, requiredSwings)
  gatherState.progress++
  if (gatherState.progress < requiredSwings) return false
  gatherState.progress = 0
  return true
}
