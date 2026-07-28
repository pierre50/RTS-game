import { Container, Graphics, type Filter } from 'pixi.js'
import { AdjustmentFilter } from 'pixi-filters'
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

type Raindrop = {
  alpha: number
  length: number
  speed: number
  wobble: number
  x: number
  y: number
}

const TARGET_FRAME_MS = 1000 / 60
const MAX_RAIN_DROPS = 620
const COLOR_LERP_PER_SECOND = 1.7
const RAIN_LERP_PER_SECOND = 1.4
const FIRST_SUNNY_MIN_SECONDS = 18
const FIRST_SUNNY_MAX_SECONDS = 45
const RAIN_BASE_SLANT_RATIO = -0.16
const RAIN_WIND_SLANT_FACTOR = 0.01
const RAIN_DRIFT_PER_SECOND = -58

const VEIL_TARGETS: Record<WeatherPhase, number> = {
  sunny: 0,
  clouding: 0.025,
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
    gamma: 0.98,
    contrast: 0.95,
    saturation: 0.68,
    brightness: 0.84,
    red: 0.92,
    green: 0.95,
    blue: 1.02,
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
  rain: Graphics
  rainVeil: Graphics
  raindrops: Raindrop[]
  rainIntensity: number
  random: RandomFn
  screenRect: ScreenRect
  tintFilter: AdjustmentFilter
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
    this.windX = randomBetween(-5, 5, this.random)
    this.windTargetX = this.windX
    this.flashAlpha = 0
    this.flashCooldownMs = randomDuration(20, 55, this.random)
    this.lightningBursts = 0
    this.lightningNextBurstMs = 0
    this.screenRect = this.getScreenRect()
    this.raindrops = Array.from({ length: MAX_RAIN_DROPS }, () => this.createRaindrop(true))

    this.tintFilter = new AdjustmentFilter(this.currentColor)
    this.mapFilters = map.filters ?? null
    map.filters = [...(this.mapFilters ?? []), this.tintFilter]

    this.layer = new Container()
    this.layer.eventMode = 'none'
    this.layer.label = 'weather-layer'
    this.rainVeil = new Graphics()
    this.rain = new Graphics()
    this.flashOverlay = new Graphics()
    this.layer.addChild(this.rainVeil, this.rain, this.flashOverlay)

    this._onTick = ticker => this.update(ticker.deltaMS ?? ticker.elapsedMS ?? TARGET_FRAME_MS)
    context.app.ticker.add(this._onTick)
    this.log('started', this.debugState())
  }

  createRaindrop(anywhere = false): Raindrop {
    const margin = 160
    return {
      x: randomBetween(-margin, this.screenRect.width + margin, this.random),
      y: anywhere ? randomBetween(-margin, this.screenRect.height + margin, this.random) : randomBetween(-margin, 0, this.random),
      speed: randomBetween(720, 1320, this.random),
      length: randomBetween(14, 34, this.random),
      alpha: randomBetween(0.18, 0.62, this.random),
      wobble: randomBetween(-1, 1, this.random),
    }
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

    this.updateColor(elapsedSeconds)
    this.drawRainVeil()
    this.updateLightning(safeElapsedMs)
    this.updateRain(elapsedSeconds)
    this.drawFlash()
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
    this.rain.clear()
    if (this.rainIntensity < 0.015) return

    const activeDrops = Math.round(MAX_RAIN_DROPS * this.rainIntensity)
    const rainColor = this.rainIntensity > 0.62 ? 0xf7fbff : 0xd9e8ff
    const slantRatio = clamp(RAIN_BASE_SLANT_RATIO + this.windX * RAIN_WIND_SLANT_FACTOR, -0.32, -0.08)
    const drift = RAIN_DRIFT_PER_SECOND + this.windX * 4
    const margin = 180

    for (let i = 0; i < activeDrops; i++) {
      const drop = this.raindrops[i]
      drop.x += (drift + drop.wobble * 18) * elapsedSeconds
      drop.y += drop.speed * elapsedSeconds * (0.76 + this.rainIntensity * 0.4)
      if (
        drop.y > this.screenRect.height + margin ||
        drop.x < -margin * 2 ||
        drop.x > this.screenRect.width + margin * 2
      ) {
        this.raindrops[i] = this.createRaindrop(false)
        continue
      }

      const length = drop.length * (0.8 + this.rainIntensity * 0.55)
      const slant = length * slantRatio
      this.rain.moveTo(drop.x, drop.y)
      this.rain.lineTo(drop.x + slant, drop.y + length)
      this.rain.stroke({
        alpha: drop.alpha * (0.42 + this.rainIntensity * 0.68),
        color: rainColor,
        width: this.rainIntensity > 0.7 ? 1.4 : 1,
      })
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
    this.log('destroyed')
  }
}
