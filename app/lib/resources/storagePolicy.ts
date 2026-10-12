import {
  DEPOT_CAPACITY_BY_LEVEL,
  STORAGE_PIT_CAPACITY_BY_LEVEL,
  DEFAULT_STORAGE_CAPACITY,
  FIXED_STORAGE_CAPACITY,
} from '../../config/storage'
import { getBuildingLevel } from '../buildings/buildingLevel'
import { communalStoreBuilding } from '../economy/constructionStores'
import type { BuildingEntity } from '../../types/entities'
const FOOD = new Set(['food', 'berry', 'wheat', 'meat'])

/** Shared by runtime deliveries, interior chests and detached village simulation. */
export function getStorageCapacity(
  building: string | { type: string; buildingLevel?: number; assetLevel?: unknown }
): number {
  const type = typeof building === 'string' ? building : building.type
  if (type === 'StoragePit' || type === 'Granary') {
    const level = typeof building === 'string' ? 0 : getBuildingLevel(building)
    const capacities = type === 'StoragePit' ? STORAGE_PIT_CAPACITY_BY_LEVEL : DEPOT_CAPACITY_BY_LEVEL
    return capacities[Math.min(capacities.length - 1, level)]!
  }
  return FIXED_STORAGE_CAPACITY[type] ?? DEFAULT_STORAGE_CAPACITY
}

/** Shared by physical deliveries and detached village simulation. */
export function storageAcceptsResource(type: string, resource: string): boolean {
  return type === 'TownCenter' || type === 'Chest' || (FOOD.has(resource) ? type === 'Granary' : type === 'StoragePit')
}

export function storageResourcePriority(type: string, resource: string): number {
  if (!storageAcceptsResource(type, resource)) return Infinity
  if (type === (FOOD.has(resource) ? 'Granary' : 'StoragePit')) return 0
  return type === 'TownCenter' ? 2 : 1
}

/** This restricts automatic deliveries only, never manual transfers or construction spending. */
export function allowsVillagerDeliveries(
  building: { type?: string },
  owner?: Parameters<typeof communalStoreBuilding>[1]
): boolean {
  const depot = communalStoreBuilding(building as BuildingEntity, owner ?? (building as BuildingEntity).owner)
  return Boolean(
    depot &&
      ['StoragePit', 'Granary'].includes(depot.type) &&
      depot.isBuilt !== false &&
      !depot.isDead &&
      !depot.isDestroyed
  )
}
