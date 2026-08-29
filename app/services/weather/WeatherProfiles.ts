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
type Transition = {
  chance: number
  phase: WeatherPhase
}
type TransitionMap = Partial<Record<WeatherPhase, Transition[]>>
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
export const COLOR_LERP_PER_SECOND = 1.7
export const RAIN_LERP_PER_SECOND = 0.32
export const FIRST_SUNNY_MIN_SECONDS = 18
export const FIRST_SUNNY_MAX_SECONDS = 45
export const RAIN_BASE_SLANT_RATIO = -0.16
export const RAIN_WIND_SLANT_FACTOR = 0.01
export const RAIN_DRIFT_PER_SECOND = -58
export const WIND_LERP_PER_SECOND = 1
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
    saturation: 0.42,
    brightness: 0.7,
    red: 0.8,
    green: 0.86,
    blue: 1.08,
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
  clearing: { rain: 0.08, sand: 0, snow: 0 },
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

export const BASE_PHASE_DURATIONS_SECONDS: Record<WeatherPhase, [number, number]> = {
  sunny: [360, 720],
  clouding: [45, 120],
  stormBuildUp: [25, 70],
  rainLight: [90, 260],
  rainHeavy: [45, 180],
  snow: [100, 280],
  sandstorm: [45, 135],
  clearing: [60, 150],
  night: [1800, 1800],
}

export const BIOME_DURATION_OVERRIDES: Record<EnvironmentId, Partial<Record<WeatherPhase, [number, number]>>> = {
  Temperate: {},
  Jungle: {
    sunny: [220, 430],
    clouding: [35, 95],
    stormBuildUp: [20, 58],
    rainLight: [80, 220],
    rainHeavy: [35, 150],
    clearing: [45, 110],
    snow: [80, 190],
    sandstorm: [35, 90],
  },
  BlackForest: {
    sunny: [260, 560],
    clouding: [40, 110],
    stormBuildUp: [25, 75],
    rainLight: [90, 220],
    rainHeavy: [45, 190],
    clearing: [55, 140],
    snow: [110, 260],
    sandstorm: [35, 90],
  },
  Desert: {
    sunny: [420, 820],
    clouding: [40, 96],
    stormBuildUp: [20, 50],
    rainLight: [70, 150],
    rainHeavy: [30, 100],
    clearing: [70, 165],
    snow: [80, 160],
    sandstorm: [65, 180],
  },
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
}

export const BASE_WEATHER_TRANSITIONS: TransitionMap = {
  sunny: [
    { chance: 0.62, phase: 'clouding' },
    { chance: 1, phase: 'sunny' },
  ],
  clouding: [
    { chance: 0.42, phase: 'clearing' },
    { chance: 0.7, phase: 'rainLight' },
    { chance: 0.86, phase: 'stormBuildUp' },
    { chance: 1, phase: 'sunny' },
  ],
  stormBuildUp: [
    { chance: 0.22, phase: 'clearing' },
    { chance: 0.58, phase: 'rainLight' },
    { chance: 0.82, phase: 'rainHeavy' },
    { chance: 1, phase: 'clouding' },
  ],
  rainLight: [
    { chance: 0.48, phase: 'clearing' },
    { chance: 0.72, phase: 'clouding' },
    { chance: 0.9, phase: 'rainHeavy' },
    { chance: 1, phase: 'rainLight' },
  ],
  rainHeavy: [
    { chance: 0.5, phase: 'rainLight' },
    { chance: 0.86, phase: 'clearing' },
    { chance: 1, phase: 'stormBuildUp' },
  ],
  clearing: [
    { chance: 0.78, phase: 'sunny' },
    { chance: 1, phase: 'clouding' },
  ],
  snow: [
    { chance: 0.5, phase: 'rainLight' },
    { chance: 0.8, phase: 'clearing' },
    { chance: 1, phase: 'snow' },
  ],
  sandstorm: [
    { chance: 0.72, phase: 'clearing' },
    { chance: 1, phase: 'sunny' },
  ],
}

