import { Container, Graphics, ParticleContainer, type Texture } from 'pixi.js'
import { AdjustmentFilter } from 'pixi-filters'
import { SOUND_CUES, type EnvironmentId } from '../constants'
import { isGameplaySoundSuppressed, playSoundCue } from '../lib'
import { getNightAmbienceTargetVolume, NIGHT_AMBIENCE_LERP_PER_SECOND } from '../lib/audio/nightAmbience'
import { getOceanAmbienceTargetVolume, OCEAN_AMBIENCE_LERP_PER_SECOND } from '../lib/audio/oceanAmbience'
import type { GameContextLike } from '../types/context'

import {
  AMBIENT_CROSSFADE_MID,
  BIOME_WEATHER_PROFILES,
  COLOR_LERP_PER_SECOND,
  FIRST_SUNNY_MAX_SECONDS,
  FIRST_SUNNY_MIN_SECONDS,
  MAX_RAIN_DROPS,
  MAX_SAND_GRAINS,
  MAX_SNOW_FLAKES,
  PARTICLE_TARGETS,
  RAIN_BASE_SLANT_RATIO,
  RAIN_DRIFT_PER_SECOND,
  RAIN_LERP_PER_SECOND,
  RAIN_LOOP_MAX_VOLUME,
  RAIN_TEXTURE_HEIGHT,
  RAIN_WIND_SLANT_FACTOR,
  SNOW_COLOR,
  TARGET_FRAME_MS,
  VEIL_TARGETS,
  WEATHER_COLORS,
  WIND_LERP_PER_SECOND,
  WIND_LOOP_MAX_VOLUME,
  WIND_TARGETS,
  type RandomFn,
  type ScreenRect,
  type TickerLike,
  type WeatherBiomeProfile,
  type WeatherColor,
  type WeatherPhase,
} from './weather/WeatherProfiles'
import {
  addParticleDrift,
  biomeKeyFromEnvironment,
  clamp,
  combineColor,
  crossfadeVolumes,
  lerp,
  nextPhase,
  phaseDuration,
  randomBetween,
  randomDuration,
  scaleParticleTarget,
  seconds,
} from './weather/WeatherUtils'
import {
  createRainTexture,
  createSandTexture,
  createSnowTexture,
  Raindrop,
  SandGrain,
  Snowflake,
} from './weather/WeatherParticles'
import { startAmbientLoop, type WeatherLoopInstance } from './weather/WeatherAudio'
import { WeatherColorGrading, type WeatherColorMap } from './weather/WeatherColorGrading'

export class WeatherSystem {
  colorGrading: WeatherColorGrading
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
  map: WeatherColorMap
  biome: EnvironmentId
  biomeProfile: WeatherBiomeProfile
  phase: WeatherPhase
  phaseEndsAt: number
  rain: ParticleContainer
  rainTexture: Texture
  snow: ParticleContainer
  snowTexture: Texture
  sand: ParticleContainer
  sandTexture: Texture
  rainVeil: Graphics
  raindrops: Raindrop[]
  snowflakes: Snowflake[]
  sandGrains: SandGrain[]
  precipIntensity: number
  rainIntensity: number
  snowIntensity: number
  sandIntensity: number
  rainLoopHeavy: WeatherLoopInstance | null
  rainLoopLight: WeatherLoopInstance | null
  nightLoop: WeatherLoopInstance | null
  nightVolume: number
  oceanLoop: WeatherLoopInstance | null
  oceanVolume: number
  random: RandomFn
  screenRect: ScreenRect
  tintFilter: AdjustmentFilter
  lastMapX: number
  lastMapY: number
  windIntensity: number
  windLoopHeavy: WeatherLoopInstance | null
  windLoopLight: WeatherLoopInstance | null
  windX: number
  windTargetX: number
  _onTick: (ticker: TickerLike) => void

