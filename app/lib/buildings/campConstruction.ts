import { isInteriorFurniture } from './interiorFurnitureCatalog'
import { BUILDING_TYPES } from '../../constants'

export function isCampBuilding(type: string | null | undefined): boolean {
  return type === BUILDING_TYPES.trap || (typeof type === 'string' && isInteriorFurniture(type))
}

/** Rooms and caves only take furniture; the trap and full buildings stay outside. */
export function isBuildingAllowedInSpace(type: string, space: { kind?: string } | null | undefined): boolean {
  return space?.kind !== 'interior' || isInteriorFurniture(type)
}

export const WHEAT_PLOT_SIZE = 4

/** Fields use one material-funded site per tile. */
export function isSowingPlacement(type: string): boolean {
  return type === BUILDING_TYPES.farm
}

/** Persist the chosen appearance in assetType so rebuilding sprites or loading saves never rerolls it. */
export function assignCampBrazierAppearance(
  building: { type: string; assetType?: string },
  random: () => number = Math.random
): void {
  if (building.type === BUILDING_TYPES.campBrazier && !building.assetType) {
    building.assetType = random() < 0.5 ? BUILDING_TYPES.campBrazier : BUILDING_TYPES.campTorchStand
  }
}
