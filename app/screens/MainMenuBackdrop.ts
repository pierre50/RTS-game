import { Assets, Container, FillGradient, Graphics, Sprite, Texture, type Application, type Ticker } from 'pixi.js'
import { GodrayFilter } from 'pixi-filters'

const CLOUD_TEXTURES = {
  back: '/assets/graphics/ui/menu-clouds/menu-cloud-back.png',
  front: '/assets/graphics/ui/menu-clouds/menu-cloud-front.png',
  mid: '/assets/graphics/ui/menu-clouds/menu-cloud-mid.png',
} as const

type CloudTextureKey = keyof typeof CLOUD_TEXTURES
type CloudTextureMap = Record<CloudTextureKey, Texture>

type CloudConfig = {
  alpha: number
  scale: number
  speed: number
  texture: CloudTextureKey
  x: number
  y: number
}

type StarConfig = {
  alpha: number
  radius: number
  shine: number
  twinkleOffset: number
  twinkleSpeed: number
  x: number
  y: number
}

type ShootingStarConfig = {
  delay: number
  duration: number
  repeat: number
  size: number
  startX: number
  startY: number
  travelX: number
  travelY: number
}

const CLOUDS: CloudConfig[] = [
  { texture: 'back', x: -0.36, y: 0.2, scale: 2.02, alpha: 0.9, speed: 0.006 },
  { texture: 'mid', x: 0.1, y: 0.46, scale: 1.92, alpha: 0.96, speed: 0.01 },
  { texture: 'front', x: -0.2, y: 0.74, scale: 2.12, alpha: 1, speed: 0.013 },
]

const SKY_RAY_BASE_ANGLE = 30
const SKY_RAY_GAIN = 0.36
const SKY_RAY_LACUNARITY = 2.75
const SKY_RAY_ALPHA = 0.58
const STAR_COUNT = 260
const STAR_COLOR = 0xf5f1dc
const STAR_ALT_COLOR = 0xaadfff
const CLOUD_COPY_COUNT = 3
const CLOUD_STRIDE_RATIO = 0.8
const CLOUD_FADE_START = 0.54
const CLOUD_MASK_WIDTH = 8
const CLOUD_MASK_HEIGHT = 256
const CLOUD_VERTICAL_OFFSET_PX = 130

const SHOOTING_STARS: ShootingStarConfig[] = [
  { startX: 0.04, startY: 0.14, travelX: 0.34, travelY: 0.12, size: 170, delay: 1.7, duration: 0.62, repeat: 12.5 },
  { startX: 0.58, startY: 0.08, travelX: 0.28, travelY: 0.1, size: 132, delay: 6.2, duration: 0.54, repeat: 15.4 },
  { startX: 0.24, startY: 0.3, travelX: 0.24, travelY: 0.08, size: 118, delay: 10.4, duration: 0.5, repeat: 18.2 },
]

function createSkyGradient(): FillGradient {
  return new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: 0x0b123e },
      { offset: 0.34, color: 0x25206d },
      { offset: 0.68, color: 0x1f62a8 },
      { offset: 1, color: 0x2aa0aa },
    ],
  })
}

type CloudRuntime = {
  config: CloudConfig
  sprites: Array<{
    mask: Sprite
    sprite: Sprite
  }>
}

export class MainMenuBackdrop {
  app: Application
  root: Container
  sky: Graphics
  skyRayFilter: GodrayFilter
  starLayer: Graphics
  shootingStarLayer: Graphics
  cloudLayer: Container
  cloudFadeMaskTexture: Texture
  stars: StarConfig[]
  clouds: CloudRuntime[]
  skyGradient: FillGradient
  _destroyed: boolean
  _onTick: (ticker: Ticker) => void
  _elapsed: number

  constructor(app: Application) {
    this.app = app
    this.root = new Container()
    this.root.label = 'main-menu-backdrop'
    this.root.eventMode = 'none'
    this.root.sortableChildren = false

    this.sky = new Graphics()
    this.skyRayFilter = new GodrayFilter({
      angle: SKY_RAY_BASE_ANGLE,
      gain: SKY_RAY_GAIN,
      lacunarity: SKY_RAY_LACUNARITY,
      alpha: SKY_RAY_ALPHA,
      parallel: true,
    })
    this.sky.filters = [this.skyRayFilter]
    this.starLayer = new Graphics()
    this.shootingStarLayer = new Graphics()
    this.cloudLayer = new Container()
    this.cloudLayer.label = 'main-menu-clouds'
    this.cloudLayer.eventMode = 'none'
    this.cloudFadeMaskTexture = this.createCloudFadeMaskTexture()

    this.stars = this.createStars()
    this.clouds = []
    this.skyGradient = createSkyGradient()

    this.root.addChild(this.sky)
    this.root.addChild(this.starLayer)
    this.root.addChild(this.shootingStarLayer)
    this.root.addChild(this.cloudLayer)

    this._destroyed = false
    this._elapsed = 0
    this._onTick = ticker => this.update(ticker)
    this.app.stage.addChildAt(this.root, 0)
    this.app.ticker.add(this._onTick)
    this.resize()
    void this.loadClouds()
  }

