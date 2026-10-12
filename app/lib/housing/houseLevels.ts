import { HOUSE_LEVELS, HOUSE_CORNER_RADIUS } from '../../config/housing'
import { getBuildingLevel } from '../buildings/buildingLevel'
export type HouseLevelLike = { buildingLevel?: number; assetLevel?: unknown; houseInteriorLevel?: number }
export function getHouseInteriorLevel(house: HouseLevelLike): number {
  return Math.min(
    HOUSE_LEVELS.length - 1,
    Math.max(getBuildingLevel(house), Number.isInteger(house.houseInteriorLevel) ? (house.houseInteriorLevel ?? 0) : 0)
  )
}
export function getHouseProfile(house: HouseLevelLike) {
  return HOUSE_LEVELS[getHouseInteriorLevel(house)]!
}

export function getHouseRoomShape(house: HouseLevelLike) {
  const extent = (getHouseProfile(house).interiorSize - 3) / 2
  return { halfWidth: Math.floor(extent), halfDepth: Math.ceil(extent), cornerRadius: HOUSE_CORNER_RADIUS }
}
