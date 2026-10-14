import { getInteriorLayoutLevel } from './interiorLayoutLevel'
import { INTERIOR_LAYOUT_POSITIONS, isFullInteriorLayout } from '../../../config/interiorLayoutPositions'
import { HOUSE_INTERIOR_GRID_SIZE } from '../../../config/housing'
import { getInteriorMapSizeForBuildingSize } from './interiorProfiles'

export const INTERIOR_ROOM_SIZES = [7, 9, 11, 13, 15, 17, 19] as const

/** House dimensions belong to each level; other buildings use their shared level-one layout. */
export function getAuthoredInteriorRoomSize(building: {
  type: string
  size?: number
  buildingLevel?: number
  assetLevel?: unknown
}): number | undefined {
  const layout = INTERIOR_LAYOUT_POSITIONS[building.type]?.[getInteriorLayoutLevel(building)]
  if (layout && isFullInteriorLayout(layout) && INTERIOR_ROOM_SIZES.some(size => size === layout.roomSize))
    return layout.roomSize!
  return undefined
}

export function getInteriorRoomSize(building: Parameters<typeof getAuthoredInteriorRoomSize>[0]): number {
  return (
    getAuthoredInteriorRoomSize(building) ??
    (building.type === 'House' ? HOUSE_INTERIOR_GRID_SIZE : getInteriorMapSizeForBuildingSize(building.size))
  )
}