  createStars(): StarConfig[] {
    let seed = 1249
    const next = () => {
      seed = (seed * 16807) % 2147483647
      return (seed - 1) / 2147483646
    }

    return Array.from({ length: STAR_COUNT }, () => {
      const y = next()
      const depth = 1 - y * 0.38
      const shine = next()

      return {
        x: next(),
        y,
        radius: (0.55 + shine * 1.95) * depth,
        alpha: (0.24 + shine * 0.62) * depth,
        shine,
        twinkleOffset: next() * Math.PI * 2,
        twinkleSpeed: 0.35 + next() * 1.1,
      }
    })
  }

  createCloudFadeMaskTexture(): Texture {
    const canvas = document.createElement('canvas')
    canvas.width = CLOUD_MASK_WIDTH
    canvas.height = CLOUD_MASK_HEIGHT

    const ctx = canvas.getContext('2d')
    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, 0, CLOUD_MASK_HEIGHT)
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
      gradient.addColorStop(CLOUD_FADE_START, 'rgba(255, 255, 255, 1)')
      gradient.addColorStop(0.84, 'rgba(255, 255, 255, 0.42)')
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, CLOUD_MASK_WIDTH, CLOUD_MASK_HEIGHT)
    }

    return Texture.from(canvas)
  }

  async loadClouds(): Promise<void> {
    const loadedTextures = await this.loadCloudTextures()
    if (this._destroyed) return

    this.clouds = CLOUDS.map(config => {
      const texture = loadedTextures[config.texture]
      const sprites = Array.from({ length: CLOUD_COPY_COUNT }, () => {
        const sprite = new Sprite(texture)
        const mask = new Sprite(this.cloudFadeMaskTexture)

        sprite.anchor.set(0, 0.5)
        sprite.alpha = config.alpha
        sprite.eventMode = 'none'
        mask.anchor.set(0, 0.5)
        mask.eventMode = 'none'
        sprite.mask = mask
        this.cloudLayer.addChild(sprite)
        this.cloudLayer.addChild(mask)
        return { mask, sprite }
      })
      const cloud = { config, sprites }

      this.placeCloud(cloud)
      return cloud
    })
  }

  async loadCloudTextures(): Promise<CloudTextureMap> {
    const entries = await Promise.all(
      Object.entries(CLOUD_TEXTURES).map(async ([key, source]) => {
        const texture = await Assets.load<Texture>(source)
        texture.source.scaleMode = 'linear'
        return [key, texture] as const
      }),
    )

    return Object.fromEntries(entries) as CloudTextureMap
  }

  resize(): void {
    const width = this.app.screen.width
    const height = this.app.screen.height

    this.sky.clear()
    this.sky.rect(0, 0, width, height).fill(this.skyGradient)

    this.drawStars(this._elapsed / 1000)
    this.drawShootingStars(this._elapsed / 1000)
    this.clouds.forEach(cloud => this.placeCloud(cloud))
  }

  drawStars(seconds: number): void {
    const width = this.app.screen.width
    const height = this.app.screen.height

    this.starLayer.clear()
    this.stars.forEach((star, index) => {
      const twinkle = (Math.sin(seconds * star.twinkleSpeed + star.twinkleOffset) + 1) * 0.5
      const alpha = star.alpha * (0.55 + twinkle * 0.45)
      const color = index % 5 === 0 ? STAR_ALT_COLOR : STAR_COLOR

      this.starLayer.circle(star.x * width, star.y * height, star.radius).fill({ color, alpha })
      if (star.shine > 0.86) {
        this.starLayer.circle(star.x * width, star.y * height, star.radius * 2.2).fill({ color, alpha: alpha * 0.16 })
      }
    })
  }

  drawShootingStars(seconds: number): void {
    const width = this.app.screen.width
    const height = this.app.screen.height

    this.shootingStarLayer.clear()
    SHOOTING_STARS.forEach(star => {
      const cycle = (seconds + star.delay) % star.repeat
      if (cycle > star.duration) return

      const progress = cycle / star.duration
      const fadeIn = Math.min(1, progress * 4)
      const fadeOut = Math.min(1, (1 - progress) * 3)
      const alpha = 0.9 * Math.min(fadeIn, fadeOut)
      const headX = (star.startX + star.travelX * progress) * width
      const headY = (star.startY + star.travelY * progress) * height
      const directionX = star.travelX * width
      const directionY = star.travelY * height
      const length = Math.hypot(directionX, directionY) || 1
      const unitX = directionX / length
      const unitY = directionY / length
      const perpX = -unitY
      const perpY = unitX
      const tailX = headX - unitX * star.size
      const tailY = headY - unitY * star.size
      const glowWidth = star.size * 0.075
      const coreWidth = star.size * 0.025

      this.shootingStarLayer
        .poly([
          tailX,
          tailY,
          headX - unitX * 8 + perpX * glowWidth,
          headY - unitY * 8 + perpY * glowWidth,
          headX + unitX * 8,
          headY + unitY * 8,
          headX - unitX * 8 - perpX * glowWidth,
          headY - unitY * 8 - perpY * glowWidth,
        ])
        .fill({ color: 0x69c6d8, alpha: alpha * 0.22 })

      this.shootingStarLayer
        .poly([
          tailX + unitX * star.size * 0.28,
          tailY + unitY * star.size * 0.28,
          headX - unitX * 4 + perpX * coreWidth,
          headY - unitY * 4 + perpY * coreWidth,
          headX + unitX * 6,
          headY + unitY * 6,
          headX - unitX * 4 - perpX * coreWidth,
          headY - unitY * 4 - perpY * coreWidth,
        ])
        .fill({ color: STAR_COLOR, alpha: alpha * 0.62 })

      this.shootingStarLayer.circle(headX, headY, 3.4).fill({ color: STAR_COLOR, alpha })
      this.shootingStarLayer.circle(headX, headY, 7.5).fill({ color: 0xaadfff, alpha: alpha * 0.16 })
      this.shootingStarLayer
        .moveTo(headX - perpX * 7, headY - perpY * 7)
        .lineTo(headX + perpX * 7, headY + perpY * 7)
        .stroke({ width: 1.2, color: STAR_COLOR, alpha: alpha * 0.45 })
      this.shootingStarLayer
        .moveTo(headX - unitX * 9, headY - unitY * 9)
        .lineTo(headX + unitX * 9, headY + unitY * 9)
        .stroke({ width: 1, color: STAR_COLOR, alpha: alpha * 0.4 })
    })
  }

  placeCloud({ config, sprites }: CloudRuntime): void {
    const width = this.app.screen.width
    const height = this.app.screen.height
    const baseWidth = width * config.scale
    const textureWidth = Math.max(1, sprites[0]?.sprite.texture.width ?? 1)
    const scale = baseWidth / textureWidth
    const stride = baseWidth * CLOUD_STRIDE_RATIO

    sprites.forEach(({ mask, sprite }, index) => {
      sprite.scale.set(scale)
      sprite.x = width * config.x + stride * index
      sprite.y = height * config.y + CLOUD_VERTICAL_OFFSET_PX
      mask.x = sprite.x
      mask.y = sprite.y
      mask.width = sprite.width
      mask.height = sprite.height
    })
  }

  update(ticker: Ticker): void {
    const deltaMS = ticker.deltaMS || 16.67
    this._elapsed += deltaMS

    const seconds = this._elapsed / 1000
    const width = this.app.screen.width

    this.skyRayFilter.time = seconds * 0.12
    this.skyRayFilter.angle = SKY_RAY_BASE_ANGLE + Math.sin(seconds * 0.04) * 3

    this.drawStars(seconds)
    this.drawShootingStars(seconds)

    this.clouds.forEach(cloud => {
      const stride = (cloud.sprites[0]?.sprite.width || 1) * CLOUD_STRIDE_RATIO
      const resetDistance = stride * cloud.sprites.length

      cloud.sprites.forEach(({ mask, sprite }) => {
        sprite.x += deltaMS * cloud.config.speed
        if (sprite.x > width + stride * 0.3) {
          sprite.x -= resetDistance
        }
        mask.x = sprite.x
        mask.y = sprite.y
      })
    })
  }

  destroy(): void {
    this._destroyed = true
    this.app.ticker.remove(this._onTick)
    this.root.destroy({ children: true, texture: false, textureSource: false })
  }
}
