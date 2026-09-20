import { BUILDING_TYPES, RESOURCE_STORAGE_NAMES, UNIT_TYPES } from '../../constants'
import { getClosestInstanceWithPath } from '../grid/queries'
import { isHeroControlled } from '../units/unitControl'
import { getUnitEquipmentBagCount } from '../equipment/heroInventory'
import { t } from '../lang'
import { getEntitySpaceId, isOutsideSpaceId, sameMapSpace } from '../mapSpaces'
import { getStorageCapacity, storageAcceptsResource, allowsVillagerDeliveries } from './storagePolicy'
import type { ResourceAmount } from '../../types/common'
import type { BuildingEntity, UnitEntity } from '../../types/entities'

type ResourceKey = keyof ResourceAmount

const RESOURCE_KEYS = RESOURCE_STORAGE_NAMES ?? ['wood', 'berry', 'meat', 'wheat', 'stone', 'gold', 'copper', 'iron']

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

// Every unit's bag is a single pool shared between carried resources and loose (unequipped)
// items — one slot each. A hero just carries a bigger bag than a villager.
const VILLAGER_RESOURCE_CARRY_CAPACITY = 30
const HERO_BAG_CAPACITY = 50

function getUnitResourceCarryCapacity(unit: UnitEntity): number {
  return isHeroControlled(unit) ? HERO_BAG_CAPACITY : VILLAGER_RESOURCE_CARRY_CAPACITY
}

function getUnitCarriedResourceTotal(unit: UnitEntity): number {
  return RESOURCE_KEYS.reduce((sum, resource) => sum + getUnitCarriedResourceAmount(unit, resource), 0)
}

/** Combined bag load: carried resources plus any loose bag items (not equipped gear). */
function getUnitBagLoad(unit: UnitEntity): number {
  return getUnitCarriedResourceTotal(unit) + getUnitEquipmentBagCount(unit)
}

/** Total remaining carry room (any mix of resources and bag items). */
export function getUnitResourceCarryRemaining(unit: UnitEntity): number {
  return Math.max(0, getUnitResourceCarryCapacity(unit) - getUnitBagLoad(unit))
}

export function isUnitResourceCarryFull(unit: UnitEntity): boolean {
  return getUnitResourceCarryRemaining(unit) <= 0
}

/**
 * "Your bag (23/50)" for the viewer's own bag, or "{name}'s bag (23/50)" when `ownerName` is
 * given for another unit's bag (e.g. a villager being talked to).
 */
export function getUnitBagTitle(unit: UnitEntity, ownerName?: string): string {
  const owner = ownerName ? t('inventoryNpcBag', { name: ownerName }) : t('inventoryYourBag')
  return `${owner} (${getUnitBagLoad(unit)}/${getUnitResourceCarryCapacity(unit)})`
}

export function getUnitResourceCapacityRemaining(unit: UnitEntity, loadingType: string): number {
  const resource = getResourceKeyForLoadingType(loadingType)
  if (!resource) return 0
  return getUnitResourceCarryRemaining(unit)
}

function sumResourceAmount(resources: ResourceAmount | null | undefined): number {
  return Object.values(resources ?? {}).reduce((sum: number, amount) => sum + Math.max(0, Math.floor(amount ?? 0)), 0)
}

function buildingOwnerKey(building: BuildingEntity): string {
  return building.owner?.label || building.owner?.factionId || building.owner?.name || 'owner'
}

function buildingLocalKey(building: BuildingEntity): string {
  return building.label || `${building.i},${building.j},${building.type}`
}

function getStoragePortalId(building: BuildingEntity): string {
  return building.interiorPortalId || `${buildingOwnerKey(building)}:${buildingLocalKey(building)}`
}

// Granary/StoragePit/TownCenter migrate their stock into a synthetic interior chest the first
// time a villager delivers inside; before that it still sits on the building's own inventory.
function getInteriorStorageChest(building: BuildingEntity): BuildingEntity | undefined {
  const label = `interior:${getStoragePortalId(building)}:default:storage-chest`
  return building.owner?.buildings?.find(
    other => other.label === label && other.type === BUILDING_TYPES.chest && !other.isDead && !other.isDestroyed
  )
}

function getInteriorChestParentBuilding(chest: BuildingEntity): BuildingEntity | undefined {
  if (chest.type !== BUILDING_TYPES.chest) return undefined
  const portalId = INTERIOR_STORAGE_CHEST_LABEL.exec(chest.label ?? '')?.[1]
  return chest.owner?.buildings?.find(candidate => {
    if (candidate === chest || candidate.type === BUILDING_TYPES.chest) return false
    if (portalId && getStoragePortalId(candidate) === portalId) return true
    return Boolean(
      (candidate as BuildingEntity & { interiorBuildings?: BuildingEntity[] }).interiorBuildings?.includes(chest)
    )
  })
}

