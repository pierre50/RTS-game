import { ACTION_TYPES, BUILDING_TYPES, MINING_RESOURCE_CONFIG } from '../../../constants'
import type { UnitEntity } from '../../../types/entities'
import type { VillagerJobCandidate } from '../villagerAutonomyTargeting'
const distance = (a: { i: number; j: number }, b: { i: number; j: number }) => Math.hypot(a.i - b.i, a.j - b.j)
function getCompatibleDropoffTypes(candidate: VillagerJobCandidate): Set<string> | null {
  if (candidate.action === ACTION_TYPES.forageberry || candidate.action === ACTION_TYPES.farm) {
    return new Set([BUILDING_TYPES.granary, BUILDING_TYPES.townCenter])
  }
  const miningActions = new Set(Object.values(MINING_RESOURCE_CONFIG ?? {}).map(config => config.action))
  if (candidate.action === ACTION_TYPES.chopwood || miningActions.has(candidate.action)) {
    return new Set([BUILDING_TYPES.storagePit, BUILDING_TYPES.townCenter])
  }
  if (candidate.action === ACTION_TYPES.takemeat || candidate.action === ACTION_TYPES.hunt) {
    return new Set([BUILDING_TYPES.granary, BUILDING_TYPES.townCenter])
  }
  return null
}

export function nearestDropoffDistance(unit: UnitEntity, candidate: VillagerJobCandidate): number {
  const compatibleTypes = getCompatibleDropoffTypes(candidate)
  if (!compatibleTypes) return 0
  let best = Infinity
  for (const building of unit.owner?.buildings ?? []) {
    if (building.owner !== unit.owner || !building.isBuilt || building.isDead || building.isDestroyed) continue
    if (!compatibleTypes.has(building.type)) continue
    best = Math.min(best, distance(candidate.target, building))
  }
  return best
}
