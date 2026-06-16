import { AnimatedSprite, Assets, Container } from 'pixi.js'
import {
  AMBIENT_BIRD_ANIMATION_SPEED,
  AMBIENT_BIRD_ASSETS,
  AMBIENT_BIRD_FIRST_PASS_MAX_MS,
  AMBIENT_BIRD_FIRST_PASS_MIN_MS,
  AMBIENT_BIRD_MAX_CONCURRENT,
  AMBIENT_BIRD_PASS_INTERVAL_MAX_MS,
  AMBIENT_BIRD_PASS_INTERVAL_MIN_MS,
  AMBIENT_BIRD_PATH_OFFSET_RATIO,
  AMBIENT_BIRD_SCREEN_MARGIN,
  AMBIENT_BIRD_SHADOW_ALPHA,
  AMBIENT_BIRD_SHADOW_OFFSET_X,
  AMBIENT_BIRD_SHADOW_OFFSET_Y,
  AMBIENT_BIRD_SPEED_MAX,
  AMBIENT_BIRD_SPEED_MIN,
} from '../constants'
import { getMirroredHalfArcFrameIndex } from '../lib'

const DIRECTION_COUNT = 9
const TARGET_FRAME_MS = 1000 / 60

function randomBetween(min, max, random = Math.random) {
  return min + random() * (max - min)
}

function sortedTextureNames(textures) {
  return Object.keys(textures).sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
}

export function getBirdDirectionalFrames(textures, degree, frameCount) {
  const names = sortedTextureNames(textures)
  const { frameIndex, mirrored } = getMirroredHalfArcFrameIndex(degree, DIRECTION_COUNT)
  const start = frameIndex * frameCount
  return {
    frames: names.slice(start, start + frameCount).map(name => textures[name]),
    mirrored,
  }
}

export function createBirdPath(bounds, random = Math.random) {
  const angle = random() * Math.PI * 2
  const direction = { x: Math.cos(angle), y: Math.sin(angle) }
  const perpendicular = { x: -direction.y, y: direction.x }
  const distance = Math.hypot(bounds.width, bounds.height) / 2 + AMBIENT_BIRD_SCREEN_MARGIN
  const pathOffset = (random() * 2 - 1) * Math.min(bounds.width, bounds.height) * AMBIENT_BIRD_PATH_OFFSET_RATIO
  const center = {
    x: bounds.x + bounds.width / 2 + perpendicular.x * pathOffset,
    y: bounds.y + bounds.height / 2 + perpendicular.y * pathOffset,
  }

  return {
    start: {
      x: center.x - direction.x * distance,
      y: center.y - direction.y * distance,
    },
    end: {
      x: center.x + direction.x * distance,
      y: center.y + direction.y * distance,
    },
    degree: Math.round((Math.atan2(direction.y, direction.x) * 180) / Math.PI + 180),
  }
}

export class AmbientBirds extends Container {
  constructor(context, getViewportBounds, random = Math.random) {
    super()
    this.context = context
    this.getViewportBounds = getViewportBounds
    this.random = random
    this.activePasses = []
    this.elapsedMs = 0
    this.nextPassAt = randomBetween(AMBIENT_BIRD_FIRST_PASS_MIN_MS, AMBIENT_BIRD_FIRST_PASS_MAX_MS, this.random)
    this.eventMode = 'none'
    this._onTick = ticker => this.update(ticker.deltaMS ?? 0, ticker.deltaTime ?? 1)
    context.app.ticker.add(this._onTick)
  }

  scheduleNextPass() {
    this.nextPassAt =
      this.elapsedMs + randomBetween(AMBIENT_BIRD_PASS_INTERVAL_MIN_MS, AMBIENT_BIRD_PASS_INTERVAL_MAX_MS, this.random)
  }

  createAnimatedSprite(sheetId, degree, frameCount) {
    const sheet = Assets.cache.get(sheetId)
    if (!sheet?.textures) return null
    const { frames, mirrored } = getBirdDirectionalFrames(sheet.textures, degree, frameCount)
    if (!frames.length) return null

    const sprite = new AnimatedSprite(frames)
    sprite.autoUpdate = false
    sprite.updateAnchor = true
    sprite.animationSpeed = AMBIENT_BIRD_ANIMATION_SPEED
    sprite.scale.x = mirrored ? -1 : 1
    sprite.play()
    return sprite
  }

  startPass() {
    const birdConfig = AMBIENT_BIRD_ASSETS[Math.floor(this.random() * AMBIENT_BIRD_ASSETS.length)]
    const path = createBirdPath(this.getViewportBounds(), this.random)
    const bird = this.createAnimatedSprite(birdConfig.spriteSheet, path.degree, birdConfig.frameCount)
    const shadow = this.createAnimatedSprite(birdConfig.shadowSheet, path.degree, birdConfig.frameCount)
    if (!bird || !shadow) {
      bird?.destroy()
      shadow?.destroy()
      this.scheduleNextPass()
      return
    }

    const group = new Container()
    const scale = randomBetween(birdConfig.minScale, birdConfig.maxScale, this.random)
    shadow.alpha = AMBIENT_BIRD_SHADOW_ALPHA
    shadow.position.set(AMBIENT_BIRD_SHADOW_OFFSET_X, AMBIENT_BIRD_SHADOW_OFFSET_Y)
    group.scale.set(scale)
    group.position.copyFrom(path.start)
    group.addChild(shadow, bird)
    this.addChild(group)

    const pathLength = Math.hypot(path.end.x - path.start.x, path.end.y - path.start.y)
    const speed = randomBetween(AMBIENT_BIRD_SPEED_MIN, AMBIENT_BIRD_SPEED_MAX, this.random)
    const durationMs = (pathLength / speed) * 1000

    this.activePasses.push({ bird, shadow, group, path, elapsedMs: 0, durationMs })
    this.scheduleNextPass()
  }

  finishPass(pass) {
    pass.group.destroy({ children: true })
    this.activePasses = this.activePasses.filter(p => p !== pass)
  }

  update(elapsedMs, deltaTime) {
    if (this.context.paused || this.context.victory || this.context.defeat) return
    this.elapsedMs += elapsedMs

    if (this.elapsedMs >= this.nextPassAt) {
      if (this.activePasses.length < AMBIENT_BIRD_MAX_CONCURRENT) {
        this.startPass()
      } else {
        this.scheduleNextPass()
      }
    }

    if (!this.activePasses.length) return

    const tick = { deltaTime: elapsedMs > 0 ? elapsedMs / TARGET_FRAME_MS : deltaTime }

    for (let i = this.activePasses.length - 1; i >= 0; i--) {
      const pass = this.activePasses[i]
      pass.elapsedMs += elapsedMs
      const progress = Math.min(pass.elapsedMs / pass.durationMs, 1)
      pass.group.position.set(
        pass.path.start.x + (pass.path.end.x - pass.path.start.x) * progress,
        pass.path.start.y + (pass.path.end.y - pass.path.start.y) * progress
      )
      pass.bird.update(tick)
      pass.shadow.update(tick)
      if (progress >= 1) this.finishPass(pass)
    }
  }

  destroy(options) {
    this.context.app.ticker.remove(this._onTick)
    this.activePasses = []
    super.destroy(options)
  }
}
