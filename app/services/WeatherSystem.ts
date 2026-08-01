import { Container, Graphics, Particle, ParticleContainer, Texture, type Filter } from 'pixi.js'
import { AdjustmentFilter } from 'pixi-filters'
import { sound, type IMediaInstance } from '@pixi/sound'
import { SOUND_CUES } from '../constants'
import { playSoundCue } from '../lib'
import type { GameContextLike } from '../types/context'
import type { RuntimeMap } from '../types/map'

type WeatherPhase = 'sunny' | 'clouding' | 'stormBuildUp' | 'rainLight' | 'rainHeavy' | 'clearing'
type ScreenRect = { height: number; width: number; x: number; y: number }
type RandomFn = () => number
type TickerLike = { deltaMS?: number; elapsedMS?: number; deltaTime?: number }

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
const RAIN_TEXTURE_WIDTH = 3
const RAIN_TEXTURE_HEIGHT = 32
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

const VEIL_TARGETS: Record<WeatherPhase, number> = {
  sunny: 0,
  clouding: 0.01,
  stormBuildUp: 0.075,
  rainLight: 0.08,
  rainHeavy: 0.14,
  clearing: 0.035,
}

const WEATHER_COLORS: Record<WeatherPhase, WeatherColor> = {
  sunny: {
    gamma: 1,
    contrast: 1.04,
    saturation: 1.08,
    brightness: 1.04,
    red: 1.04,
    green: 1.02,
    blue: 0.96,
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
  clearing: {
    gamma: 0.99,
    contrast: 0.98,
    saturation: 0.82,
    brightness: 0.9,
    red: 0.96,
    green: 0.98,
    blue: 1,
  },
}

const RAIN_TARGETS: Record<WeatherPhase, number> = {
  sunny: 0,
  clouding: 0,
  stormBuildUp: 0.04,
  rainLight: 0.34,
  rainHeavy: 1,
  clearing: 0.08,
}

const WIND_TARGETS: Record<WeatherPhase, number> = {
  sunny: 0,
  clouding: 0.08,
  stormBuildUp: 0.55,
  rainLight: 0.3,
  rainHeavy: 0.85,
  clearing: 0.15,
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

function nextPhase(phase: WeatherPhase, random: RandomFn): WeatherPhase {
  const roll = random()
  if (phase === 'sunny') return roll < 0.62 ? 'clouding' : 'sunny'
  if (phase === 'clouding') {
    if (roll < 0.42) return 'clearing'
    if (roll < 0.7) return 'rainLight'
    if (roll < 0.86) return 'stormBuildUp'
    return 'sunny'
  }
  if (phase === 'stormBuildUp') {
    if (roll < 0.22) return 'clearing'
    if (roll < 0.58) return 'rainLight'
    if (roll < 0.82) return 'rainHeavy'
    return 'clouding'
  }
  if (phase === 'rainLight') {
    if (roll < 0.48) return 'clearing'
    if (roll < 0.72) return 'clouding'
    if (roll < 0.9) return 'rainHeavy'
    return 'rainLight'
  }
  if (phase === 'rainHeavy') {
    if (roll < 0.5) return 'rainLight'
    if (roll < 0.86) return 'clearing'
    return 'stormBuildUp'
  }
  return 'sunny'
}

function phaseDuration(phase: WeatherPhase, random: RandomFn): number {
  if (phase === 'sunny') return randomDuration(360, 720, random)
  if (phase === 'clouding') return randomDuration(45, 120, random)
  if (phase === 'stormBuildUp') return randomDuration(25, 70, random)
  if (phase === 'rainLight') return randomDuration(90, 260, random)
  if (phase === 'rainHeavy') return randomDuration(45, 180, random)
  return randomDuration(60, 150, random)
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
  phase: WeatherPhase
  phaseEndsAt: number
  rain: ParticleContainer
  rainTexture: Texture
  rainVeil: Graphics
  raindrops: Raindrop[]
  rainIntensity: number
  rainLoopHeavy: IMediaInstance | null
  rainLoopLight: IMediaInstance | null
  random: RandomFn
  screenRect: ScreenRect
  tintFilter: AdjustmentFilter
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
    this.phase = 'sunny'
    this.elapsedMs = 0
    this.phaseEndsAt = randomDuration(FIRST_SUNNY_MIN_SECONDS, FIRST_SUNNY_MAX_SECONDS, this.random)
    this.currentColor = { ...WEATHER_COLORS.sunny }
    this.rainIntensity = 0
    this.windIntensity = 0
    this.windX = randomBetween(-5, 5, this.random)
    this.windTargetX = this.windX
    this.flashAlpha = 0
    this.flashCooldownMs = randomDuration(20, 55, this.random)
    this.lightningBursts = 0
    this.lightningNextBurstMs = 0
    this.screenRect = this.getScreenRect()
    this.rainTexture = createRainTexture()
    this.raindrops = Array.from({ length: MAX_RAIN_DROPS }, () => this.createRaindrop(true))

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
    this.flashOverlay = new Graphics()
    this.layer.addChild(this.rainVeil, this.rain, this.flashOverlay)

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

  forcePhase(phase: WeatherPhase): void {
    this.phase = phase
    this.phaseEndsAt = this.elapsedMs + phaseDuration(phase, this.random)
    if (phase === 'stormBuildUp' || phase === 'rainHeavy') this.flashCooldownMs = randomDuration(2, 7, this.random)
    this.log('forced phase', this.debugState())
  }

  advancePhase(): void {
    const previousPhase = this.phase
    this.phase = nextPhase(this.phase, this.random)
    this.phaseEndsAt = this.elapsedMs + phaseDuration(this.phase, this.random)
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

    this.screenRect = this.getScreenRect()
    this.layer.position.set(this.screenRect.x, this.screenRect.y)
    this.windTargetX += Math.sin(this.elapsedMs * 0.00019) * 0.006
    this.windTargetX = Math.max(-12, Math.min(12, this.windTargetX))
    this.windX = lerp(this.windX, this.windTargetX, elapsedSeconds * 0.45)
    this.windIntensity = lerp(this.windIntensity, WIND_TARGETS[this.phase], elapsedSeconds * WIND_LERP_PER_SECOND)

    this.updateColor(elapsedSeconds)
    this.drawRainVeil()
    this.updateLightning(safeElapsedMs)
    this.updateRain(elapsedSeconds)
    this.updateAmbientSound()
    this.drawFlash()
  }

  updateAmbientSound(): void {
    const rainVolumes = crossfadeVolumes(this.rainIntensity, AMBIENT_CROSSFADE_MID)
    const windVolumes = crossfadeVolumes(this.windIntensity, AMBIENT_CROSSFADE_MID)
    if (this.rainLoopLight) this.rainLoopLight.volume = rainVolumes.low * RAIN_LOOP_MAX_VOLUME
    if (this.rainLoopHeavy) this.rainLoopHeavy.volume = rainVolumes.high * RAIN_LOOP_MAX_VOLUME
    if (this.windLoopLight) this.windLoopLight.volume = windVolumes.low * WIND_LOOP_MAX_VOLUME
    if (this.windLoopHeavy) this.windLoopHeavy.volume = windVolumes.high * WIND_LOOP_MAX_VOLUME
  }

  updateColor(elapsedSeconds: number): void {
    const target = WEATHER_COLORS[this.phase]
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
    const rainBoost = this.rainIntensity * 0.045
    const veilAlpha = clamp(VEIL_TARGETS[this.phase] + rainBoost, 0, 0.18)
    if (veilAlpha < 0.01) return
    this.rainVeil.rect(0, 0, this.screenRect.width, this.screenRect.height)
    this.rainVeil.fill({ alpha: veilAlpha, color: 0x9fb2c4 })
  }

  updateRain(elapsedSeconds: number): void {
    const rainTarget = RAIN_TARGETS[this.phase]
    const noisyTarget =
      rainTarget > 0 ? Math.max(0, Math.min(1, rainTarget + Math.sin(this.elapsedMs * 0.0009) * 0.045)) : 0
    this.rainIntensity = lerp(this.rainIntensity, noisyTarget, elapsedSeconds * RAIN_LERP_PER_SECOND)

    const activeDrops = this.rainIntensity < 0.015 ? 0 : Math.round(MAX_RAIN_DROPS * this.rainIntensity)
    const rainColor = this.rainIntensity > 0.62 ? 0xf7fbff : 0xd9e8ff
    const slantRatio = clamp(RAIN_BASE_SLANT_RATIO + this.windX * RAIN_WIND_SLANT_FACTOR, -0.32, -0.08)
    const rotation = Math.atan2(-slantRatio, 1)
    const widthScale = this.rainIntensity > 0.7 ? 1.4 : 1
    const drift = RAIN_DRIFT_PER_SECOND + this.windX * 4
    const margin = 180

    for (let i = 0; i < MAX_RAIN_DROPS; i++) {
      const drop = this.raindrops[i]
      if (i >= activeDrops) {
        if (drop.alpha !== 0) drop.alpha = 0
        continue
      }

      drop.x += (drift + drop.wobble * 18) * elapsedSeconds
      drop.y += drop.speed * elapsedSeconds * (0.76 + this.rainIntensity * 0.4)
      if (
        drop.y > this.screenRect.height + margin ||
        drop.x < -margin * 2 ||
        drop.x > this.screenRect.width + margin * 2
      ) {
        this.resetRaindrop(drop, false)
      }

      const length = drop.baseLength * (0.8 + this.rainIntensity * 0.55)
      drop.scaleY = length / RAIN_TEXTURE_HEIGHT
      drop.scaleX = widthScale
      drop.rotation = rotation
      drop.tint = rainColor
      drop.alpha = drop.baseAlpha * (0.42 + this.rainIntensity * 0.68)
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
      activeDrops: Math.round(MAX_RAIN_DROPS * this.rainIntensity),
      nextPhaseInSeconds: Math.max(0, seconds(this.phaseEndsAt - this.elapsedMs)),
      phase: this.phase,
      rainIntensity: Number(this.rainIntensity.toFixed(2)),
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
    // Destroying the texture wrapper only, NOT its source (no `true` arg): the rain
    // ParticleContainer never sets its own `.shader`, so it renders through
    // ParticleContainerPipe's single `defaultShader`, shared by every ParticleContainer
    // for the renderer's entire lifetime. That shader's BindGroup keeps whatever texture
    // source was last bound as its uTexture resource. Destroying the source fires a
    // "change" event with `destroyed: true`, which BindGroup.onResourceChange treats as
    // permanent: it nulls out `this.resources` for good (see BindGroup.destroy in
    // pixi.js/lib/rendering/renderers/gpu/shader/BindGroup.mjs). Every later map's
    // WeatherSystem then crashes the instant it renders its own rain particles, in
    // GlParticleContainerAdaptor, with "Cannot read properties of null (reading '0')" —
    // this was the actual root cause, not just GC eviction timing. Leaving the source
    // alive (undestroyed, just orphaned) is harmless: it's a tiny 3x32 canvas texture.
    this.rainTexture.destroy()
    this.rainLoopLight?.stop()
    this.rainLoopHeavy?.stop()
    this.windLoopLight?.stop()
    this.windLoopHeavy?.stop()
    this.log('destroyed')
  }
}
