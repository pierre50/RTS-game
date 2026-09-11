// Environment appearance and resource defaults. Terrain is supplied by the macro world.
export type EnvironmentId = 'Temperate' | 'BlackForest' | 'Jungle' | 'Desert' | 'Steppe'

export const DEFAULT_ENVIRONMENT_ID: EnvironmentId = 'Temperate'

export const ENVIRONMENT_IDS: EnvironmentId[] = ['Temperate', 'BlackForest', 'Jungle', 'Desert', 'Steppe']

// Palette source: scripts/retro_palette/duel.hex.
const TEMPERATE_WATER_BACKGROUND_COLOR = 0x006b6d
const BLACK_FOREST_WATER_BACKGROUND_COLOR = 0x07487c
const JUNGLE_WATER_BACKGROUND_COLOR = 0x008279
const DESERT_WATER_BACKGROUND_COLOR = 0x328ca7
const STEPPE_WATER_BACKGROUND_COLOR = TEMPERATE_WATER_BACKGROUND_COLOR

const WATER_BACKGROUND_COLORS_BY_ENVIRONMENT: Record<EnvironmentId, number> = {
  Temperate: TEMPERATE_WATER_BACKGROUND_COLOR,
  BlackForest: BLACK_FOREST_WATER_BACKGROUND_COLOR,
  Jungle: JUNGLE_WATER_BACKGROUND_COLOR,
  Desert: DESERT_WATER_BACKGROUND_COLOR,
  Steppe: STEPPE_WATER_BACKGROUND_COLOR,
}

export interface EnvironmentTerrainParams {
  groundType: 'Grass' | 'Desert' | 'Jungle' | 'DarkForest'
  groundTreeChance: number | null
  reliefAmplitude: number
  forestDensity: number
  treeTextureFamily?: 'Grass' | 'Desert' | 'Jungle' | 'DarkForest' | null
  waterBackgroundColor: number
}

export const ENVIRONMENT_TERRAIN_PARAMS: Record<EnvironmentId, EnvironmentTerrainParams> = {
  Temperate: {
    groundType: 'Grass',
    groundTreeChance: 0.1,
    reliefAmplitude: 1,
    forestDensity: 0.2,
    treeTextureFamily: null,
    waterBackgroundColor: WATER_BACKGROUND_COLORS_BY_ENVIRONMENT.Temperate,
  },
  BlackForest: {
    groundType: 'DarkForest',
    groundTreeChance: 0.1,
    reliefAmplitude: 1,
    forestDensity: 0.3,
    treeTextureFamily: null,
    waterBackgroundColor: WATER_BACKGROUND_COLORS_BY_ENVIRONMENT.BlackForest,
  },
  Jungle: {
    groundType: 'Jungle',
    groundTreeChance: 0.1,
    reliefAmplitude: 1,
    forestDensity: 0.3,
    treeTextureFamily: null,
    waterBackgroundColor: WATER_BACKGROUND_COLORS_BY_ENVIRONMENT.Jungle,
  },
  Desert: {
    groundType: 'Desert',
    groundTreeChance: null,
    reliefAmplitude: 0.3,
    forestDensity: 0.1,
    treeTextureFamily: null,
    waterBackgroundColor: WATER_BACKGROUND_COLORS_BY_ENVIRONMENT.Desert,
  },
  Steppe: {
    groundType: 'Grass',
    groundTreeChance: 0,
    reliefAmplitude: 0.65,
    forestDensity: 1,
    treeTextureFamily: 'DarkForest',
    waterBackgroundColor: WATER_BACKGROUND_COLORS_BY_ENVIRONMENT.Steppe,
  },
}

export function getEnvironmentTerrainParams(environment?: string | null): EnvironmentTerrainParams {
  return ENVIRONMENT_TERRAIN_PARAMS[environment as EnvironmentId] ?? ENVIRONMENT_TERRAIN_PARAMS[DEFAULT_ENVIRONMENT_ID]
}
