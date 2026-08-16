import { Container, Graphics, Particle, ParticleContainer, Texture, type Filter } from 'pixi.js'
import { AdjustmentFilter } from 'pixi-filters'
import { sound, type IMediaInstance } from '@pixi/sound'
import { DEFAULT_ENVIRONMENT_ID, ENVIRONMENT_IDS, SOUND_CUES, type EnvironmentId } from '../constants'
import { playSoundCue } from '../lib'
import type { GameContextLike } from '../types/context'
import type { RuntimeMap } from '../types/map'

type WeatherPhase = 'sunny' | 'clouding' | 'stormBuildUp' | 'rainLight' | 'rainHeavy' | 'clearing' | 'snow' | 'night'
type ScreenRect = { height: number; width: number; x: number; y: number }
type RandomFn = () => number
type TickerLike = { deltaMS?: number; elapsedMS?: number; deltaTime?: number }
type Transition = {
  chance: number
  phase: WeatherPhase
}
type TransitionMap = Partial<Record<WeatherPhase, Transition[]>>
type WeatherBiomeProfile = {
  precipMultiplier: number
  veilMultiplier: number
  windMultiplier: number
}

type WeatherColor = {
  blue: number
  brightness: number
  contrast: number
  gamma: number
  green: number
  red: number
  saturation: number
}

const TARGET_FRAME_MS = 1000 / 60
const MAX_RAIN_DROPS = 620
const MAX_SNOW_FLAKES = 420
const RAIN_TEXTURE_WIDTH = 3
const RAIN_TEXTURE_HEIGHT = 32
const SNOW_TEXTURE_WIDTH = 6
const SNOW_TEXTURE_HEIGHT = 6
const COLOR_LERP_PER_SECOND = 1.7
const RAIN_LERP_PER_SECOND = 1.4
const FIRST_SUNNY_MIN_SECONDS = 18
const FIRST_SUNNY_MAX_SECONDS = 45
const RAIN_BASE_SLANT_RATIO = -0.16
const RAIN_WIND_SLANT_FACTOR = 0.01
const RAIN_DRIFT_PER_SECOND = -58
const WIND_LERP_PER_SECOND = 1
const RAIN_LOOP_MAX_VOLUME = 0.55
const WIND_LOOP_MAX_VOLUME = 0.4
const AMBIENT_CROSSFADE_MID = 0.45
const SNOW_COLOR = 0xf0f6ff

const VEIL_TARGETS: Record<WeatherPhase, number> = {
  sunny: 0,
  clouding: 0.01,
  stormBuildUp: 0.075,
  rainLight: 0.08,
  rainHeavy: 0.14,
  clearing: 0.035,
  snow: 0.1,
  night: 0,
}

