import { RESOURCE_STORAGE_NAMES, UNIT_TYPES } from '../../constants'
import { getClosestInstanceWithPath } from '../grid/queries'
import { isHeroControlled } from '../units/unitControl'
import { storageAcceptsResource } from './storagePolicy'
import type { ResourceAmount } from '../../types/common'
import type { BuildingEntity, UnitEntity } from '../../types/entities'

const UNIT_RESOURCE_DELIVERY_BATCH_SIZE = 10

type ResourceKey = keyof ResourceAmount

const RESOURCE_KEYS = RESOURCE_STORAGE_NAMES ?? ['wood', 'berry', 'meat', 'wheat', 'stone', 'gold', 'copper', 'iron']


export function getResourceKeyForLoadingType(loadingType: string | null | undefined): ResourceKey | null {
  if (!loadingType) return null
  return RESOURCE_KEYS.includes(loadingType as (typeof RESOURCE_KEYS)[number]) ? (loadingType as ResourceKey) : null
}

export function getUnitCarriedResourceAmount(unit: UnitEntity, resource: ResourceKey): number {
  return Math.max(0, Math.floor(unit.inventory?.resources?.[resource] ?? 0))
}

function getUnitCarriedResourceKeys(unit: UnitEntity): ResourceKey[] {
  return RESOURCE_KEYS.filter(resource => getUnitCarriedResourceAmount(unit, resource) > 0)
}

export function getUnitResourceCapacityRemaining(_unit: UnitEntity, loadingType: string): number {
  const resource = getResourceKeyForLoadingType(loadingType)
  if (!resource) return 0
  return Number.POSITIVE_INFINITY
}

export function buildingAcceptsInventoryResource(
  building: BuildingEntity | null | undefined,
  resource: ResourceKey
): boolean {
  if (!building || building.family !== 'building') return false
  return storageAcceptsResource(building.type, resource)
}

export function unitHasDeliverableResourcesForBuilding(unit: UnitEntity, building: BuildingEntity): boolean {
  return getUnitCarriedResourceKeys(unit).some(
    resource => getUnitCarriedResourceAmount(unit, resource) > 0 && buildingAcceptsInventoryResource(building, resource)
  )
}

export function unitHasDeliverableResources(unit: UnitEntity): boolean {
  return getUnitCarriedResourceKeys(unit).length > 0
}

function buildingAcceptsAllUnitResources(building: BuildingEntity, unit: UnitEntity): boolean {
  const resources = getUnitCarriedResourceKeys(unit)
  return resources.length > 0 && resources.every(resource => buildingAcceptsInventoryResource(building, resource))
}

export function unitShouldDeliverResource(
  unit: UnitEntity,
  loadingType: string,
  previousAmount: number | null = null
): boolean {
  if (unit.type !== UNIT_TYPES.villager || isHeroControlled(unit)) return false
  const resource = getResourceKeyForLoadingType(loadingType)
  if (!resource) return false
  const currentAmount = getUnitCarriedResourceAmount(unit, resource)
  if (previousAmount == null) return currentAmount >= UNIT_RESOURCE_DELIVERY_BATCH_SIZE
  const currentBatch = Math.floor(currentAmount / UNIT_RESOURCE_DELIVERY_BATCH_SIZE)
  const previousBatch =
    Math.floor(Math.max(0, Math.floor(previousAmount)) / UNIT_RESOURCE_DELIVERY_BATCH_SIZE)
  return currentBatch > previousBatch
}

export function findResourceDeliveryTarget(unit: UnitEntity): BuildingEntity | null {
  if (unit.type !== UNIT_TYPES.villager || isHeroControlled(unit)) return null
  const owner = unit.owner
  if (!owner) return null
  const candidates = (owner.buildings ?? []).filter(
    building =>
      building.owner === owner &&
      building.isBuilt &&
      !building.isDead &&
      !building.isDestroyed &&
      unitHasDeliverableResourcesForBuilding(unit, building)
  )
  if (!candidates.length) return null
  const fullPocketCandidates = candidates.filter(building => buildingAcceptsAllUnitResources(building, unit))
  const preferredCandidates = fullPocketCandidates.length ? fullPocketCandidates : candidates
  return (
    getClosestInstanceWithPath<BuildingEntity>(unit, preferredCandidates)?.instance ?? preferredCandidates[0] ?? null
  )
}
