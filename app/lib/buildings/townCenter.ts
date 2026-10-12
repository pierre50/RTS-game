import { TOWN_CENTER_LEVELS } from '../../config/townCenter'
import { getBuildingLevel } from './buildingLevel'
export function getTownCenterProfile(building: { buildingLevel?: number; assetLevel?: unknown } = {}) {
  return TOWN_CENTER_LEVELS[Math.min(getBuildingLevel(building), TOWN_CENTER_LEVELS.length - 1)]!
}

export function calculateVillagerArrivals({
  population,
  populationMax,
  buildingLevel = 0,
}: {
  population: number
  populationMax: number
  buildingLevel?: number
}): number {
  if (population <= 0) return 0
  const profile = getTownCenterProfile({ buildingLevel })
  return Math.max(
    0,
    Math.min(profile.maxArrivals, Math.max(1, Math.floor(population * profile.growthRate)), populationMax - population)
  )
}
