import { BUILDING_TYPES } from '../../constants'
import type { PlayerLike } from '../../types/player'

const BUILDING_LIMITS: Partial<Record<string, number>> = {
  [BUILDING_TYPES.townCenter]: 1,
}

function getBuildingLimit(type: string): number | null {
  return BUILDING_LIMITS[type] ?? null
}

function getLivingBuildingCount(owner: PlayerLike | null | undefined, type: string): number {
  return (owner?.buildings ?? []).filter(
    building => building.type === type && !building.isDead && !building.isDestroyed
  ).length
}

export function isBuildingLimitReached(owner: PlayerLike | null | undefined, type: string): boolean {
  const limit = getBuildingLimit(type)
  return limit !== null && getLivingBuildingCount(owner, type) >= limit
}
