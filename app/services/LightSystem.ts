import { Container, Sprite, Texture } from 'pixi.js'
import { getInstanceScreenBounds } from '../lib/grid/visibility'
import type { GameContextLike } from '../types/context'
import type { EntityLightSourceConfig, RuntimeEntity } from '../types/entities'

type ScreenRect = { height: number; width: number; x: number; y: number }
type TickerLike = { deltaMS?: number; elapsedMS?: number; deltaTime?: number }
type LightSource = {
  color: string
  intensity: number
  radius: number
  verticalScale: number
  x: number
  y: number
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
  lightSource?: EntityLightSourceConfig | null
  visible?: boolean
  x?: number
  y?: number
}

const TARGET_FRAME_MS = 1000 / 60
const HERO_LIGHT_RADIUS = 250
const HERO_LIGHT_CENTER_OFFSET_Y = -22
const HERO_LIGHT_VERTICAL_SCALE = 0.76
const DEFAULT_ENTITY_LIGHT_COLOR = '255,172,76'
const DEFAULT_ENTITY_LIGHT_FLICKER = 0.08
const DEFAULT_ENTITY_LIGHT_INTENSITY = 0.86
const DEFAULT_ENTITY_LIGHT_RADIUS = 160
const DEFAULT_ENTITY_LIGHT_VERTICAL_SCALE = 0.7
const DARKNESS_LERP_PER_SECOND = 5
const MAX_DARKNESS_ALPHA = 0.96
const GLOW_ALPHA = 0.08

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

export class LightSystem {
  canvas: HTMLCanvasElement
  context: GameContextLike
  currentDarkness: number
  getDarknessLevel: () => number
  getScreenRect: () => ScreenRect
  layer: Container
  lights: LightSource[]
  screenRect: ScreenRect
  sprite: Sprite
  texture: Texture
  _onTick: (ticker: TickerLike) => void

  constructor(context: GameContextLike, getScreenRect: () => ScreenRect, getDarknessLevel: () => number) {
    this.context = context
    this.getScreenRect = getScreenRect
    this.getDarknessLevel = getDarknessLevel
    this.screenRect = this.getScreenRect()
    this.currentDarkness = 0
    this.lights = []

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
    this.updateLights()
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

  updateLights(): void {
    this.lights.length = 0
    const hero = this.context.controls?.heroUnit
    const viewport = this.context.controls?.getViewportMetrics?.() as ViewportLightMetrics | undefined
    if (!viewport) return
    const visibleLeft = viewport?.visibleLeft ?? this.context.controls.camera.x
    const visibleTop = viewport?.visibleTop ?? this.context.controls.camera.y
    const zoom = Math.max(0.1, viewport?.zoom ?? 1)
    const now = performance.now()
    const heroFlicker = 0.97 + Math.sin(now * 0.006) * 0.025 + Math.sin(now * 0.013) * 0.012

    if (hero && !hero.isDead && !hero.isDestroyed) {
      this.lights.push({
        x: hero.x - visibleLeft,
        y: hero.y - visibleTop + HERO_LIGHT_CENTER_OFFSET_Y / zoom,
        radius: HERO_LIGHT_RADIUS / zoom,
        intensity: clamp(heroFlicker, 0.88, 1),
        verticalScale: HERO_LIGHT_VERTICAL_SCALE,
        color: '255,198,96',
      })
    }

    this.collectEntityLights(visibleLeft, visibleTop, zoom, now)
  }

  collectEntityLights(
    visibleLeft: number,
    visibleTop: number,
    zoom: number,
    now: number
  ): void {
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

  addEntityLights(
    instance: RuntimeEntity,
    visibleLeft: number,
    visibleTop: number,
    zoom: number,
    now: number
  ): void {
    if (
      instance.isDead ||
      instance.isDestroyed ||
      instance.visible === false ||
      !this.context.controls?.instanceInCamera(instance, getInstanceScreenBounds(instance))
    ) {
      return
    }

    this.addLightSource(instance, instance, 0, 0, visibleLeft, visibleTop, zoom, now)
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

    const flicker = clamp(config.flicker ?? DEFAULT_ENTITY_LIGHT_FLICKER, 0, 0.5)
    const flickerRatio = flicker
      ? 1 + Math.sin(now * 0.007 + instance.i * 0.37 + instance.j * 0.19) * flicker
      : 1
    const offsetX = (config.offsetX ?? 0) / zoom
    const offsetY = (config.offsetY ?? 0) / zoom

    this.lights.push({
      x: instance.x - visibleLeft + localX / zoom + offsetX,
      y: instance.y - visibleTop + localY / zoom + offsetY,
      radius: Math.max(1, (config.radius ?? DEFAULT_ENTITY_LIGHT_RADIUS) / zoom),
      intensity: clamp((config.intensity ?? DEFAULT_ENTITY_LIGHT_INTENSITY) * flickerRatio, 0, 1.4),
      verticalScale: clamp(config.verticalScale ?? DEFAULT_ENTITY_LIGHT_VERTICAL_SCALE, 0.2, 1.4),
      color: normalizeLightColor(config.color),
    })
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
