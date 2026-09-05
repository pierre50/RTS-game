import { RESOURCE_TYPES } from '../../../constants'

export type ResourceQuantityRange = [min: number, max: number]

// Per-tile capacity a freshly generated resource node rolls between, replacing the old
// fixed totalQuantity from resources.json so no two nodes on a map are identical.
// Gold is the rarest tier by design: a "vein" is a single tile worth almost nothing on
// its own, meant to read as a rare find rather than a mineable economy resource.
export const NEUTRAL_RESOURCE_QUANTITY_RANGES: Partial<Record<string, ResourceQuantityRange>> = {
  [RESOURCE_TYPES.berrybush]: [40, 70],
  [RESOURCE_TYPES.wheat]: [8, 12],
  [RESOURCE_TYPES.stone]: [70, 120],
  [RESOURCE_TYPES.copper]: [30, 55],
  [RESOURCE_TYPES.iron]: [35, 60],
  [RESOURCE_TYPES.gold]: [3, 5],
  [RESOURCE_TYPES.tree]: [140, 220],
}

export const SCATTERED_STONE_QUANTITY_RANGE: ResourceQuantityRange = [15, 30]

export function rollResourceQuantity(random: () => number, range: ResourceQuantityRange | undefined): number | undefined {
  if (!range) return undefined
  const [min, max] = range
  return Math.round(min + random() * (max - min))
}
