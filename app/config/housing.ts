/** All house levels use the standard interior of a size-2 building. */
export const HOUSE_INTERIOR_GRID_SIZE = 11

/** Internal levels 0 / 1 / 2 change bed capacity, not room size. */
export const HOUSE_LEVELS = [
  { beds: 1, interiorSize: HOUSE_INTERIOR_GRID_SIZE },
  { beds: 2, interiorSize: HOUSE_INTERIOR_GRID_SIZE },
  { beds: 4, interiorSize: HOUSE_INTERIOR_GRID_SIZE },
] as const

export { INTERIOR_CORNER_RADIUS as HOUSE_CORNER_RADIUS } from './interiors'
