import { Container, Sprite, Texture } from 'pixi.js'
import { FADE_DURATION_MS, UNIT_TYPES } from '../constants'
import { getInstanceScreenBounds } from '../lib/grid/visibility'
import type { GameContextLike } from '../types/context'
import type { EntityLightSourceConfig, RuntimeEntity, UnitEntity } from '../types/entities'

type ScreenRect = { height: number; width: number; x: number; y: number }
type TickerLike = { deltaMS?: number; elapsedMS?: number; deltaTime?: number }
type LightSource = {
  color: string
  fadeOutMs?: number
  intensity: number
  radius: number
  shouldFadeWhenMissing?: () => boolean
  verticalScale: number
  x: number
  y: number
}
type FadingLightSource = LightSource & {
  fadeElapsedMs: number
  fadeStartIntensity: number
}
type ViewportLightMetrics = {
  visibleHeight: number
  visibleLeft: number
  visibleTop: number
  visibleWidth: number
  zoom?: number
}
type DisplayLightSourceTarget = {
  children?: DisplayLightSourceTarget[]
  destroyed?: boolean
  label?: string
  lightSource?: EntityLightSourceConfig | null
  visible?: boolean
  x?: number
  y?: number
}

const TARGET_FRAME_MS = 1000 / 60
const LIGHT_FADE_IN_MS = FADE_DURATION_MS * 0.25
const LIGHT_FADE_OUT_MS = FADE_DURATION_MS * 0.35
const HERO_LIGHT_RADIUS = 320
const HERO_LIGHT_CENTER_OFFSET_Y = -22
const HERO_LIGHT_VERTICAL_SCALE = 0.76
const VILLAGER_LIGHT: EntityLightSourceConfig = {
  color: '#ffc06f',
  flicker: 0.05,
  intensity: 0.82,
  offsetY: -16,
  radius: 210,
  verticalScale: 0.7,
}
const DEFAULT_ENTITY_LIGHT_COLOR = '255,172,76'
const DEFAULT_ENTITY_LIGHT_FLICKER = 0.08
const DEFAULT_ENTITY_LIGHT_INTENSITY = 1.02
const DEFAULT_ENTITY_LIGHT_RADIUS = 190
const DEFAULT_ENTITY_LIGHT_VERTICAL_SCALE = 0.7
const DARKNESS_LERP_PER_SECOND = 5
const MAX_DARKNESS_ALPHA = 0.96
const GLOW_ALPHA = 0.11

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function lerp(current: number, target: number, amount: number): number {
  return current + (target - current) * clamp(amount, 0, 1)
}

