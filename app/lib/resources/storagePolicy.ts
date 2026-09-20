const FOOD = new Set(['food', 'berry', 'wheat', 'meat'])

// A camp chest funds the first buildings; dedicated depots provide economical bulk storage.
const STORAGE_CAPACITY: Record<string, number> = {
  Chest: 300,
  TownCenter: 600,
  StoragePit: 3000,
  Granary: 2000,
}

/** Shared by runtime deliveries, interior chests and detached village simulation. */
export function getStorageCapacity(type: string): number {
  return STORAGE_CAPACITY[type] ?? 1000
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
export function allowsVillagerDeliveries(building: { villagerDeliveriesBlocked?: boolean }): boolean {
  return building.villagerDeliveriesBlocked !== true
}
