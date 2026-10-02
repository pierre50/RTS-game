import type { BuildingConfig } from '../../types/config'

/** Each building owns its level; new construction always starts at level zero. */
export function getBuildingConfigForLevel(config: BuildingConfig, level: number): BuildingConfig {
  const tier = Object.keys(config.levelStats ?? {})
    .map(Number)
    .filter(value => Number.isInteger(value) && value >= 0 && value <= level)
    .sort((a, b) => b - a)[0]
  const stats = tier == null ? undefined : config.levelStats?.[tier]
  return stats ? { ...config, ...stats } : config
}

export function getBuildingLevel(building: { buildingLevel?: number; assetLevel?: unknown }): number {
  const level = building.buildingLevel ?? (typeof building.assetLevel === 'number' ? building.assetLevel : 0)
  return Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0
}

export function getPlayerBuildingConfig(
  player: { config: { buildings: Record<string, BuildingConfig> } },
  type: string,
  level = 0
): BuildingConfig | undefined {
  const config = player.config.buildings[type]
  return config ? getBuildingConfigForLevel(config, level) : undefined
}
