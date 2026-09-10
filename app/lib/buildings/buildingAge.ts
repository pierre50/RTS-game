import type { BuildingConfig } from '../../types/config'

/** Stats use the latest defined tier at or below the requested building age. */
export function getBuildingConfigForAge(config: BuildingConfig, age: number): BuildingConfig {
  const tier = Object.keys(config.ageStats ?? {})
    .map(Number)
    .filter(value => Number.isInteger(value) && value >= 0 && value <= age)
    .sort((a, b) => b - a)[0]
  const stats = tier == null ? undefined : config.ageStats?.[tier]
  return stats ? { ...config, ...stats } : config
}

export function getBuildingAge(building: { buildingAge?: number; assetAge?: unknown }, ownerAge: number): number {
  const age = building.buildingAge ?? (typeof building.assetAge === 'number' ? building.assetAge : ownerAge)
  return Number.isFinite(age) ? Math.max(0, Math.floor(age)) : 0
}

export function getPlayerBuildingConfig(
  player: { age: number; config: { buildings: Record<string, BuildingConfig> } },
  type: string,
  age = player.age
): BuildingConfig | undefined {
  const config = player.config.buildings[type]
  return config ? getBuildingConfigForAge(config, age) : undefined
}