const WEATHER_COLORS: Record<WeatherPhase, WeatherColor> = {
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

const PRECIPITATION_TARGETS: Record<WeatherPhase, number> = {
  sunny: 0,
  clouding: 0,
  stormBuildUp: 0.04,
  rainLight: 0.34,
  rainHeavy: 1,
  snow: 1,
  clearing: 0.08,
  night: 0,
}

const WIND_TARGETS: Record<WeatherPhase, number> = {
  sunny: 0,
  clouding: 0.08,
  stormBuildUp: 0.55,
  rainLight: 0.3,
  rainHeavy: 0.85,
  snow: 0.26,
  clearing: 0.15,
  night: 0.1,
}

const BASE_PHASE_DURATIONS_SECONDS: Record<WeatherPhase, [number, number]> = {
  sunny: [360, 720],
  clouding: [45, 120],
  stormBuildUp: [25, 70],
  rainLight: [90, 260],
  rainHeavy: [45, 180],
  snow: [100, 280],
  clearing: [60, 150],
  night: [1800, 1800],
}

const BIOME_DURATION_OVERRIDES: Record<EnvironmentId, Partial<Record<WeatherPhase, [number, number]>>> = {
  Temperate: {},
  Jungle: {
    sunny: [220, 430],
    clouding: [35, 95],
    stormBuildUp: [20, 58],
    rainLight: [80, 220],
    rainHeavy: [35, 150],
    clearing: [45, 110],
    snow: [80, 190],
  },
  BlackForest: {
    sunny: [260, 560],
    clouding: [40, 110],
    stormBuildUp: [25, 75],
    rainLight: [90, 220],
    rainHeavy: [45, 190],
    clearing: [55, 140],
    snow: [110, 260],
  },
  Desert: {
    sunny: [420, 820],
    clouding: [40, 96],
    stormBuildUp: [20, 50],
    rainLight: [70, 150],
    rainHeavy: [30, 100],
    clearing: [70, 165],
    snow: [80, 160],
  },
}

const BIOME_WEATHER_PROFILES: Record<EnvironmentId, WeatherBiomeProfile> = {
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

const BASE_WEATHER_TRANSITIONS: TransitionMap = {
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
}

const BIOME_TRANSITION_OVERRIDES: Record<EnvironmentId, TransitionMap> = {
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
      { chance: 0.65, phase: 'rainLight' },
      { chance: 0.85, phase: 'snow' },
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
      { chance: 0.65, phase: 'snow' },
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
      { chance: 0.06, phase: 'clouding' },
      { chance: 1, phase: 'sunny' },
    ],
    clouding: [
      { chance: 0.24, phase: 'clearing' },
      { chance: 0.6, phase: 'clouding' },
      { chance: 0.62, phase: 'rainLight' },
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
  },
}

function randomBetween(min: number, max: number, random: RandomFn): number {
  return min + random() * (max - min)
}

function randomDuration(minSeconds: number, maxSeconds: number, random: RandomFn): number {
  return randomBetween(minSeconds, maxSeconds, random) * 1000
}

function lerp(current: number, target: number, amount: number): number {
  return current + (target - current) * Math.max(0, Math.min(1, amount))
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function combineColor(base: WeatherColor, weather: WeatherColor): WeatherColor {
  return {
    gamma: base.gamma * weather.gamma,
    contrast: base.contrast * weather.contrast,
    saturation: base.saturation * weather.saturation,
    brightness: base.brightness * weather.brightness,
    red: base.red * weather.red,
    green: base.green * weather.green,
    blue: base.blue * weather.blue,
  }
}

// Triangular crossfade: `low` peaks at `mid` then fades out, `high` ramps in from `mid` to 1.
function crossfadeVolumes(intensity: number, mid: number): { high: number; low: number } {
  const low = intensity <= mid ? intensity / mid : 1 - (intensity - mid) / (1 - mid)
  const high = intensity <= mid ? 0 : (intensity - mid) / (1 - mid)
  return { low: clamp(low, 0, 1), high: clamp(high, 0, 1) }
}

function startAmbientLoop(alias: string, onReady: (instance: IMediaInstance) => void): void {
  const result = sound.play(alias, { loop: true, volume: 0 })
  if (result instanceof Promise) result.then(onReady).catch(() => {})
  else onReady(result)
}

function biomeKeyFromEnvironment(environment?: string | null): EnvironmentId {
  return ENVIRONMENT_IDS.includes(environment as EnvironmentId)
    ? (environment as EnvironmentId)
    : DEFAULT_ENVIRONMENT_ID
}

function nextPhase(phase: WeatherPhase, random: RandomFn, biome: EnvironmentId): WeatherPhase {
  if (phase === 'night') return 'night'
  const overrides = BIOME_TRANSITION_OVERRIDES[biome]
  const environmentTransitions = { ...BASE_WEATHER_TRANSITIONS, ...(overrides ?? {}) }
  const transitions = environmentTransitions[phase]
  if (!transitions || transitions.length === 0) return 'sunny'
  const roll = random()
  for (const option of transitions) {
    if (roll < option.chance) return option.phase
  }
  return transitions[transitions.length - 1].phase
}

function phaseDuration(phase: WeatherPhase, random: RandomFn, biome: EnvironmentId): number {
  const overrides = BIOME_DURATION_OVERRIDES[biome] ?? {}
  const range = overrides[phase] ?? BASE_PHASE_DURATIONS_SECONDS[phase]
  return randomDuration(range[0], range[1], random)
}

function seconds(ms: number): number {
  return Math.round(ms / 1000)
}

class Raindrop extends Particle {
  baseAlpha = 0
  baseLength = 0
  speed = 0
  wobble = 0
}

class Snowflake extends Particle {
  baseAlpha = 0
  baseScale = 0
  rotationSpeed = 0
  speed = 0
  wobble = 0
}

// Drawn on a plain <canvas> rather than a Pixi RenderTexture from renderer.generateTexture,
// since a one-off rendered RenderTexture has no CPU-side backing to re-upload from after a
// WebGL context loss. ImageSource (what Texture.from(canvas) creates) also defaults
// `autoGarbageCollect` to true, so it's disabled below the same way RenderTexture/TexturePool
// already do for their own temporary resources — belt-and-suspenders against Pixi's GCSystem
// unloading it mid-game. The actual recurring "Cannot read properties of null (reading '0')"
// crash in GlParticleContainerAdaptor was a separate, self-inflicted issue: see the comment
// on destroy() below.
function createRainTexture(): Texture {
  const canvas = document.createElement('canvas')
  canvas.width = RAIN_TEXTURE_WIDTH
  canvas.height = RAIN_TEXTURE_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable for rain texture')
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(1, 'rgba(255,255,255,0.1)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const texture = Texture.from(canvas)
  texture.source.autoGarbageCollect = false
  return texture
}

function createSnowTexture(): Texture {
  const canvas = document.createElement('canvas')
  canvas.width = SNOW_TEXTURE_WIDTH
  canvas.height = SNOW_TEXTURE_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable for snow texture')
  const centerX = SNOW_TEXTURE_WIDTH / 2
  const centerY = SNOW_TEXTURE_HEIGHT / 2
  ctx.strokeStyle = '#f4fbff'
  ctx.fillStyle = '#ffffff'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(centerX - 2.2, centerY)
  ctx.lineTo(centerX + 2.2, centerY)
  ctx.moveTo(centerX, centerY - 2.2)
  ctx.lineTo(centerX, centerY + 2.2)
  ctx.moveTo(centerX - 1.8, centerY - 1.8)
  ctx.lineTo(centerX + 1.8, centerY + 1.8)
  ctx.moveTo(centerX + 1.8, centerY - 1.8)
  ctx.lineTo(centerX - 1.8, centerY + 1.8)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(centerX, centerY, 1, 0, Math.PI * 2)
  ctx.fill()
  const texture = Texture.from(canvas)
  texture.source.autoGarbageCollect = false
  return texture
}

export class WeatherSystem {
  context: GameContextLike
  currentColor: WeatherColor
  elapsedMs: number
  flashAlpha: number
  flashCooldownMs: number
  flashOverlay: Graphics
  getScreenRect: () => ScreenRect
  layer: Container
  lightningBursts: number
  lightningNextBurstMs: number
  map: RuntimeMap & { filters?: readonly Filter[] | null }
  mapFilters: readonly Filter[] | null
  biome: EnvironmentId
  biomeProfile: WeatherBiomeProfile
  phase: WeatherPhase
  phaseEndsAt: number
  rain: ParticleContainer
  rainTexture: Texture
  snow: ParticleContainer
  snowTexture: Texture
  rainVeil: Graphics
  raindrops: Raindrop[]
  snowflakes: Snowflake[]
  precipIntensity: number
  rainLoopHeavy: IMediaInstance | null
  rainLoopLight: IMediaInstance | null
  random: RandomFn
  screenRect: ScreenRect
  tintFilter: AdjustmentFilter
  lastMapX: number
  lastMapY: number
  windIntensity: number
  windLoopHeavy: IMediaInstance | null
  windLoopLight: IMediaInstance | null
  windX: number
  windTargetX: number
  _onTick: (ticker: TickerLike) => void

  constructor(
    context: GameContextLike,
    map: RuntimeMap & { filters?: readonly Filter[] | null },
    getScreenRect: () => ScreenRect,
    random: RandomFn = Math.random
  ) {
    this.context = context
    this.map = map
    this.getScreenRect = getScreenRect
    this.random = random
    this.biome = biomeKeyFromEnvironment(map.environment)
    this.biomeProfile = BIOME_WEATHER_PROFILES[this.biome]
    this.phase = 'sunny'
    this.elapsedMs = 0
    this.phaseEndsAt = randomDuration(FIRST_SUNNY_MIN_SECONDS, FIRST_SUNNY_MAX_SECONDS, this.random)
    this.currentColor = { ...WEATHER_COLORS.sunny }
    this.precipIntensity = 0
    this.windIntensity = 0
    this.windX = randomBetween(-5, 5, this.random)
    this.windTargetX = this.windX
    this.flashAlpha = 0
    this.flashCooldownMs = randomDuration(20, 55, this.random)
    this.lightningBursts = 0
    this.lightningNextBurstMs = 0
    this.screenRect = this.getScreenRect()
    this.lastMapX = this.map.x
    this.lastMapY = this.map.y
    this.rainTexture = createRainTexture()
    this.snowTexture = createSnowTexture()
    this.raindrops = Array.from({ length: MAX_RAIN_DROPS }, () => this.createRaindrop(true))
    this.snowflakes = Array.from({ length: MAX_SNOW_FLAKES }, () => this.createSnowflake(true))

    this.tintFilter = new AdjustmentFilter(this.currentColor)
    this.mapFilters = map.filters ?? null
    map.filters = [...(this.mapFilters ?? []), this.tintFilter]

    this.layer = new Container()
    this.layer.eventMode = 'none'
    this.layer.label = 'weather-layer'
    this.rainVeil = new Graphics()
    this.rain = new ParticleContainer({
      texture: this.rainTexture,
      dynamicProperties: { position: true, rotation: true, vertex: true, color: true },
    })
    this.rain.addParticle(...this.raindrops)
    this.snow = new ParticleContainer({
      texture: this.snowTexture,
      dynamicProperties: { position: true, rotation: true, vertex: true, color: true },
    })
    this.snow.addParticle(...this.snowflakes)
    this.flashOverlay = new Graphics()
    this.layer.addChild(this.rainVeil, this.rain, this.snow, this.flashOverlay)

    this.rainLoopLight = null
    this.rainLoopHeavy = null
    this.windLoopLight = null
    this.windLoopHeavy = null
    startAmbientLoop(SOUND_CUES.weather.rainLight, instance => (this.rainLoopLight = instance))
    startAmbientLoop(SOUND_CUES.weather.rainHeavy, instance => (this.rainLoopHeavy = instance))
    startAmbientLoop(SOUND_CUES.weather.windLight, instance => (this.windLoopLight = instance))
    startAmbientLoop(SOUND_CUES.weather.windHeavy, instance => (this.windLoopHeavy = instance))

    this._onTick = ticker => this.update(ticker.deltaMS ?? ticker.elapsedMS ?? TARGET_FRAME_MS)
    context.app.ticker.add(this._onTick)
    this.log('started', this.debugState())
  }

  createRaindrop(anywhere = false): Raindrop {
    const drop = new Raindrop({ texture: this.rainTexture, anchorX: 0.5, anchorY: 0, alpha: 0 })
    this.resetRaindrop(drop, anywhere)
    return drop
  }

  createSnowflake(anywhere = false): Snowflake {
    const flake = new Snowflake({ texture: this.snowTexture, anchorX: 0.5, anchorY: 0.5, alpha: 0 })
    this.resetSnowflake(flake, anywhere)
    return flake
  }

  resetRaindrop(drop: Raindrop, anywhere = false): void {
    const margin = 160
    drop.x = randomBetween(-margin, this.screenRect.width + margin, this.random)
    drop.y = anywhere
      ? randomBetween(-margin, this.screenRect.height + margin, this.random)
      : randomBetween(-margin, 0, this.random)
    drop.speed = randomBetween(720, 1320, this.random)
    drop.baseLength = randomBetween(14, 34, this.random)
    drop.baseAlpha = randomBetween(0.18, 0.62, this.random)
    drop.wobble = randomBetween(-1, 1, this.random)
  }

  resetSnowflake(flake: Snowflake, anywhere = false): void {
    const margin = 160
    flake.x = randomBetween(-margin, this.screenRect.width + margin, this.random)
    flake.y = anywhere
      ? randomBetween(-margin, this.screenRect.height + margin, this.random)
      : randomBetween(-margin, 0, this.random)
    flake.speed = randomBetween(24, 84, this.random)
    flake.baseScale = randomBetween(0.22, 0.76, this.random)
    flake.baseAlpha = randomBetween(0.12, 0.62, this.random)
    flake.wobble = randomBetween(-0.7, 0.7, this.random)
    flake.rotationSpeed = randomBetween(-0.7, 0.7, this.random)
    flake.rotation = randomBetween(0, Math.PI * 2, this.random)
  }

  forcePhase(phase: WeatherPhase): void {
    this.phase = phase
    this.phaseEndsAt = this.elapsedMs + phaseDuration(phase, this.random, this.biome)
    if (phase === 'stormBuildUp' || phase === 'rainHeavy') this.flashCooldownMs = randomDuration(2, 7, this.random)
    this.log('forced phase', this.debugState())
  }

  advancePhase(): void {
    const previousPhase = this.phase
    this.phase = nextPhase(this.phase, this.random, this.biome)
    this.phaseEndsAt = this.elapsedMs + phaseDuration(this.phase, this.random, this.biome)
    this.windTargetX = randomBetween(-9, 9, this.random)
    if (this.phase === 'stormBuildUp' || this.phase === 'rainHeavy') {
      this.flashCooldownMs = randomDuration(4, 14, this.random)
    }
    this.log(`phase ${previousPhase} -> ${this.phase}`, this.debugState())
  }

  update(elapsedMs: number): void {
    if (this.context.paused || this.context.victory || this.context.defeat) return
    const safeElapsedMs = Math.min(Math.max(elapsedMs, 0), 250)
    const elapsedSeconds = safeElapsedMs / 1000
    this.elapsedMs += safeElapsedMs

    if (this.elapsedMs >= this.phaseEndsAt) this.advancePhase()
    const mapShiftX = this.map.x - this.lastMapX
    const mapShiftY = this.map.y - this.lastMapY
    this.lastMapX = this.map.x
    this.lastMapY = this.map.y

    this.screenRect = this.getScreenRect()
    this.layer.position.set(this.screenRect.x, this.screenRect.y)
    this.windTargetX += Math.sin(this.elapsedMs * 0.00019) * 0.006
    this.windTargetX = Math.max(-12, Math.min(12, this.windTargetX))
    this.windX = lerp(this.windX, this.windTargetX, elapsedSeconds * 0.45)
    this.windIntensity = lerp(
      this.windIntensity,
      WIND_TARGETS[this.phase] * this.biomeProfile.windMultiplier,
      elapsedSeconds * WIND_LERP_PER_SECOND
    )

    this.updateColor(elapsedSeconds)
    this.drawRainVeil()
    this.updateLightning(safeElapsedMs)
    this.updatePrecipitation(elapsedSeconds, mapShiftX, mapShiftY)
    this.updateParticleVisibility()
    this.updateAmbientSound()
    this.drawFlash()
  }

  updateParticleVisibility(): void {
    const showRain = this.precipIntensity > 0.02 && this.phase !== 'snow'
    const showSnow = this.precipIntensity > 0.02 && this.phase === 'snow'
    this.rain.visible = showRain
    this.snow.visible = showSnow
  }

  updateAmbientSound(): void {
    const rainVolumes =
      this.phase === 'snow'
        ? { high: 0, low: 0 }
        : crossfadeVolumes(this.precipIntensity, AMBIENT_CROSSFADE_MID)
    const windVolumes = crossfadeVolumes(this.windIntensity, AMBIENT_CROSSFADE_MID)
    if (this.rainLoopLight) this.rainLoopLight.volume = rainVolumes.low * RAIN_LOOP_MAX_VOLUME
    if (this.rainLoopHeavy) this.rainLoopHeavy.volume = rainVolumes.high * RAIN_LOOP_MAX_VOLUME
    if (this.windLoopLight) this.windLoopLight.volume = windVolumes.low * WIND_LOOP_MAX_VOLUME
    if (this.windLoopHeavy) this.windLoopHeavy.volume = windVolumes.high * WIND_LOOP_MAX_VOLUME
  }

  updateColor(elapsedSeconds: number): void {
    const target = combineColor(this.context.dayNight?.getColorAdjustment?.() ?? WEATHER_COLORS.sunny, WEATHER_COLORS[this.phase])
    const amount = elapsedSeconds * COLOR_LERP_PER_SECOND
    this.currentColor.gamma = lerp(this.currentColor.gamma, target.gamma, amount)
    this.currentColor.contrast = lerp(this.currentColor.contrast, target.contrast, amount)
    this.currentColor.saturation = lerp(this.currentColor.saturation, target.saturation, amount)
    this.currentColor.brightness = lerp(this.currentColor.brightness, target.brightness, amount)
    this.currentColor.red = lerp(this.currentColor.red, target.red, amount)
    this.currentColor.green = lerp(this.currentColor.green, target.green, amount)
    this.currentColor.blue = lerp(this.currentColor.blue, target.blue, amount)

    this.tintFilter.gamma = this.currentColor.gamma
    this.tintFilter.contrast = this.currentColor.contrast
    this.tintFilter.saturation = this.currentColor.saturation
    this.tintFilter.brightness = this.currentColor.brightness
    this.tintFilter.red = this.currentColor.red
    this.tintFilter.green = this.currentColor.green
    this.tintFilter.blue = this.currentColor.blue
  }

  updateLightning(elapsedMs: number): void {
    this.flashAlpha *= Math.pow(0.012, elapsedMs / 1000)
    const canStorm = this.phase === 'stormBuildUp' || this.phase === 'rainHeavy'
    if (!canStorm) {
      this.lightningBursts = 0
      return
    }

    if (this.lightningBursts > 0) {
      this.lightningNextBurstMs -= elapsedMs
      if (this.lightningNextBurstMs <= 0) {
        this.flashAlpha = Math.max(this.flashAlpha, randomBetween(0.28, 0.76, this.random))
        this.lightningBursts--
        this.lightningNextBurstMs = randomDuration(0.07, 0.22, this.random)
        playSoundCue(SOUND_CUES.weather.thunder)
        this.log('lightning flash', { phase: this.phase, flashAlpha: Number(this.flashAlpha.toFixed(2)) })
      }
      return
    }

    this.flashCooldownMs -= elapsedMs
    if (this.flashCooldownMs > 0) return
    this.lightningBursts = this.random() < 0.55 ? 2 : 1
    this.lightningNextBurstMs = 0
    this.flashCooldownMs = randomDuration(this.phase === 'rainHeavy' ? 8 : 12, this.phase === 'rainHeavy' ? 24 : 40, this.random)
  }

  drawRainVeil(): void {
    this.rainVeil.clear()
    const rainBoost = this.precipIntensity * 0.045
    const veilAlpha = clamp(
      VEIL_TARGETS[this.phase] * this.biomeProfile.veilMultiplier + rainBoost,
      0,
      0.2
    )
    if (veilAlpha < 0.01) return
    this.rainVeil.rect(0, 0, this.screenRect.width, this.screenRect.height)
    this.rainVeil.fill({ alpha: veilAlpha, color: this.phase === 'snow' ? 0xdce8f5 : 0x9fb2c4 })
  }

  getDarknessLevel(): number {
    return this.phase === 'night' ? 1 : 0
  }

  updatePrecipitation(elapsedSeconds: number, mapShiftX = 0, mapShiftY = 0): void {
    const baseTarget = PRECIPITATION_TARGETS[this.phase]
    const noisyTarget =
      baseTarget > 0
        ? Math.max(
            0,
            Math.min(1, baseTarget * this.biomeProfile.precipMultiplier + Math.sin(this.elapsedMs * 0.0009) * 0.045)
          )
        : 0
    this.precipIntensity = lerp(this.precipIntensity, noisyTarget, elapsedSeconds * RAIN_LERP_PER_SECOND)

    const maxParticles = this.phase === 'snow' ? MAX_SNOW_FLAKES : MAX_RAIN_DROPS
    const activeParticles =
      this.precipIntensity < 0.015 ? 0 : Math.round(maxParticles * this.precipIntensity)

    if (this.phase === 'snow') {
      for (let i = 0; i < this.raindrops.length; i++) {
        const drop = this.raindrops[i]
        if (drop.alpha !== 0) drop.alpha = 0
      }
      this.updateSnow(elapsedSeconds, activeParticles, mapShiftX, mapShiftY)
      return
    }

    for (let i = 0; i < this.snowflakes.length; i++) {
      const flake = this.snowflakes[i]
      if (flake.alpha !== 0) flake.alpha = 0
    }
    this.updateRain(elapsedSeconds, activeParticles)
  }

  updateRain(elapsedSeconds: number, activeDrops: number): void {
    const rainColor = this.precipIntensity > 0.62 ? 0xf7fbff : 0xd9e8ff
    const slantRatio = clamp(RAIN_BASE_SLANT_RATIO + this.windX * RAIN_WIND_SLANT_FACTOR, -0.32, -0.08)
    const rotation = Math.atan2(-slantRatio, 1)
    const widthScale = this.precipIntensity > 0.7 ? 1.4 : 1
    const drift = RAIN_DRIFT_PER_SECOND + this.windX * 4
    const margin = 180

    for (let i = 0; i < MAX_RAIN_DROPS; i++) {
      const drop = this.raindrops[i]
      if (i >= activeDrops) {
        if (drop.alpha !== 0) drop.alpha = 0
        continue
      }

      drop.x += (drift + drop.wobble * 18) * elapsedSeconds
      drop.y += drop.speed * elapsedSeconds * (0.76 + this.precipIntensity * 0.4)
      if (
        drop.y > this.screenRect.height + margin ||
        drop.x < -margin * 2 ||
        drop.x > this.screenRect.width + margin * 2
      ) {
        this.resetRaindrop(drop, false)
      }

      const length = drop.baseLength * (0.8 + this.precipIntensity * 0.55)
      drop.scaleY = length / RAIN_TEXTURE_HEIGHT
      drop.scaleX = widthScale
      drop.rotation = rotation
      drop.tint = rainColor
      drop.alpha = drop.baseAlpha * (0.42 + this.precipIntensity * 0.68)
    }
  }

  updateSnow(elapsedSeconds: number, activeFlakes: number, mapShiftX = 0, mapShiftY = 0): void {
    const drift = this.windX * 6
    const margin = 180

    for (let i = 0; i < MAX_SNOW_FLAKES; i++) {
      const flake = this.snowflakes[i]
      if (i >= activeFlakes) {
        if (flake.alpha !== 0) flake.alpha = 0
        continue
      }

      flake.x += mapShiftX + (drift + flake.wobble * 12) * elapsedSeconds
      flake.y += mapShiftY + flake.speed * elapsedSeconds * (0.5 + this.precipIntensity * 0.45)
      if (
        flake.y > this.screenRect.height + margin ||
        flake.x < -margin * 2 ||
        flake.x > this.screenRect.width + margin * 2
      ) {
        this.resetSnowflake(flake, false)
      }

      const scale = flake.baseScale * (0.8 + this.precipIntensity * 0.55)
      flake.scaleX = scale
      flake.scaleY = scale
      flake.rotation += flake.rotationSpeed * elapsedSeconds
      flake.tint = SNOW_COLOR
      flake.alpha = flake.baseAlpha * (0.45 + this.precipIntensity * 0.5)
    }
  }

  drawFlash(): void {
    this.flashOverlay.clear()
    if (this.flashAlpha < 0.01) return
    this.flashOverlay.rect(0, 0, this.screenRect.width, this.screenRect.height)
    this.flashOverlay.fill({ alpha: this.flashAlpha, color: 0xeaf4ff })
  }

  debugState(): object {
    return {
      activeDrops: Math.round((this.phase === 'snow' ? MAX_SNOW_FLAKES : MAX_RAIN_DROPS) * this.precipIntensity),
      nextPhaseInSeconds: Math.max(0, seconds(this.phaseEndsAt - this.elapsedMs)),
      phase: this.phase,
      biome: this.biome,
      rainIntensity: Number(this.precipIntensity.toFixed(2)),
      darknessLevel: Number(this.getDarknessLevel().toFixed(2)),
      rainSlantRatio: Number(clamp(RAIN_BASE_SLANT_RATIO + this.windX * RAIN_WIND_SLANT_FACTOR, -0.32, -0.08).toFixed(2)),
      screen: {
        height: Math.round(this.screenRect.height),
        width: Math.round(this.screenRect.width),
        x: Math.round(this.screenRect.x),
        y: Math.round(this.screenRect.y),
      },
      windX: Number(this.windX.toFixed(2)),
    }
  }

  log(message: string, data?: object): void {
    console.info(`[weather] ${message}`, data ?? '')
  }

  destroy(): void {
    this.context.app.ticker.remove(this._onTick)
    this.map.filters = this.mapFilters ? [...this.mapFilters] : null
    this.layer.destroy({ children: true })
    // Destroying the texture wrapper only, NOT its source (no `true` arg): the rain and snow
    // containers never set custom shaders, so they rely on the shared particle shader. Destroying
    // their source textures directly can trigger GL resource churn under some context-recovery paths.
    // Keeping source textures alive as tiny canvas-backed resources is harmless and avoids regressions.
    this.rainTexture.destroy()
    this.snowTexture.destroy()
    this.rainLoopLight?.stop()
    this.rainLoopHeavy?.stop()
    this.windLoopLight?.stop()
    this.windLoopHeavy?.stop()
    this.log('destroyed')
  }
}
