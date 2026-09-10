import { type EnvironmentId } from '../../constants'

export type WeatherPhase =
  | 'sunny'
  | 'clouding'
  | 'stormBuildUp'
  | 'rainLight'
  | 'rainHeavy'
  | 'clearing'
  | 'snow'
  | 'sandstorm'
  | 'night'
export type ScreenRect = { height: number; width: number; x: number; y: number }
export type RandomFn = () => number
export type TickerLike = { deltaMS?: number; elapsedMS?: number; deltaTime?: number }
export type WeatherBiomeProfile = {
  precipMultiplier: number
  veilMultiplier: number
  windMultiplier: number
}

export type WeatherColor = {
  blue: number
  brightness: number
  contrast: number
  gamma: number
  green: number
  red: number
  saturation: number
}

export const TARGET_FRAME_MS = 1000 / 60
export const MAX_RAIN_DROPS = 620
export const MAX_SNOW_FLAKES = 420
export const MAX_SAND_GRAINS = 760
export const RAIN_TEXTURE_WIDTH = 3
export const RAIN_TEXTURE_HEIGHT = 32
export const SNOW_TEXTURE_WIDTH = 6
export const SNOW_TEXTURE_HEIGHT = 6
export const SAND_TEXTURE_WIDTH = 18
export const SAND_TEXTURE_HEIGHT = 3
export const COLOR_LERP_PER_SECOND = 0.05
export const RAIN_LERP_PER_SECOND = 0.1
export const RAIN_BASE_SLANT_RATIO = -0.16
export const RAIN_WIND_SLANT_FACTOR = 0.01
export const RAIN_DRIFT_PER_SECOND = -58
export const WIND_LERP_PER_SECOND = 0.08
export const RAIN_LOOP_MAX_VOLUME = 0.55
export const WIND_LOOP_MAX_VOLUME = 0.4
export const AMBIENT_CROSSFADE_MID = 0.45
export const SNOW_COLOR = 0xf0f6ff

export const VEIL_TARGETS: Record<WeatherPhase, number> = {
  sunny: 0,
  clouding: 0.01,
  stormBuildUp: 0.075,
  rainLight: 0.08,
  rainHeavy: 0.14,
  clearing: 0.035,
  snow: 0.1,
  sandstorm: 0.18,
  night: 0,
}

export const WEATHER_COLORS: Record<WeatherPhase, WeatherColor> = {
  sunny: {
    gamma: 1,
    contrast: 1,
    saturation: 1,
    brightness: 1,
    red: 1,
    green: 1,
    blue: 1,
  },
  clouding: {
    gamma: 1,
    contrast: 0.99,
    saturation: 0.88,
    brightness: 0.94,
    red: 0.98,
    green: 0.99,
    blue: 1.01,
  },
  stormBuildUp: {
    gamma: 0.95,
    contrast: 1.02,
    saturation: 0.38,
    brightness: 0.68,
    red: 0.78,
    green: 0.84,
    blue: 1.08,
  },
  rainLight: {
    gamma: 0.95,
    contrast: 0.98,
    saturation: 0.82,
    brightness: 0.9,
    red: 0.96,
    green: 0.98,
    blue: 1.03,
  },
  rainHeavy: {
    gamma: 0.93,
    contrast: 1.05,
    saturation: 0.28,
    brightness: 0.58,
    red: 0.72,
    green: 0.78,
    blue: 1.12,
  },
  snow: {
    gamma: 0.96,
    contrast: 1,
    saturation: 0.32,
    brightness: 0.74,
    red: 0.94,
    green: 0.98,
    blue: 1.1,
  },
  sandstorm: {
    gamma: 0.94,
    contrast: 1.08,
    saturation: 0.58,
    brightness: 0.72,
    red: 1.16,
    green: 0.93,
    blue: 0.62,
  },
  clearing: {
    gamma: 0.99,
    contrast: 0.98,
    saturation: 0.82,
    brightness: 0.9,
    red: 0.96,
    green: 0.98,
    blue: 1,
  },
  night: {
    gamma: 1,
    contrast: 1,
    saturation: 1,
    brightness: 1,
    red: 1,
    green: 1,
    blue: 1,
  },
}

export type WeatherParticleTargets = {
  rain: number
  sand: number
  snow: number
}

export const PARTICLE_TARGETS: Record<WeatherPhase, WeatherParticleTargets> = {
  sunny: { rain: 0, sand: 0, snow: 0 },
  clouding: { rain: 0, sand: 0, snow: 0 },
  stormBuildUp: { rain: 0.04, sand: 0, snow: 0 },
  rainLight: { rain: 0.34, sand: 0, snow: 0 },
  rainHeavy: { rain: 1, sand: 0, snow: 0 },
  snow: { rain: 0, sand: 0, snow: 1 },
  sandstorm: { rain: 0, sand: 0.92, snow: 0 },
  clearing: { rain: 0, sand: 0, snow: 0 },
  night: { rain: 0, sand: 0, snow: 0 },
}

export const WIND_TARGETS: Record<WeatherPhase, number> = {
  sunny: 0,
  clouding: 0.08,
  stormBuildUp: 0.55,
  rainLight: 0.3,
  rainHeavy: 0.85,
  snow: 0.26,
  sandstorm: 1,
  clearing: 0.15,
  night: 0.1,
}

export const BIOME_WEATHER_PROFILES: Record<EnvironmentId, WeatherBiomeProfile> = {
  Temperate: {
    precipMultiplier: 1,
    veilMultiplier: 1,
    windMultiplier: 1,
  },
  Jungle: {
    precipMultiplier: 1.15,
    veilMultiplier: 1.05,
    windMultiplier: 0.85,
  },
  BlackForest: {
    precipMultiplier: 0.9,
    veilMultiplier: 0.9,
    windMultiplier: 0.85,
  },
  Desert: {
    precipMultiplier: 0.18,
    veilMultiplier: 0.45,
    windMultiplier: 0.65,
  },
  Steppe: {
    precipMultiplier: 0.55,
    veilMultiplier: 0.75,
    windMultiplier: 1.25,
  },
}
