import { communalStoreBuilding } from '../economy/constructionStores'
import type { BuildingEntity } from '../../types/entities'
const FOOD = new Set(['food', 'berry', 'wheat', 'meat'])

// Chests are personal storage; communal depots supply village work.
const STORAGE_CAPACITY: Record<string, number> = {
  Chest: 100,
  TownCenter: 300,
  StoragePit: 300,
  Granary: 300,
}

/** Shared by runtime deliveries, interior chests and detached village simulation. */
export function getStorageCapacity(type: string): number {
  return STORAGE_CAPACITY[type] ?? 300
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
