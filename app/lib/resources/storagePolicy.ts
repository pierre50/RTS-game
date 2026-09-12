const FOOD = new Set(['food', 'berry', 'wheat', 'meat'])

/** Shared by physical deliveries and detached village simulation. */
export function storageAcceptsResource(type: string, resource: string): boolean {
  return type === 'TownCenter' || type === 'Chest' || (FOOD.has(resource) ? type === 'Granary' : type === 'StoragePit')
}

export function storageResourcePriority(type: string, resource: string): number {
  if (!storageAcceptsResource(type, resource)) return Infinity
  if (type === (FOOD.has(resource) ? 'Granary' : 'StoragePit')) return 0
  return type === 'TownCenter' ? 2 : 1
}
