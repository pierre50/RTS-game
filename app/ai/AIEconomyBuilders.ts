import { ACTION_TYPES, BUILDING_TYPES, FAMILY_TYPES, WORK_TYPES } from '../constants'
import type { AIBuildingLike, AIEconomyBuildingContext, AIEntityLike } from './types'

export function getBuildersNeeded(buildingType: string): number {
  switch (buildingType) {
    case BUILDING_TYPES.barracks:
    case BUILDING_TYPES.archeryRange:
    case BUILDING_TYPES.stable:
    case BUILDING_TYPES.townCenter:
      return 2
    default:
      return 1
  }
}

export function isValidBuildAssignment(villager: AIEntityLike): boolean {
  return (
    villager &&
    !villager.isDead &&
    villager.action === ACTION_TYPES.build &&
    villager.work === WORK_TYPES.builder &&
    (villager.dest as AIEntityLike | undefined)?.family === FAMILY_TYPES.building &&
    (villager.getActionCondition?.(villager.dest as AIEntityLike, ACTION_TYPES.build) ?? false)
  )
}

export function recoverInvalidBuilder(villager: AIEntityLike): boolean {
  if (!villager || villager.isDead || isValidBuildAssignment(villager)) return false
  if (villager.work !== WORK_TYPES.builder && villager.action !== ACTION_TYPES.build) return false

  if (villager.previousDest || villager.previousWork) {
    villager.goBackToPrevious?.()
  } else {
    villager.stop?.()
    villager.work = null
  }
  return true
}

export function assignBuilders(
  economy: AIEconomyBuildingContext,
  villagers: AIEntityLike[],
  notBuiltBuildings: AIBuildingLike[],
  debug: boolean = false
): Set<AIEntityLike> {
  const assigned = new Set<AIEntityLike>()
  if (!notBuiltBuildings.length) return assigned

  const buildingLoad = new Map<string, number>()
  for (const v of villagers) {
    if (isValidBuildAssignment(v)) {
      const label = v.dest && 'label' in v.dest && typeof v.dest.label === 'string' ? v.dest.label : null
      if (label) {
        buildingLoad.set(label, (buildingLoad.get(label) || 0) + 1)
      }
      assigned.add(v)
    } else {
      recoverInvalidBuilder(v)
    }
  }

  const prioritized = [...notBuiltBuildings].sort(
    (a, b) => (buildingLoad.get(a.label || '') || 0) - (buildingLoad.get(b.label || '') || 0)
  )

  for (const building of prioritized) {
    if (economy.ai.isBuildingThreatened?.(building)) continue
    const needed = getBuildersNeeded(building.type) - (buildingLoad.get(building.label || '') || 0)
    if (needed <= 0) continue

    const candidates = villagers
      .filter(v => !assigned.has(v) && v !== economy.ai.scout && (v.hitPoints || 0) > (v.totalHitPoints || 0) * 0.3)
      .sort((a, b) => {
        const da = Math.abs(a.i - building.i) + Math.abs(a.j - building.j) + (a.inactif ? -30 : 0)
        const db = Math.abs(b.i - building.i) + Math.abs(b.j - building.j) + (b.inactif ? -30 : 0)
        return da - db
      })

    for (let i = 0; i < Math.min(needed, candidates.length); i++) {
      const v = candidates[i]
      v.sendToBuilding?.(building)
      assigned.add(v)
      if (building.label) buildingLoad.set(building.label, (buildingLoad.get(building.label) || 0) + 1)
      if (debug) console.log('Villager sent to build:', building.type)
    }
  }

  return assigned
}
