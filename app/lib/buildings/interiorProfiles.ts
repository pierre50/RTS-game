import { BUILDING_TYPES } from '../../constants'

const BUILDING_INTERIOR_TYPE_ORDER = [
  BUILDING_TYPES.townCenter,
  BUILDING_TYPES.house,
  BUILDING_TYPES.barracks,
  BUILDING_TYPES.archeryRange,
  BUILDING_TYPES.temple,
  BUILDING_TYPES.granary,
  BUILDING_TYPES.storagePit,
  BUILDING_TYPES.stable,
  BUILDING_TYPES.watchTower,
] as const

export const BUILDING_INTERIOR_TYPES = new Set<string>(BUILDING_INTERIOR_TYPE_ORDER)