export const BIOME_TRANSITION_OVERRIDES: Record<EnvironmentId, TransitionMap> = {
  Temperate: {},
  Jungle: {
    sunny: [
      { chance: 0.54, phase: 'clouding' },
      { chance: 1, phase: 'sunny' },
    ],
    clouding: [
      { chance: 0.2, phase: 'clearing' },
      { chance: 0.72, phase: 'rainLight' },
      { chance: 0.92, phase: 'stormBuildUp' },
      { chance: 1, phase: 'sunny' },
    ],
    stormBuildUp: [
      { chance: 0.2, phase: 'clearing' },
      { chance: 0.45, phase: 'rainLight' },
      { chance: 0.8, phase: 'rainHeavy' },
      { chance: 1, phase: 'clouding' },
    ],
    rainLight: [
      { chance: 0.18, phase: 'clearing' },
      { chance: 0.6, phase: 'rainHeavy' },
      { chance: 0.84, phase: 'stormBuildUp' },
      { chance: 1, phase: 'clouding' },
    ],
    rainHeavy: [
      { chance: 0.16, phase: 'rainLight' },
      { chance: 0.44, phase: 'clearing' },
      { chance: 0.8, phase: 'stormBuildUp' },
      { chance: 1, phase: 'clouding' },
    ],
    clearing: [
      { chance: 0.2, phase: 'rainLight' },
      { chance: 0.55, phase: 'clouding' },
      { chance: 1, phase: 'sunny' },
    ],
  },
  BlackForest: {
    sunny: [
      { chance: 0.45, phase: 'clouding' },
      { chance: 0.72, phase: 'rainLight' },
      { chance: 1, phase: 'sunny' },
    ],
    clouding: [
      { chance: 0.16, phase: 'clearing' },
      { chance: 0.5, phase: 'rainLight' },
      { chance: 0.64, phase: 'stormBuildUp' },
      { chance: 0.84, phase: 'snow' },
      { chance: 1, phase: 'sunny' },
    ],
    stormBuildUp: [
      { chance: 0.18, phase: 'clearing' },
      { chance: 0.5, phase: 'snow' },
      { chance: 0.72, phase: 'rainHeavy' },
      { chance: 0.96, phase: 'rainLight' },
      { chance: 1, phase: 'clouding' },
    ],
    rainLight: [
      { chance: 0.25, phase: 'clearing' },
      { chance: 0.5, phase: 'snow' },
      { chance: 0.85, phase: 'rainHeavy' },
      { chance: 1, phase: 'clouding' },
    ],
    rainHeavy: [
      { chance: 0.2, phase: 'snow' },
      { chance: 0.58, phase: 'rainLight' },
      { chance: 0.85, phase: 'clearing' },
      { chance: 1, phase: 'clouding' },
    ],
    clearing: [
      { chance: 0.35, phase: 'sunny' },
      { chance: 0.52, phase: 'rainLight' },
      { chance: 1, phase: 'clouding' },
    ],
    snow: [
      { chance: 0.25, phase: 'clearing' },
      { chance: 0.5, phase: 'clouding' },
      { chance: 0.78, phase: 'rainLight' },
      { chance: 1, phase: 'snow' },
    ],
  },
  Desert: {
    sunny: [
      { chance: 0.14, phase: 'clouding' },
      { chance: 1, phase: 'sunny' },
    ],
    clouding: [
      { chance: 0.24, phase: 'clearing' },
      { chance: 0.6, phase: 'clouding' },
      { chance: 0.62, phase: 'rainLight' },
      { chance: 0.8, phase: 'sandstorm' },
      { chance: 1, phase: 'sunny' },
    ],
    stormBuildUp: [
      { chance: 0.78, phase: 'clearing' },
      { chance: 0.92, phase: 'clouding' },
      { chance: 0.96, phase: 'sunny' },
      { chance: 1, phase: 'rainLight' },
    ],
    rainLight: [
      { chance: 0.78, phase: 'clearing' },
      { chance: 0.93, phase: 'clouding' },
      { chance: 1, phase: 'sunny' },
    ],
    rainHeavy: [
      { chance: 0.85, phase: 'clearing' },
      { chance: 0.94, phase: 'clouding' },
      { chance: 1, phase: 'stormBuildUp' },
    ],
    clearing: [
      { chance: 0.88, phase: 'sunny' },
      { chance: 0.95, phase: 'clouding' },
      { chance: 1, phase: 'rainLight' },
    ],
    snow: [
      { chance: 0.6, phase: 'snow' },
      { chance: 0.95, phase: 'clearing' },
      { chance: 1, phase: 'sunny' },
    ],
    sandstorm: [
      { chance: 0.56, phase: 'clearing' },
      { chance: 0.78, phase: 'sunny' },
      { chance: 1, phase: 'sandstorm' },
    ],
  },
}