  constructor(
    context: GameContextLike,
    map: WeatherColorMap,
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
    this.rainIntensity = 0
    this.snowIntensity = 0
    this.sandIntensity = 0
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
    this.sandTexture = createSandTexture()
    this.raindrops = Array.from({ length: MAX_RAIN_DROPS }, () => this.createRaindrop(true))
    this.snowflakes = Array.from({ length: MAX_SNOW_FLAKES }, () => this.createSnowflake(true))
    this.sandGrains = Array.from({ length: MAX_SAND_GRAINS }, () => this.createSandGrain(true))

    this.tintFilter = new AdjustmentFilter(this.currentColor)
    this.colorGrading = new WeatherColorGrading(context, map, this.tintFilter, () => this.screenRect)
    this.colorGrading.sync()

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
    this.sand = new ParticleContainer({
      texture: this.sandTexture,
      dynamicProperties: { position: true, rotation: true, vertex: true, color: true },
    })
    this.sand.addParticle(...this.sandGrains)
    this.flashOverlay = new Graphics()
    this.layer.addChild(this.rainVeil, this.rain, this.snow, this.sand, this.flashOverlay)

    this.rainLoopLight = null
    this.rainLoopHeavy = null
    this.nightLoop = null
    this.nightVolume = 0
    this.oceanLoop = null
    this.oceanVolume = 0
    this.windLoopLight = null
    this.windLoopHeavy = null
    startAmbientLoop(SOUND_CUES.weather.rainLight, instance => (this.rainLoopLight = instance))
    startAmbientLoop(SOUND_CUES.weather.rainHeavy, instance => (this.rainLoopHeavy = instance))
    startAmbientLoop(SOUND_CUES.weather.windLight, instance => (this.windLoopLight = instance))
    startAmbientLoop(SOUND_CUES.weather.windHeavy, instance => (this.windLoopHeavy = instance))
    startAmbientLoop(SOUND_CUES.weather.night, instance => (this.nightLoop = instance))
    startAmbientLoop(SOUND_CUES.weather.ocean, instance => (this.oceanLoop = instance))

    this._onTick = ticker => {
      const update = () => this.update(ticker.deltaMS ?? ticker.elapsedMS ?? TARGET_FRAME_MS)
      this.context.performance?.measure?.('weather.update', update) ?? update()
    }
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

  createSandGrain(anywhere = false): SandGrain {
    const grain = new SandGrain({ texture: this.sandTexture, anchorX: 0.5, anchorY: 0.5, alpha: 0 })
    this.resetSandGrain(grain, anywhere)
    return grain
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

  resetSandGrain(grain: SandGrain, anywhere = false): void {
    const margin = 220
    grain.x = anywhere
      ? randomBetween(-margin, this.screenRect.width + margin, this.random)
      : randomBetween(this.screenRect.width, this.screenRect.width + margin * 2, this.random)
    grain.y = randomBetween(-margin, this.screenRect.height + margin, this.random)
    grain.speed = randomBetween(360, 880, this.random)
    grain.baseScale = randomBetween(0.45, 1.35, this.random)
    grain.baseAlpha = randomBetween(0.08, 0.36, this.random)
    grain.wobble = randomBetween(-1, 1, this.random)
    grain.rotation = randomBetween(-0.18, 0.08, this.random)
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
    if (this.context.paused || this.context.defeat) return
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
    if (this.phase === 'sandstorm') this.windTargetX = Math.min(this.windTargetX, -7)
    this.windX = lerp(this.windX, this.windTargetX, elapsedSeconds * 0.45)
    this.windIntensity = lerp(
      this.windIntensity,
      WIND_TARGETS[this.phase] * this.biomeProfile.windMultiplier,
      elapsedSeconds * WIND_LERP_PER_SECOND
    )

    const shouldRenderWeatherEffects = this.colorGrading.shouldRender()
    this.colorGrading.sync(shouldRenderWeatherEffects)
    this.updateColor(elapsedSeconds)
    this.updateAmbientSound(elapsedSeconds)
    if (!shouldRenderWeatherEffects || this.context.timeSkip?.suppressCosmetics) {
      this.layer.visible = false
      return
    }
    this.layer.visible = true
    this.drawRainVeil()
    this.updateLightning(safeElapsedMs)
    this.updatePrecipitation(elapsedSeconds, mapShiftX, mapShiftY)
    this.drawFlash()
  }

  updateAmbientSound(elapsedSeconds: number): void {
    if (isGameplaySoundSuppressed() || !this.colorGrading.shouldRender()) {
      this.nightVolume = 0
      this.oceanVolume = 0
      if (this.rainLoopLight) this.rainLoopLight.volume = 0
      if (this.rainLoopHeavy) this.rainLoopHeavy.volume = 0
      if (this.windLoopLight) this.windLoopLight.volume = 0
      if (this.windLoopHeavy) this.windLoopHeavy.volume = 0
      if (this.nightLoop) this.nightLoop.volume = 0
      if (this.oceanLoop) this.oceanLoop.volume = 0
      return
    }

    const rainVolumes = crossfadeVolumes(this.rainIntensity, AMBIENT_CROSSFADE_MID)
    const windVolumes = crossfadeVolumes(this.windIntensity, AMBIENT_CROSSFADE_MID)
    const nightTargetVolume = getNightAmbienceTargetVolume(this.context.dayNight?.getDarknessLevel?.())
    const hero = this.context.controls?.heroUnit
    const oceanTargetVolume =
      hero && !hero.isDead && !hero.isDestroyed
        ? getOceanAmbienceTargetVolume(this.map.grid, hero, undefined, { mapType: this.map.mapType })
        : 0
    this.nightVolume = lerp(this.nightVolume, nightTargetVolume, elapsedSeconds * NIGHT_AMBIENCE_LERP_PER_SECOND)
    this.oceanVolume = lerp(this.oceanVolume, oceanTargetVolume, elapsedSeconds * OCEAN_AMBIENCE_LERP_PER_SECOND)
    if (this.rainLoopLight) this.rainLoopLight.volume = rainVolumes.low * RAIN_LOOP_MAX_VOLUME
    if (this.rainLoopHeavy) this.rainLoopHeavy.volume = rainVolumes.high * RAIN_LOOP_MAX_VOLUME
    if (this.windLoopLight) this.windLoopLight.volume = windVolumes.low * WIND_LOOP_MAX_VOLUME
    if (this.windLoopHeavy) this.windLoopHeavy.volume = windVolumes.high * WIND_LOOP_MAX_VOLUME
    if (this.nightLoop) this.nightLoop.volume = this.nightVolume
    if (this.oceanLoop) this.oceanLoop.volume = this.oceanVolume
  }

  updateColor(elapsedSeconds: number): void {
    const target = combineColor(
      this.context.dayNight?.getColorAdjustment?.() ?? WEATHER_COLORS.sunny,
      WEATHER_COLORS[this.phase]
    )
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
    this.flashCooldownMs = randomDuration(
      this.phase === 'rainHeavy' ? 8 : 12,
      this.phase === 'rainHeavy' ? 24 : 40,
      this.random
    )
  }

  drawRainVeil(): void {
    this.rainVeil.clear()
    const precipitationBoost = Math.max(this.rainIntensity, this.snowIntensity, this.sandIntensity) * 0.045
    const veilAlpha = clamp(VEIL_TARGETS[this.phase] * this.biomeProfile.veilMultiplier + precipitationBoost, 0, 0.2)
    if (veilAlpha < 0.01) return
    this.rainVeil.rect(0, 0, this.screenRect.width, this.screenRect.height)
    const color =
      this.sandIntensity > Math.max(this.rainIntensity, this.snowIntensity)
        ? 0xc9974a
        : this.snowIntensity > this.rainIntensity
          ? 0xdce8f5
          : 0x9fb2c4
    this.rainVeil.fill({ alpha: veilAlpha, color })
  }

  updatePrecipitation(elapsedSeconds: number, mapShiftX = 0, mapShiftY = 0): void {
    const targets = scaleParticleTarget(PARTICLE_TARGETS[this.phase], this.biomeProfile.precipMultiplier)
    const amount = elapsedSeconds * RAIN_LERP_PER_SECOND
    this.rainIntensity = lerp(this.rainIntensity, addParticleDrift(targets.rain, this.elapsedMs), amount)
    this.snowIntensity = lerp(this.snowIntensity, addParticleDrift(targets.snow, this.elapsedMs + 900), amount)
    this.sandIntensity = lerp(this.sandIntensity, addParticleDrift(targets.sand, this.elapsedMs + 1800), amount)
    this.precipIntensity = Math.max(this.rainIntensity, this.snowIntensity, this.sandIntensity)

    const activeDrops = this.rainIntensity < 0.015 ? 0 : Math.round(MAX_RAIN_DROPS * this.rainIntensity)
    const activeFlakes = this.snowIntensity < 0.015 ? 0 : Math.round(MAX_SNOW_FLAKES * this.snowIntensity)
    const activeGrains = this.sandIntensity < 0.015 ? 0 : Math.round(MAX_SAND_GRAINS * this.sandIntensity)

    this.updateRain(elapsedSeconds, activeDrops, this.rainIntensity)
    this.updateSnow(elapsedSeconds, activeFlakes, this.snowIntensity, mapShiftX, mapShiftY)
    this.updateSandstorm(elapsedSeconds, activeGrains, this.sandIntensity, mapShiftX, mapShiftY)
  }

  updateRain(elapsedSeconds: number, activeDrops: number, intensity = this.rainIntensity): void {
    const rainColor = intensity > 0.62 ? 0xf7fbff : 0xd9e8ff
    const slantRatio = clamp(RAIN_BASE_SLANT_RATIO + this.windX * RAIN_WIND_SLANT_FACTOR, -0.32, -0.08)
    const rotation = Math.atan2(-slantRatio, 1)
    const widthScale = intensity > 0.7 ? 1.4 : 1
    const drift = RAIN_DRIFT_PER_SECOND + this.windX * 4
    const margin = 180

    for (let i = 0; i < MAX_RAIN_DROPS; i++) {
      const drop = this.raindrops[i]
      if (i >= activeDrops) {
        if (drop.alpha !== 0) drop.alpha = 0
        continue
      }

      drop.x += (drift + drop.wobble * 18) * elapsedSeconds
      drop.y += drop.speed * elapsedSeconds * (0.76 + intensity * 0.4)
      if (
        drop.y > this.screenRect.height + margin ||
        drop.x < -margin * 2 ||
        drop.x > this.screenRect.width + margin * 2
      ) {
        this.resetRaindrop(drop, false)
      }

      const length = drop.baseLength * (0.8 + intensity * 0.55)
      drop.scaleY = length / RAIN_TEXTURE_HEIGHT
      drop.scaleX = widthScale
      drop.rotation = rotation
      drop.tint = rainColor
      drop.alpha = drop.baseAlpha * (0.42 + intensity * 0.68)
    }
  }

  updateSnow(
    elapsedSeconds: number,
    activeFlakes: number,
    intensity = this.snowIntensity,
    mapShiftX = 0,
    mapShiftY = 0
  ): void {
    const drift = this.windX * 6
    const margin = 180

    for (let i = 0; i < MAX_SNOW_FLAKES; i++) {
      const flake = this.snowflakes[i]
      if (i >= activeFlakes) {
        if (flake.alpha !== 0) flake.alpha = 0
        continue
      }

      flake.x += mapShiftX + (drift + flake.wobble * 12) * elapsedSeconds
      flake.y += mapShiftY + flake.speed * elapsedSeconds * (0.5 + intensity * 0.45)
      if (
        flake.y > this.screenRect.height + margin ||
        flake.x < -margin * 2 ||
        flake.x > this.screenRect.width + margin * 2
      ) {
        this.resetSnowflake(flake, false)
      }

      const scale = flake.baseScale * (0.8 + intensity * 0.55)
      flake.scaleX = scale
      flake.scaleY = scale
      flake.rotation += flake.rotationSpeed * elapsedSeconds
      flake.tint = SNOW_COLOR
      flake.alpha = flake.baseAlpha * (0.45 + intensity * 0.5)
    }
  }

  updateSandstorm(
    elapsedSeconds: number,
    activeGrains: number,
    intensity = this.sandIntensity,
    mapShiftX = 0,
    mapShiftY = 0
  ): void {
    const drift = -Math.max(520, Math.abs(this.windX) * 92)
    const margin = 220

    for (let i = 0; i < MAX_SAND_GRAINS; i++) {
      const grain = this.sandGrains[i]
      if (i >= activeGrains) {
        if (grain.alpha !== 0) grain.alpha = 0
        continue
      }

      grain.x += mapShiftX + (drift + grain.wobble * 42) * elapsedSeconds
      grain.y += mapShiftY + Math.sin(this.elapsedMs * 0.004 + i) * elapsedSeconds * 34
      if (
        grain.x < -margin * 2 ||
        grain.x > this.screenRect.width + margin * 2 ||
        grain.y < -margin * 2 ||
        grain.y > this.screenRect.height + margin * 2
      ) {
        this.resetSandGrain(grain, false)
      }

      const scale = grain.baseScale * (0.9 + intensity * 0.55)
      grain.scaleX = scale * (1.2 + intensity * 0.8)
      grain.scaleY = scale
      grain.tint = intensity > 0.72 ? 0xf1c979 : 0xd8a953
      grain.alpha = grain.baseAlpha * (0.5 + intensity * 0.78)
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
      activeDrops: Math.round(
        MAX_RAIN_DROPS * this.rainIntensity +
          MAX_SNOW_FLAKES * this.snowIntensity +
          MAX_SAND_GRAINS * this.sandIntensity
      ),
      nextPhaseInSeconds: Math.max(0, seconds(this.phaseEndsAt - this.elapsedMs)),
      phase: this.phase,
      biome: this.biome,
      rainIntensity: Number(this.rainIntensity.toFixed(2)),
      snowIntensity: Number(this.snowIntensity.toFixed(2)),
      sandIntensity: Number(this.sandIntensity.toFixed(2)),
      darknessLevel: this.phase === 'night' ? 1 : 0,
      rainSlantRatio: Number(
        clamp(RAIN_BASE_SLANT_RATIO + this.windX * RAIN_WIND_SLANT_FACTOR, -0.32, -0.08).toFixed(2)
      ),
      screen: {
        height: Math.round(this.screenRect.height),
        width: Math.round(this.screenRect.width),
        x: Math.round(this.screenRect.x),
        y: Math.round(this.screenRect.y),
      },
      windX: Number(this.windX.toFixed(2)),
      nightVolume: Number(this.nightVolume.toFixed(2)),
      oceanVolume: Number(this.oceanVolume.toFixed(2)),
    }
  }

  log(message: string, data?: object): void {
    console.info(`[weather] ${message}`, data ?? '')
  }

  destroy(): void {
    this.context.app.ticker.remove(this._onTick)
    this.colorGrading.destroy()
    this.layer.destroy({ children: true })
    this.rainTexture.destroy()
    this.snowTexture.destroy()
    this.sandTexture.destroy()
    this.rainLoopLight?.stop()
    this.rainLoopHeavy?.stop()
    this.windLoopLight?.stop()
    this.windLoopHeavy?.stop()
    this.nightLoop?.stop()
    this.oceanLoop?.stop()
    this.log('destroyed')
  }
}
