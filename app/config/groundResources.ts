/** Uniform wilderness scatter; never conditioned on the player's starting location. */
export const GROUND_RESOURCE_PLACEMENT = {
  version: 2,
  zoneSize: 6,
  attempts: 32,
  chance: { GroundWood: 0.9, GroundStone: 0.55 },
  minDistance: 3,
  treeRadius: 3,
  buildingClearance: 3,
  settlementClearance: 3,
} as const
