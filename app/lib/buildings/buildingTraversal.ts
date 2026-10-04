import { BUILDING_TYPES } from '../../constants/entities'
import { isInteriorFloorFurniture } from './furniture/interiorFurnitureCatalog'

/** Shared by grid occupancy, hero collisions and passage checks.
 * Walking height is handled separately by furnitureSurface.
 */
export function isBuildingTraversable(type: string): boolean {
  return type === BUILDING_TYPES.farm || type === BUILDING_TYPES.campBedroll || isInteriorFloorFurniture(type)
}
