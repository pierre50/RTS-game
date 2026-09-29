import { BUILDING_TYPES } from '../../constants'

export function isCampBuilding(type: string | null | undefined): boolean {
  return type === BUILDING_TYPES.chest || type === BUILDING_TYPES.fireCamp || type === BUILDING_TYPES.trap
}

export const WHEAT_PLOT_SIZE = 4

/** Fields use one material-funded site per tile. */
export function isSowingPlacement(type: string): boolean {
  return type === BUILDING_TYPES.farm
}
