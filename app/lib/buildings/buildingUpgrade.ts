import { constructionProgress } from '../economy/constructionMaterials'
import type { ResourceAmount } from '../../types/common'
import type { BuildingConfig } from '../../types/config'
import type { SaveEntityState } from '../../types/save'
import { getBuildingConfigForLevel, getBuildingLevels } from './buildingLevel'

export function nextBuildingUpgrade(config: BuildingConfig | undefined, currentLevel: number): number | undefined {
  return Object.keys(config?.levelStats ?? {})
    .map(Number)
    .filter(level => Number.isInteger(level) && level > currentLevel)
    .sort((a, b) => a - b)[0]
}

/** Explicit renovation prices are independent of new construction prices. */
export function getBuildingUpgradeCost(
  config: BuildingConfig,
  currentLevel: number,
  targetLevel: number
): ResourceAmount {
  const cost: ResourceAmount = {}
  let previousLevel = currentLevel
  for (const level of getBuildingLevels(config).filter(level => level > currentLevel && level <= targetLevel)) {
    const explicit = config.levelStats?.[level]?.upgradeCost
    // Compatibility for older definitions without explicit renovation prices.
    const previousCost = getBuildingConfigForLevel(config, previousLevel).cost ?? {}
    const targetCost = getBuildingConfigForLevel(config, level).cost ?? {}
    const stepCost =
      explicit ??
      Object.fromEntries(
        Object.entries(targetCost).map(([resource, amount]) => [
          resource,
          Math.max(0, amount - (previousCost[resource as keyof ResourceAmount] ?? 0)),
        ])
      )
    for (const [key, amount] of Object.entries(stepCost)) {
      const resource = key as keyof ResourceAmount
      if (amount > 0) cost[resource] = (cost[resource] ?? 0) + amount
    }
    previousLevel = level
  }
  return cost
}

/** Shared by live and offline work. Never replace the building or its interior. */
export function completeBuildingUpgrade(
  building: Pick<
    SaveEntityState,
    | 'type'
    | 'buildingLevel'
    | 'assetLevel'
    | 'buildingUpgrade'
    | 'constructionPaused'
    | 'constructionMaterials'
    | 'hitPoints'
    | 'totalHitPoints'
    | 'isDead'
    | 'isDestroyed'
  > & { shelterCapacity?: number; constructionTime?: number },
  config: BuildingConfig
): boolean {
  const upgrade = building.buildingUpgrade
  if (
    !upgrade ||
    building.constructionPaused ||
    !getBuildingLevels(config).includes(upgrade.targetLevel) ||
    constructionProgress(building) < 1 ||
    building.isDead ||
    building.isDestroyed
  )
    return false
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
