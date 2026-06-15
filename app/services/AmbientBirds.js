import { AnimatedSprite, Assets, Container } from 'pixi.js'
import {
  AMBIENT_BIRD_ANIMATION_SPEED,
  AMBIENT_BIRD_ASSETS,
  AMBIENT_BIRD_FIRST_PASS_MAX_MS,
  AMBIENT_BIRD_FIRST_PASS_MIN_MS,
  AMBIENT_BIRD_PASS_DURATION_MAX_MS,
  AMBIENT_BIRD_PASS_DURATION_MIN_MS,
  AMBIENT_BIRD_PASS_INTERVAL_MAX_MS,
  AMBIENT_BIRD_PASS_INTERVAL_MIN_MS,
  AMBIENT_BIRD_PATH_OFFSET_RATIO,
  AMBIENT_BIRD_SCREEN_MARGIN,
  AMBIENT_BIRD_SHADOW_ALPHA,
  AMBIENT_BIRD_SHADOW_OFFSET_X,
  AMBIENT_BIRD_SHADOW_OFFSET_Y,
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
    this.activePass = null
    this.elapsedMs = 0
    this.nextPassAt = randomBetween(AMBIENT_BIRD_FIRST_PASS_MIN_MS, AMBIENT_BIRD_FIRST_PASS_MAX_MS, this.random)
    this.eventMode = 'none'
    this._onTick = ticker => this.update(ticker.elapsedMS ?? 0, ticker.deltaTime ?? 1)
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

    this.activePass = {
      bird,
      shadow,
      group,
      path,
      elapsedMs: 0,
      durationMs: randomBetween(AMBIENT_BIRD_PASS_DURATION_MIN_MS, AMBIENT_BIRD_PASS_DURATION_MAX_MS, this.random),
    }
  }

  finishPass() {
    this.activePass?.group.destroy({ children: true })
    this.activePass = null
    this.scheduleNextPass()
  }

  update(elapsedMs, deltaTime) {
    if (this.context.paused || this.context.victory || this.context.defeat) return
    this.elapsedMs += elapsedMs

    if (!this.activePass) {
      if (this.elapsedMs >= this.nextPassAt) this.startPass()
      return
    }

    const pass = this.activePass
    pass.elapsedMs += elapsedMs
    const progress = Math.min(pass.elapsedMs / pass.durationMs, 1)
    pass.group.position.set(
      pass.path.start.x + (pass.path.end.x - pass.path.start.x) * progress,
      pass.path.start.y + (pass.path.end.y - pass.path.start.y) * progress
    )
    const animationDelta = elapsedMs > 0 ? elapsedMs / TARGET_FRAME_MS : deltaTime
    pass.bird.update({ deltaTime: animationDelta })
    pass.shadow.update({ deltaTime: animationDelta })

    if (progress >= 1) this.finishPass()
  }

  destroy(options) {
    this.context.app.ticker.remove(this._onTick)
    this.activePass = null
    super.destroy(options)
  }
}