function normalizeLightColor(color?: string): string {
  if (!color) return DEFAULT_ENTITY_LIGHT_COLOR
  const hex = color.trim().match(/^#?([0-9a-f]{6})$/i)
  if (!hex) return color
  const value = Number.parseInt(hex[1], 16)
  return `${(value >> 16) & 255},${(value >> 8) & 255},${value & 255}`
}

function isLightSourceConfig(value: unknown): value is EntityLightSourceConfig {
  return Boolean(value && typeof value === 'object')
}

function isPlayedVillager(unit: RuntimeEntity): unit is UnitEntity {
  return unit.type === UNIT_TYPES.villager && unit.owner?.isPlayed === true
}

function shouldUseVillagerLight(unit: RuntimeEntity): boolean {
  if (!isPlayedVillager(unit)) return false
  return !(unit.shelterState?.status === 'outside' && unit.shelterState.reason === 'sleep')
}

function shouldFadeMissingVillagerLight(unit: UnitEntity): boolean {
  return unit.shelterState?.location !== 'shelter'
}

export class LightSystem {
  canvas: HTMLCanvasElement
  context: GameContextLike
  activeLightElapsedMs: number | null
  currentDarkness: number
  getDarknessLevel: () => number
  getScreenRect: () => ScreenRect
  layer: Container
  fadingLights: Map<string, FadingLightSource>
  lightFadeRatios: Map<string, number>
  lights: LightSource[]
  previousLightFadeRatios: Map<string, number>
  trackedLights: Map<string, LightSource>
  screenRect: ScreenRect
  sprite: Sprite
  texture: Texture
  _onTick: (ticker: TickerLike) => void

  constructor(context: GameContextLike, getScreenRect: () => ScreenRect, getDarknessLevel: () => number) {
    this.context = context
    this.activeLightElapsedMs = null
    this.getScreenRect = getScreenRect
    this.getDarknessLevel = getDarknessLevel
    this.screenRect = this.getScreenRect()
    this.currentDarkness = 0
    this.fadingLights = new Map()
    this.lightFadeRatios = new Map()
    this.lights = []
    this.previousLightFadeRatios = new Map()
    this.trackedLights = new Map()

    this.canvas = document.createElement('canvas')
    this.resizeCanvas(this.screenRect)
    this.texture = Texture.from(this.canvas)
    this.texture.source.autoGarbageCollect = false
    this.sprite = new Sprite(this.texture)
    this.sprite.eventMode = 'none'
    this.sprite.width = this.screenRect.width
    this.sprite.height = this.screenRect.height

    this.layer = new Container()
    this.layer.eventMode = 'none'
    this.layer.label = 'light-layer'
    this.layer.addChild(this.sprite)

    this._onTick = ticker => {
      const update = () => this.update(ticker.deltaMS ?? ticker.elapsedMS ?? TARGET_FRAME_MS)
      this.context.performance?.measure?.('light.update', update) ?? update()
    }
    context.app.ticker.add(this._onTick)
  }

  update(elapsedMs: number): void {
    if (this.context.paused || this.context.defeat) return
    const elapsedSeconds = Math.min(Math.max(elapsedMs, 0), 250) / 1000
    this.screenRect = this.getScreenRect()
    this.layer.position.set(this.screenRect.x, this.screenRect.y)
    this.resizeCanvas(this.screenRect)

    const targetDarkness = clamp(this.getDarknessLevel(), 0, 1)
    this.currentDarkness = lerp(this.currentDarkness, targetDarkness, elapsedSeconds * DARKNESS_LERP_PER_SECOND)
    if (this.currentDarkness < 0.01) {
      this.layer.visible = false
      return
    }

    this.layer.visible = true
    this.updateLights(elapsedMs)
    this.draw()
  }

  resizeCanvas(screenRect: ScreenRect): void {
    const width = Math.max(1, Math.ceil(screenRect.width))
    const height = Math.max(1, Math.ceil(screenRect.height))
    if (this.canvas.width !== width) this.canvas.width = width
    if (this.canvas.height !== height) this.canvas.height = height
    if (this.sprite) {
      this.sprite.width = screenRect.width
      this.sprite.height = screenRect.height
    }
  }

  updateLights(elapsedMs: number = TARGET_FRAME_MS): void {
    const previousTrackedLights = this.trackedLights
    this.previousLightFadeRatios = this.lightFadeRatios
    this.activeLightElapsedMs = elapsedMs
    this.lightFadeRatios = new Map()
    this.trackedLights = new Map()
    this.lights.length = 0
    const hero = this.context.controls?.heroUnit
    const viewport = this.context.controls?.getViewportMetrics?.() as ViewportLightMetrics | undefined
    if (!viewport) {
      this.activeLightElapsedMs = null
      return
    }
    const visibleLeft = viewport?.visibleLeft ?? this.context.controls.camera.x
    const visibleTop = viewport?.visibleTop ?? this.context.controls.camera.y
    const zoom = Math.max(0.1, viewport?.zoom ?? 1)
    const now = performance.now()
    const heroFlicker = 1.08 + Math.sin(now * 0.006) * 0.025 + Math.sin(now * 0.013) * 0.012

    if (hero && !hero.isDead && !hero.isDestroyed) {
      this.addTrackedLightSource('hero', {
        color: '255,198,96',
        fadeOutMs: LIGHT_FADE_OUT_MS,
        intensity: clamp(heroFlicker, 1, 1.16),
        radius: HERO_LIGHT_RADIUS / zoom,
        verticalScale: HERO_LIGHT_VERTICAL_SCALE,
        x: hero.x - visibleLeft,
        y: hero.y - visibleTop + HERO_LIGHT_CENTER_OFFSET_Y / zoom,
      })
    }

    this.collectEntityLights(visibleLeft, visibleTop, zoom, now)
    this.fadeMissingLights(previousTrackedLights)
    this.updateFadingLights(elapsedMs)
    this.activeLightElapsedMs = null
  }

  collectEntityLights(visibleLeft: number, visibleTop: number, zoom: number, now: number): void {
    const buckets = this.context.map?.instanceBuckets
    const controls = this.context.controls
    if (!buckets || !controls) return

    const seen = new Set<RuntimeEntity>()
    for (const column of buckets) {
      for (const bucket of column) {
        for (const instance of bucket as Set<RuntimeEntity>) {
          if (seen.has(instance)) continue
          seen.add(instance)
          this.addEntityLights(instance, visibleLeft, visibleTop, zoom, now)
        }
      }
    }
  }

  addEntityLights(instance: RuntimeEntity, visibleLeft: number, visibleTop: number, zoom: number, now: number): void {
    if (
      instance.isDead ||
      instance.isDestroyed ||
      instance.visible === false ||
      !this.context.controls?.instanceInCamera(instance, getInstanceScreenBounds(instance))
    ) {
      return
    }

    this.addLightSource(instance, instance, 0, 0, visibleLeft, visibleTop, zoom, now)
    this.addImplicitUnitLightSource(instance, visibleLeft, visibleTop, zoom, now)
    const children = (instance as RuntimeEntity & { children?: DisplayLightSourceTarget[] }).children ?? []
    for (const child of children) {
      this.addChildLightSources(
        instance,
        child,
        typeof child.x === 'number' ? child.x : 0,
        typeof child.y === 'number' ? child.y : 0,
        visibleLeft,
        visibleTop,
        zoom,
        now
      )
    }
  }

  addImplicitUnitLightSource(
    instance: RuntimeEntity,
    visibleLeft: number,
    visibleTop: number,
    zoom: number,
    now: number
  ): void {
    if (!isPlayedVillager(instance) || !shouldUseVillagerLight(instance) || isLightSourceConfig(instance.lightSource))
      return
    const unit = instance
    this.addConfiguredLightSource(unit, VILLAGER_LIGHT, 0, 0, visibleLeft, visibleTop, zoom, now, {
      key: `villager:${unit.label}`,
      shouldFadeWhenMissing: () => shouldFadeMissingVillagerLight(unit),
    })
  }

  addChildLightSources(
    instance: RuntimeEntity,
    source: DisplayLightSourceTarget,
    localX: number,
    localY: number,
    visibleLeft: number,
    visibleTop: number,
    zoom: number,
    now: number
  ): void {
    this.addLightSource(instance, source, localX, localY, visibleLeft, visibleTop, zoom, now)

    const children = source.children ?? []
    for (const child of children) {
      this.addChildLightSources(
        instance,
        child,
        localX + (typeof child.x === 'number' ? child.x : 0),
        localY + (typeof child.y === 'number' ? child.y : 0),
        visibleLeft,
        visibleTop,
        zoom,
        now
      )
    }
  }

  addLightSource(
    instance: RuntimeEntity,
    source: DisplayLightSourceTarget,
    localX: number,
    localY: number,
    visibleLeft: number,
    visibleTop: number,
    zoom: number,
    now: number
  ): void {
    const config = source.lightSource
    if (!isLightSourceConfig(config) || source.destroyed || source.visible === false) return

    this.addConfiguredLightSource(instance, config, localX, localY, visibleLeft, visibleTop, zoom, now, {
      key: `entity:${instance.label}:${source === instance ? 'root' : source.label || `${localX}:${localY}`}`,
    })
  }

  addConfiguredLightSource(
    instance: RuntimeEntity,
    config: EntityLightSourceConfig,
    localX: number,
    localY: number,
    visibleLeft: number,
    visibleTop: number,
    zoom: number,
    now: number,
    tracking?: { key?: string; shouldFadeWhenMissing?: () => boolean }
  ): void {
    const flicker = clamp(config.flicker ?? DEFAULT_ENTITY_LIGHT_FLICKER, 0, 0.5)
    const flickerRatio = flicker ? 1 + Math.sin(now * 0.007 + instance.i * 0.37 + instance.j * 0.19) * flicker : 1
    const offsetX = (config.offsetX ?? 0) / zoom
    const offsetY = (config.offsetY ?? 0) / zoom

    this.addTrackedLightSource(tracking?.key, {
      x: instance.x - visibleLeft + localX / zoom + offsetX,
      y: instance.y - visibleTop + localY / zoom + offsetY,
      fadeOutMs: LIGHT_FADE_OUT_MS,
      radius: Math.max(1, (config.radius ?? DEFAULT_ENTITY_LIGHT_RADIUS) / zoom),
      intensity: clamp((config.intensity ?? DEFAULT_ENTITY_LIGHT_INTENSITY) * flickerRatio, 0, 1.4),
      shouldFadeWhenMissing: tracking?.shouldFadeWhenMissing,
      verticalScale: clamp(config.verticalScale ?? DEFAULT_ENTITY_LIGHT_VERTICAL_SCALE, 0.2, 1.4),
      color: normalizeLightColor(config.color),
    })
  }

  addTrackedLightSource(key: string | undefined, light: LightSource): void {
    let renderedLight = light
    if (key) {
      const resumedFade = this.fadingLights.get(key)
      const previousRatio =
        this.previousLightFadeRatios.get(key) ??
        (resumedFade ? clamp(resumedFade.intensity / Math.max(0.001, light.intensity), 0, 1) : null)
      const fadeRatio =
        this.activeLightElapsedMs == null
          ? 1
          : clamp((previousRatio ?? 0) + this.activeLightElapsedMs / LIGHT_FADE_IN_MS, 0, 1)
      renderedLight = { ...light, intensity: light.intensity * fadeRatio }
      this.lightFadeRatios.set(key, fadeRatio)
      this.trackedLights.set(key, renderedLight)
      this.fadingLights.delete(key)
    }
    this.lights.push(renderedLight)
  }

  fadeMissingLights(previousTrackedLights: Map<string, LightSource>): void {
    for (const [key, light] of previousTrackedLights) {
      if (this.trackedLights.has(key) || this.fadingLights.has(key)) continue
      if (light.shouldFadeWhenMissing && !light.shouldFadeWhenMissing()) continue
      this.fadingLights.set(key, {
        ...light,
        fadeElapsedMs: 0,
        fadeStartIntensity: light.intensity,
      })
    }
  }

  updateFadingLights(elapsedMs: number): void {
    for (const [key, light] of this.fadingLights) {
      light.fadeElapsedMs += elapsedMs
      const fadeRatio = 1 - clamp(light.fadeElapsedMs / (light.fadeOutMs ?? LIGHT_FADE_OUT_MS), 0, 1)
      if (fadeRatio <= 0) {
        this.fadingLights.delete(key)
        continue
      }
      this.lights.push({
        ...light,
        intensity: light.fadeStartIntensity * fadeRatio,
      })
    }
  }

  draw(): void {
    const ctx = this.canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    const alpha = MAX_DARKNESS_ALPHA * this.currentDarkness
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = `rgba(1, 5, 15, ${alpha})`
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    ctx.globalCompositeOperation = 'destination-out'
    for (const light of this.lights) this.drawLightCutout(ctx, light)

    ctx.globalCompositeOperation = 'source-over'
    for (const light of this.lights) this.drawWarmGlow(ctx, light)
    ctx.globalCompositeOperation = 'source-over'
    this.texture.source.update()
  }

  drawLightCutout(ctx: CanvasRenderingContext2D, light: LightSource): void {
    const radius = light.radius * light.intensity
    ctx.save()
    ctx.translate(light.x, light.y)
    ctx.scale(1, light.verticalScale)
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius)
    gradient.addColorStop(0, 'rgba(0,0,0,0.96)')
    gradient.addColorStop(0.32, 'rgba(0,0,0,0.9)')
    gradient.addColorStop(0.58, 'rgba(0,0,0,0.46)')
    gradient.addColorStop(0.82, 'rgba(0,0,0,0.14)')
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(0, 0, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  drawWarmGlow(ctx: CanvasRenderingContext2D, light: LightSource): void {
    const radius = light.radius * 0.86 * light.intensity
    ctx.save()
    ctx.translate(light.x, light.y)
    ctx.scale(1, light.verticalScale)
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius)
    gradient.addColorStop(0, `rgba(${light.color}, ${GLOW_ALPHA * this.currentDarkness})`)
    gradient.addColorStop(0.45, `rgba(${light.color}, ${GLOW_ALPHA * 0.42 * this.currentDarkness})`)
    gradient.addColorStop(1, `rgba(${light.color}, 0)`)
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(0, 0, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  debugState(): object {
    return {
      darkness: Number(this.currentDarkness.toFixed(2)),
      lights: this.lights.length,
      screen: {
        height: Math.round(this.screenRect.height),
        width: Math.round(this.screenRect.width),
        x: Math.round(this.screenRect.x),
        y: Math.round(this.screenRect.y),
      },
    }
  }

  destroy(): void {
    this.context.app.ticker.remove(this._onTick)
    this.layer.destroy({ children: true, texture: false, textureSource: false })
    this.texture.destroy()
  }
}
