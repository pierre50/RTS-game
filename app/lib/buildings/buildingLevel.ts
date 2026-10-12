import { TWO_LEVEL_BUILDINGS, TWO_LEVEL_BUILDING_MAX } from '../../config/buildingLevels'
import type { BuildingConfig } from '../../types/config'

/** Available construction variants, including the base building. */
export function getBuildingLevels(config: BuildingConfig | undefined): number[] {
  return [
    0,
    ...Object.keys(config?.levelStats ?? {})
      .map(Number)
      .filter(level => Number.isInteger(level) && level > 0),
  ].sort((a, b) => a - b)
}

/** Each building owns its level independently of its owner. */
export function getBuildingConfigForLevel(config: BuildingConfig, level: number): BuildingConfig {
  const tier = Object.keys(config.levelStats ?? {})
    .map(Number)
    .filter(value => Number.isInteger(value) && value >= 0 && value <= level)
    .sort((a, b) => b - a)[0]
  const stats = tier == null ? undefined : config.levelStats?.[tier]
  return stats ? { ...config, ...stats } : config
}

export function getBuildingLevel(building: { type?: string; buildingLevel?: number; assetLevel?: unknown }): number {
  const level = building.buildingLevel ?? (typeof building.assetLevel === 'number' ? building.assetLevel : 0)
  const normalized = Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0
  return TWO_LEVEL_BUILDINGS.some(type => type === building.type)
    ? Math.min(TWO_LEVEL_BUILDING_MAX, normalized)
    : normalized
}

export function getPlayerBuildingConfig(
  player: { config: { buildings: Record<string, BuildingConfig> } },
  type: string,
  level = 0
): BuildingConfig | undefined {
  const config = player.config.buildings[type]
  return config ? getBuildingConfigForLevel(config, level) : undefined
}
