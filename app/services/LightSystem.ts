import { Container, Sprite, Texture } from 'pixi.js'
import type { GameContextLike } from '../types/context'

type ScreenRect = { height: number; width: number; x: number; y: number }
type TickerLike = { deltaMS?: number; elapsedMS?: number; deltaTime?: number }
type LightSource = {
  color: string
  intensity: number
  radius: number
  x: number
  y: number
}
type ViewportLightMetrics = {
  visibleLeft: number
  visibleTop: number
  zoom?: number
}

const TARGET_FRAME_MS = 1000 / 60
const HERO_LIGHT_RADIUS = 250
const HERO_LIGHT_CENTER_OFFSET_Y = -22
const HERO_LIGHT_VERTICAL_SCALE = 0.76
const DARKNESS_LERP_PER_SECOND = 5
const MAX_DARKNESS_ALPHA = 0.96
const GLOW_ALPHA = 0.08

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function lerp(current: number, target: number, amount: number): number {
  return current + (target - current) * clamp(amount, 0, 1)
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

    this._onTick = ticker => this.update(ticker.deltaMS ?? ticker.elapsedMS ?? TARGET_FRAME_MS)
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
    if (!hero || hero.isDead || hero.isDestroyed) return
    const viewport = this.context.controls?.getViewportMetrics?.() as ViewportLightMetrics | undefined
    const visibleLeft = viewport?.visibleLeft ?? this.context.controls.camera.x
    const visibleTop = viewport?.visibleTop ?? this.context.controls.camera.y
    const zoom = Math.max(0.1, viewport?.zoom ?? 1)
    const flicker = 0.97 + Math.sin(performance.now() * 0.006) * 0.025 + Math.sin(performance.now() * 0.013) * 0.012

    this.lights.push({
      x: hero.x - visibleLeft,
      y: hero.y - visibleTop + HERO_LIGHT_CENTER_OFFSET_Y / zoom,
      radius: HERO_LIGHT_RADIUS / zoom,
      intensity: clamp(flicker, 0.88, 1),
      color: '255,198,96',
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
    ctx.scale(1, HERO_LIGHT_VERTICAL_SCALE)
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
    ctx.scale(1, HERO_LIGHT_VERTICAL_SCALE)
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
