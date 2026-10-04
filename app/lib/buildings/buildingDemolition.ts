import { BUILDING_TYPES } from '../../constants/entities'
import type { BuildingEntity } from '../../types/entities'
import { isInteriorFurniture } from './furniture/interiorFurnitureCatalog'

export function getFurnitureContainer(building: BuildingEntity): BuildingEntity | null {
  const space = building.spaceId ? building.context?.map?.spaces?.get(building.spaceId) : null
  return space && 'building' in space ? (space.building as BuildingEntity) : null
}

export function canHeroDemolishBuilding(building: BuildingEntity): boolean {
  const heroOwner = building.context?.controls?.heroUnit?.owner
  if (
    !heroOwner ||
    !building.owner ||
    building.isDead ||
    building.isDestroyed ||
    (building.type === BUILDING_TYPES.trap && building.isBuilt)
  )
    return false
  if (isInteriorFurniture(building.type)) {
    if (building.owner !== heroOwner) return false
    if (building.type === BUILDING_TYPES.chest && building.label?.endsWith(':default:storage-chest')) {
      const container = getFurnitureContainer(building)
      // Retain protection if the room cannot be resolved, including during restoration.
      if (!container || container.type === BUILDING_TYPES.storagePit || container.type === BUILDING_TYPES.granary)
        return false
    }
    return true
  }
  return (
    (!building.isBuilt || !building.indestructible) &&
    (building.owner === heroOwner || (typeof heroOwner.team === 'number' && heroOwner.team === building.owner.team))
  )
}
