import { BUILDING_TYPES, LOADING_TYPES, RESOURCE_STORAGE_NAMES, UNIT_TYPES } from '../../constants'
import { getClosestInstanceWithPath } from '../grid/queries'
import { isHeroControlled } from '../units/unitControl'
import type { ResourceAmount } from '../../types/common'
import type { BuildingEntity, UnitEntity } from '../../types/entities'

const UNIT_RESOURCE_CARRY_CAPACITY = 10

type ResourceKey = keyof ResourceAmount

const LOADING_TYPE_VALUES = LOADING_TYPES ?? {
  berry: 'berry',
  meat: 'meat',
  wheat: 'wheat',
}
const BUILDING_TYPE_VALUES = BUILDING_TYPES ?? {
  granary: 'Granary',
  storagePit: 'StoragePit',
  townCenter: 'TownCenter',
}
const RESOURCE_KEYS = RESOURCE_STORAGE_NAMES ?? ['wood', 'berry', 'meat', 'wheat', 'stone', 'gold', 'copper', 'iron']

const FOOD_LOADING_TYPES = new Set([LOADING_TYPE_VALUES.berry, LOADING_TYPE_VALUES.wheat, LOADING_TYPE_VALUES.meat])
const FOOD_DROPOFF_TYPES = new Set([BUILDING_TYPE_VALUES.townCenter, BUILDING_TYPE_VALUES.granary])
const MATERIAL_DROPOFF_TYPES = new Set([BUILDING_TYPE_VALUES.townCenter, BUILDING_TYPE_VALUES.storagePit])

export function getResourceKeyForLoadingType(loadingType: string | null | undefined): ResourceKey | null {
  if (!loadingType) return null
  return RESOURCE_KEYS.includes(loadingType as (typeof RESOURCE_KEYS)[number]) ? (loadingType as ResourceKey) : null
}

function getUnitCarriedResourceAmount(unit: UnitEntity, resource: ResourceKey): number {
  return Math.max(0, Math.floor(unit.inventory?.resources?.[resource] ?? 0))
}

function getUnitCarriedResourceKeys(unit: UnitEntity): ResourceKey[] {
  return RESOURCE_KEYS.filter(resource => getUnitCarriedResourceAmount(unit, resource) > 0)
}

export function getUnitResourceCapacityRemaining(unit: UnitEntity, loadingType: string): number {
  const resource = getResourceKeyForLoadingType(loadingType)
  if (!resource) return 0
  if (isHeroControlled(unit)) return Number.POSITIVE_INFINITY
  return Math.max(0, UNIT_RESOURCE_CARRY_CAPACITY - getUnitCarriedResourceAmount(unit, resource))
}

export function buildingAcceptsInventoryResource(
  building: BuildingEntity | null | undefined,
  resource: ResourceKey
): boolean {
  if (!building || building.family !== 'building') return false
  if (building.type === BUILDING_TYPE_VALUES.townCenter) return true
  if (FOOD_LOADING_TYPES.has(resource)) return FOOD_DROPOFF_TYPES.has(building.type)
  return MATERIAL_DROPOFF_TYPES.has(building.type)
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

export function unitShouldDeliverResource(unit: UnitEntity, loadingType: string): boolean {
  if (unit.type !== UNIT_TYPES.villager || isHeroControlled(unit)) return false
  const resource = getResourceKeyForLoadingType(loadingType)
  return Boolean(resource && getUnitCarriedResourceAmount(unit, resource) >= UNIT_RESOURCE_CARRY_CAPACITY)
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
