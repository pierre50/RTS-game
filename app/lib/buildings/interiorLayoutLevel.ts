import { getBuildingLevel } from './buildingLevel'

/** Only houses have tier-specific furnishings. Other buildings share their level-one interior. */
export function getInteriorLayoutLevel(building: {
  type: string
  buildingLevel?: number
  assetLevel?: unknown
}): number {
  return building.type === 'House' ? getBuildingLevel(building) : 0
}