export function isStandaloneStorageChest(building: BuildingEntity): boolean {
  return (
    building.type === BUILDING_TYPES.chest &&
    !getInteriorChestParentBuilding(building) &&
    isOutsideSpaceId(building.spaceId)
  )
}

function getBuildingStorageTotal(building: BuildingEntity): number {
  const own = sumResourceAmount(building.inventory?.resources)
  if (building.type === BUILDING_TYPES.chest) return own
  const interiorChest = getInteriorStorageChest(building)
  return own + (interiorChest ? sumResourceAmount(interiorChest.inventory?.resources) : 0)
}

const INTERIOR_STORAGE_CHEST_LABEL = /^interior:(.+):default:storage-chest$/

// An interior chest exposes its parent building's capacity, not the camp chest capacity.
function resolveStorageOwnerType(building: BuildingEntity): string {
  if (building.type !== BUILDING_TYPES.chest) return building.type
  const parent = getInteriorChestParentBuilding(building)
  return parent?.type ?? building.type
}

export function getBuildingStorageCapacity(building: BuildingEntity): number {
  return getStorageCapacity(resolveStorageOwnerType(building))
}

export function getBuildingStorageRemaining(building: BuildingEntity): number {
  return Math.max(0, getBuildingStorageCapacity(building) - getBuildingStorageTotal(building))
}

/**
 * `amount` is the quantity that would actually be deposited — checking only "not yet full" let a
 * delivery blow straight past capacity when the carried amount exceeded the remaining room.
 */
export function buildingAcceptsInventoryResource(
  building: BuildingEntity | null | undefined,
  resource: ResourceKey,
  amount = 1
): boolean {
  if (!building || building.family !== 'building') return false
  if (!storageAcceptsResource(resolveStorageOwnerType(building), resource)) return false
  return getBuildingStorageTotal(building) + Math.max(1, Math.floor(amount)) <= getBuildingStorageCapacity(building)
}

// Eligibility only needs *some* room — an actual delivery clamps to whatever fits
// (see maxAcceptableResourceAmount in depositUnitResourcesIntoChest), so a building doesn't
// need to fit the unit's entire carried amount to be worth walking to.
export function unitHasDeliverableResourcesForBuilding(unit: UnitEntity, building: BuildingEntity): boolean {
  if (!allowsVillagerDeliveries(building)) return false
  return getUnitCarriedResourceKeys(unit).some(
    resource => getUnitCarriedResourceAmount(unit, resource) > 0 && buildingAcceptsInventoryResource(building, resource)
  )
}

export function unitHasDeliverableResources(unit: UnitEntity): boolean {
  return getUnitCarriedResourceKeys(unit).length > 0
}

function buildingAcceptsAllUnitResources(building: BuildingEntity, unit: UnitEntity): boolean {
  const resources = getUnitCarriedResourceKeys(unit)
  return (
    resources.length > 0 &&
    resources.every(resource =>
      buildingAcceptsInventoryResource(building, resource, getUnitCarriedResourceAmount(unit, resource))
    )
  )
}

export function unitShouldDeliverResource(
  unit: UnitEntity,
  loadingType: string
): boolean {
  if (unit.type !== UNIT_TYPES.villager || isHeroControlled(unit)) return false
  const resource = getResourceKeyForLoadingType(loadingType)
  if (!resource) return false
  return isUnitResourceCarryFull(unit) && unitHasDeliverableResources(unit)
}

export function isUnitBlockedByFullStorage(unit: UnitEntity): boolean {
  return unit.type === UNIT_TYPES.villager && isUnitResourceCarryFull(unit) &&
    unitHasDeliverableResources(unit) && !findResourceDeliveryTarget(unit)
}

export function findResourceDeliveryTarget(unit: UnitEntity): BuildingEntity | null {
  if (unit.type !== UNIT_TYPES.villager || isHeroControlled(unit)) return null
  const owner = unit.owner
  if (!owner) return null
  const candidates = (owner.buildings ?? []).flatMap(building => {
    if (building.owner !== owner) return []
    if (!building.isBuilt || building.isDead || building.isDestroyed) return []
    if (!unitHasDeliverableResourcesForBuilding(unit, building)) return []
    const parent = getInteriorChestParentBuilding(building)
    if (parent && sameMapSpace(unit, parent)) return [parent]
    if (building.type === BUILDING_TYPES.chest && !isOutsideSpaceId(getEntitySpaceId(building))) return []
    return [building]
  })
  if (!candidates.length) return null
  const fullPocketCandidates = candidates.filter(building => buildingAcceptsAllUnitResources(building, unit))
  const preferredCandidates = fullPocketCandidates.length ? fullPocketCandidates : candidates
  return (
    getClosestInstanceWithPath<BuildingEntity>(unit, preferredCandidates)?.instance ?? preferredCandidates[0] ?? null
  )
}
