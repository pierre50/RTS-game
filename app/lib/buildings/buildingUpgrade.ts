import { constructionProgress } from '../economy/constructionMaterials'
import type { BuildingConfig } from '../../types/config'
import type { SaveEntityState } from '../../types/save'
import { getBuildingConfigForLevel } from './buildingLevel'

export function nextBuildingUpgrade(config: BuildingConfig | undefined, currentLevel: number): number | undefined {
  return Object.keys(config?.levelStats ?? {})
    .map(Number)
    .filter(level => Number.isInteger(level) && level > currentLevel)
    .sort((a, b) => a - b)[0]
}

/** Shared by live and offline work. Never replace the building or its interior. */
export function completeBuildingUpgrade(
  building: Pick<
    SaveEntityState,
    | 'type'
    | 'buildingLevel'
    | 'assetLevel'
    | 'buildingUpgrade'
    | 'constructionMaterials'
    | 'hitPoints'
    | 'totalHitPoints'
    | 'isDead'
    | 'isDestroyed'
  > & { shelterCapacity?: number; constructionTime?: number },
  config: BuildingConfig
): boolean {
  const upgrade = building.buildingUpgrade
  if (!upgrade || constructionProgress(building) < 1 || building.isDead || building.isDestroyed) return false
  const previous = getBuildingConfigForLevel(config, building.buildingLevel ?? 0)
  const next = getBuildingConfigForLevel(config, upgrade.targetLevel)
  const oldTotal = building.totalHitPoints ?? previous.totalHitPoints ?? 1
  building.buildingLevel = upgrade.targetLevel
  if (typeof building.assetLevel === 'number') building.assetLevel = upgrade.targetLevel
  building.totalHitPoints = next.totalHitPoints ?? oldTotal
  // Preserve damage already sustained; upgrading cannot resurrect or fully heal a damaged building.
  building.hitPoints = Math.min(
    building.totalHitPoints,
    (building.hitPoints ?? oldTotal) + building.totalHitPoints - oldTotal
  )
  building.shelterCapacity = next.shelterCapacity ?? 0
  building.constructionTime = next.constructionTime
  delete building.buildingUpgrade
  delete building.constructionMaterials
  return true
}
