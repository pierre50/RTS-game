import { AnimatedSprite, Assets, Container } from 'pixi.js'
import {
  degreesToRadians,
  getHitPointsWithDamage,
  getInstanceZIndex,
  moveTowardPoint,
  pointsDistance,
  average,
  uuidv4,
  getPointsDegree,
  getArcHeightForDistance,
  getArcProgressOffset,
  bindAnimatedSpriteToTicker,
  degreeToDirection,
  getAnimationFrames,
  getMirroredHalfArcFrameIndex,
  getEffectiveProjectileType,
  projectileTracksTarget,
  playAudibleSoundCue,
} from '../lib'
import { FAMILY_TYPES, LABEL_TYPES, MENU_INFO_IDS, STEP_TIME } from '../constants'
import { getShadowsEnabled } from '../lib/settings'
import type { Texture } from 'pixi.js'
import type { GameContextLike, SchedulerTaskId } from '../types/context'
import type { CommandSound, RuntimeEntity } from '../types/entities'
import type { Point } from '../types/grid'
import type { AudibleInstance } from '../lib'

const PROJECTILE_Z_OFFSET = 1000000

const DIRECTIONAL_FRAME_INDEX: Record<string, number> = {
  south: 0,
  southwest: 1,
  west: 2,
  northwest: 3,
  north: 4,
  northeast: 5,
  east: 6,
  southeast: 7,
}

type ProjectileOptions = {
  owner: RuntimeEntity
  type: string
  target?: RuntimeEntity
  destination?: Point
  degree?: number
  damage?: number
}

type RuntimeProjectile = ProjectileOptions & {
  directionalFrameOrder?: string[]
  directionalAnimationFrames?: number
  fullCircleStartDegree?: number
}
type ProjectileTexture = Texture & { defaultAnchor?: { x: number; y: number } }
type ProjectileSprite = AnimatedSprite

const PROJECTILE_SHADOW_ALPHA = 0.42
const PROJECTILE_SHADOW_MAX_ALTITUDE_FADE = 0.28
const PROJECTILE_SHADOW_MAX_ALTITUDE_SCALE = 0.35
const PROJECTILE_SHADOW_SCALE_Y = 0.48

function getDirectionalFrameIndex(projectile: RuntimeProjectile, direction: string) {
  if (Array.isArray(projectile.directionalFrameOrder)) {
    const frameIndex = projectile.directionalFrameOrder.indexOf(direction)
    if (frameIndex >= 0) {
      return frameIndex
    }
  }

  return DIRECTIONAL_FRAME_INDEX[direction] ?? 0
}

function getSortedTextureNames(textures: Record<string, Texture>) {
  return Object.keys(textures).sort((a, b) => {
    const na = parseInt(a.split('_')[0], 10)
    const nb = parseInt(b.split('_')[0], 10)
    return na - nb
  })
}

function applyTextureAnchor(sprite: Pick<AnimatedSprite, 'anchor'>, texture?: ProjectileTexture) {
  const anchor = texture?.defaultAnchor
  if (
    anchor &&
    Number.isFinite(anchor.x) &&
    Number.isFinite(anchor.y) &&
    anchor.x >= 0 &&
    anchor.x <= 1 &&
    anchor.y >= 0 &&
    anchor.y <= 1
  ) {
    sprite.anchor.set(anchor.x, anchor.y)
    return
  }

  sprite.anchor.set(0.5, 0.5)
}

function getDirectionalAnimation(projectile: RuntimeProjectile, textures: Texture[], degree: number) {
  const framesPerDirection = projectile.directionalAnimationFrames as number | undefined
  if (typeof framesPerDirection !== 'number' || !Number.isInteger(framesPerDirection) || framesPerDirection <= 0) {
    return null
  }

  const directionCount = Math.floor(textures.length / framesPerDirection)
  if (directionCount <= 0) return null

  let directionIndex
  let mirrored = false
  if (projectile.fullCircleStartDegree != null) {
    const normalizedDegree = (((degree - projectile.fullCircleStartDegree) % 360) + 360) % 360
    directionIndex = Math.round(normalizedDegree / (360 / directionCount)) % directionCount
  } else {
    const frame = getMirroredHalfArcFrameIndex(degree, directionCount)
    directionIndex = frame.frameIndex
    mirrored = frame.mirrored
  }

  const start = directionIndex * framesPerDirection
  return {
    textures: textures.slice(start, start + framesPerDirection),
    mirrored,
  }
}

export class Projectile extends Container {
  context: GameContextLike
  family: string
  interval: SchedulerTaskId | null
  sprite?: ProjectileSprite
  shadow?: ProjectileSprite

  owner!: RuntimeEntity
  type!: string
  target?: RuntimeEntity
  destination?: Point
  degree?: number
  damage?: number
  tracksTarget!: boolean
  isDead!: boolean
  z!: number
  destinationPoint!: Point
  groundOrigin!: Point
  totalDistance!: number
  spawnOrigin!: Point
  trajectoryState: { kind: string; arcHeight: number } | null = null

  size!: number
  speed!: number
  assets!: string
  isAnimated?: boolean
  animationSpeed?: number
  rotateSprite?: boolean
  staticFrame?: number
  staticDirectionalAnimationFrame?: number
  spriteBaseAngle?: number
  directionalFrames?: number
  directionalFrameOrder?: string[]
  directionalAnimationFrames?: number
  projectileScale?: number
  spawnOffsetX?: number
  spawnOffsetY?: number
  fullCircleStartDegree?: number
  trajectory?: { kind: string; minArcHeight?: number; arcHeightFactor?: number; maxArcHeight?: number }
  impactEffect?: { assets: string; animationSpeed?: number; scale?: number }
  sounds?: { launch?: CommandSound; impact?: CommandSound }

  constructor(options: ProjectileOptions, context: GameContextLike) {
    super()

    this.context = context
    this.label = uuidv4()
    this.family = FAMILY_TYPES.projectile
    this.interval = null

    Object.assign(this, options)
    const player = this.owner.owner
    if (!player) throw new Error('Projectile owner must belong to a player')
    this.type = getEffectiveProjectileType(this.type, player)
    this.tracksTarget = projectileTracksTarget(this.type, player)
    const projectileDefinition = player.config.projectiles?.[this.type]
    if (projectileDefinition) {
      const { scale, ...projectileConfig } = projectileDefinition
      Object.assign(this, projectileConfig)
      this.projectileScale = scale
    }

    const ownerSpriteHeight = this.owner.sprite?.height ?? 0
    this.x = this.owner.x + (this.spawnOffsetX ?? 0)
    this.y = this.owner.y - ownerSpriteHeight / 2 + (this.spawnOffsetY ?? 0)
    this.z = this.owner.z ?? 0
    this.zIndex = getInstanceZIndex(this) + PROJECTILE_Z_OFFSET
    const targetPoint = this.destination || this.target
    if (!targetPoint) {
      this.isDead = true
      return
    }
    let { x: targetX, y: targetY } = targetPoint

    playAudibleSoundCue(this as AudibleInstance, this.sounds?.launch)

    const degree = this.degree || getPointsDegree(this.x, this.y, targetX, targetY)
    const sprite = this.createSprite(degree)
    this.sprite = sprite
    this.spawnOrigin = { x: this.x, y: this.y }
    this.groundOrigin = { x: this.owner.x, y: this.owner.y }
    this.destinationPoint = { x: targetX, y: targetY }
    this.totalDistance = Math.max(pointsDistance(this.x, this.y, targetX, targetY), 1)
    this.trajectoryState = this.createTrajectoryState()
    this.shadow = this.createShadowSprite(sprite)
    sprite.label = LABEL_TYPES.sprite
    sprite.eventMode = 'none'
    sprite.roundPixels = true
    this.addChild(this.shadow, sprite)
    this.updateTrajectoryVisual()

    this.interval = this.context.scheduler.add(
      () => {
        if (this.tracksTarget && this.target && !this.target.isDead && !this.target.isDestroyed) {
          targetX = this.target.x
          targetY = this.target.y
          this.destinationPoint.x = targetX
          this.destinationPoint.y = targetY
        }
        if (pointsDistance(this.x, this.y, targetX, targetY) <= Math.max(this.speed, this.size)) {
          if (
            this.target &&
            !this.target.isDead &&
            !this.target.isDestroyed &&
            pointsDistance(targetX, targetY, this.target.x, this.target.y) <=
              average(this.target.width, this.target.height)
          ) {
            this.onHit(this.target)
          }
          this.die()
          return
        }
        moveTowardPoint(this, targetX, targetY, this.speed)
        this.updateTrajectoryVisual()
        this.zIndex = getInstanceZIndex(this) + PROJECTILE_Z_OFFSET
      },
      STEP_TIME,
      'projectile.step'
    )
  }

  createShadowSprite(source: ProjectileSprite): ProjectileSprite {
    const shadow = new AnimatedSprite(source.textures as Texture[]) as ProjectileSprite
    bindAnimatedSpriteToTicker(shadow, this.context.app)
    shadow.label = LABEL_TYPES.shadow
    shadow.eventMode = 'none'
    shadow.roundPixels = true
    shadow.tint = 0x000000
    shadow.alpha = PROJECTILE_SHADOW_ALPHA
    shadow.visible = getShadowsEnabled()
    shadow.animationSpeed = source.animationSpeed
    shadow.loop = source.loop
    shadow.anchor.set(source.anchor.x, source.anchor.y)
    shadow.rotation = source.rotation
    shadow.scale.set(source.scale.x, source.scale.y * PROJECTILE_SHADOW_SCALE_Y)
    if (source.playing) {
      shadow.gotoAndPlay(source.currentFrame)
    } else {
      shadow.gotoAndStop(source.currentFrame)
    }
    return shadow
  }

  createSprite(degree: number): ProjectileSprite {
    const spritesheet = Assets.cache.get(this.assets)
    if (!spritesheet) {
      throw new Error(`Missing projectile spritesheet for ${this.type} (${this.assets})`)
    }
    const textureNames = getSortedTextureNames(spritesheet.textures)

    if (this.isAnimated) {
      const textures = textureNames.map(name => spritesheet.textures[name])
      const directionalAnimation = getDirectionalAnimation(this as RuntimeProjectile, textures, degree)
      const sprite = new AnimatedSprite(directionalAnimation?.textures ?? textures) as ProjectileSprite
      bindAnimatedSpriteToTicker(sprite, this.context.app)
      sprite.updateAnchor = true

      if (directionalAnimation) {
        const staticFrame = this.staticDirectionalAnimationFrame
        const frameIndex = Number.isInteger(staticFrame)
          ? Math.max(0, Math.min(staticFrame as number, directionalAnimation.textures.length - 1))
          : 0
        applyTextureAnchor(sprite, directionalAnimation.textures[frameIndex])
        const scale = this.getProjectileScale()
        sprite.scale.set(directionalAnimation.mirrored ? -scale : scale, scale)
        if (Number.isInteger(staticFrame)) {
          sprite.gotoAndStop(frameIndex)
        } else {
          sprite.animationSpeed = this.animationSpeed ?? 0.3
          sprite.play()
        }
      } else if (this.directionalFrames) {
        if (typeof this.directionalFrames === 'number' && this.directionalFrames > 8 && !this.directionalFrameOrder) {
          if (this.fullCircleStartDegree != null) {
            const normalizedDeg = (((degree - this.fullCircleStartDegree) % 360) + 360) % 360
            const degPerFrame = 360 / textures.length
            const frameIndex = Math.round(normalizedDeg / degPerFrame) % textures.length
            applyTextureAnchor(sprite, textures[frameIndex])
            sprite.gotoAndStop(frameIndex)
          } else {
            const { frameIndex, mirrored } = getMirroredHalfArcFrameIndex(degree, textures.length)
            const clampedIndex = Math.min(frameIndex, textures.length - 1)
            applyTextureAnchor(sprite, textures[clampedIndex])
            sprite.gotoAndStop(clampedIndex)
            const scale = this.getProjectileScale()
            sprite.scale.set(mirrored ? scale : -scale, scale)
          }
        } else {
          const direction = degreeToDirection(degree)
          const frameIndex = Math.min(
            getDirectionalFrameIndex(this as RuntimeProjectile, direction as string),
            textures.length - 1
          )
          applyTextureAnchor(sprite, textures[frameIndex])
          sprite.gotoAndStop(frameIndex)
        }
      } else if (this.rotateSprite) {
        const frameIndex = this.staticFrame ?? 0
        const baseAngle = this.spriteBaseAngle ?? 180
        applyTextureAnchor(sprite, textures[frameIndex])
        sprite.gotoAndStop(frameIndex)
        sprite.rotation = degreesToRadians(degree - baseAngle)
      } else {
        applyTextureAnchor(sprite, textures[0])
        sprite.animationSpeed = this.animationSpeed ?? 0.3
        sprite.play()
      }

      return sprite
    }

    let textureName = textureNames[0]
    if (this.directionalFrames) {
      if (typeof this.directionalFrames === 'number' && this.directionalFrames > 8 && !this.directionalFrameOrder) {
        const frameCount = textureNames.length
        const { frameIndex, mirrored } = getMirroredHalfArcFrameIndex(degree, frameCount)
        textureName = textureNames[Math.min(frameIndex, textureNames.length - 1)]
        const texture = spritesheet.textures[textureName]
        const sprite = new AnimatedSprite([texture]) as ProjectileSprite
        bindAnimatedSpriteToTicker(sprite, this.context.app)
        sprite.updateAnchor = true
        applyTextureAnchor(sprite, texture)
        sprite.animationSpeed = 0
        sprite.play()
        const scale = this.getProjectileScale()
        sprite.scale.set(mirrored ? -scale : scale, scale)
        return sprite
      }

      const direction = degreeToDirection(degree)
      const frameIndex = getDirectionalFrameIndex(this as RuntimeProjectile, direction as string)
      textureName = textureNames[Math.min(frameIndex, textureNames.length - 1)]
    }
    const texture = spritesheet.textures[textureName]
    const sprite = new AnimatedSprite([texture]) as ProjectileSprite
    bindAnimatedSpriteToTicker(sprite, this.context.app)
    sprite.updateAnchor = true
    applyTextureAnchor(sprite, texture)
    sprite.animationSpeed = 0
    sprite.play()
    const scale = this.getProjectileScale()
    if (scale !== 1) {
      sprite.scale.set(scale)
    }
    if (this.rotateSprite) {
      sprite.rotation = degreesToRadians(degree)
    }
    return sprite
  }

  createTrajectoryState() {
    if (this.trajectory?.kind !== 'arc') {
      return null
    }

    return {
      kind: 'arc',
      arcHeight: getArcHeightForDistance(this.totalDistance, this.trajectory),
    }
  }

  updateTrajectoryVisual() {
    if (!this.sprite) {
      return
    }

    const { spawnOrigin } = this
    const traveledDistance = pointsDistance(spawnOrigin.x, spawnOrigin.y, this.x, this.y)
    const progress = Math.max(0, Math.min(1, traveledDistance / this.totalDistance))
    this.sprite.y = this.trajectoryState ? -getArcProgressOffset(progress, this.trajectoryState.arcHeight) : 0
    this.updateShadowVisual(progress)
  }

  updateShadowVisual(progress: number) {
    if (!this.shadow || !this.sprite) return
    this.shadow.visible = getShadowsEnabled()
    if (!this.shadow.visible) return

    const groundX = this.groundOrigin.x + (this.destinationPoint.x - this.groundOrigin.x) * progress
    const groundY = this.groundOrigin.y + (this.destinationPoint.y - this.groundOrigin.y) * progress
    const visualY = this.y + this.sprite.y
    const altitude = Math.max(0, groundY - visualY)
    const altitudeRatio = Math.max(0, Math.min(1, altitude / 180))
    const scaleBoost = 1 + altitudeRatio * PROJECTILE_SHADOW_MAX_ALTITUDE_SCALE

    this.shadow.x = groundX - this.x
    this.shadow.y = groundY - this.y
    this.shadow.alpha = PROJECTILE_SHADOW_ALPHA - altitudeRatio * PROJECTILE_SHADOW_MAX_ALTITUDE_FADE
    this.shadow.rotation = this.sprite.rotation
    this.shadow.scale.set(
      this.sprite.scale.x * scaleBoost,
      this.sprite.scale.y * PROJECTILE_SHADOW_SCALE_Y * scaleBoost
    )
  }

  createImpactEffect(x: number, y: number) {
    if (!this.impactEffect?.assets) return

    const spritesheet = Assets.cache.get(this.impactEffect.assets)
    if (!spritesheet) return

    const sprite = new AnimatedSprite(getAnimationFrames(spritesheet.textures) as Texture[]) as ProjectileSprite
    bindAnimatedSpriteToTicker(sprite, this.context.app)
    sprite.updateAnchor = true
    sprite.label = LABEL_TYPES.sprite
    sprite.eventMode = 'none'
    sprite.roundPixels = true
    sprite.loop = false
    sprite.x = x
    sprite.y = y
    sprite.zIndex = (this.zIndex ?? this.owner.zIndex ?? 0) + 1
    applyTextureAnchor(sprite, sprite.textures[0] as ProjectileTexture)
    sprite.scale.set(this.impactEffect.scale ?? 1)
    sprite.animationSpeed = this.impactEffect.animationSpeed ?? 0.2
    sprite.onComplete = () => {
      sprite.parent?.removeChild(sprite)
      sprite.destroy({ children: true, texture: false })
    }
    this.context.map.addChild(sprite)
    sprite.play()
  }

  getProjectileScale(): number {
    return this.projectileScale ?? 1
  }

  onHit(instance: RuntimeEntity) {
    const {
      context: { menu, player },
    } = this
    if (instance.family === FAMILY_TYPES.building) {
      playAudibleSoundCue(this as AudibleInstance, this.sounds?.impact)
    }
    instance.hitPoints = getHitPointsWithDamage(this.owner, instance, this.damage)
    if (instance.selected) {
      instance.drawHealthBar?.()
      if (player.selectedOther === instance) {
        menu.updateInfo(MENU_INFO_IDS.hitPoints, instance.hitPoints + '/' + instance.totalHitPoints)
      }
    }
    if (instance.hitPoints <= 0) {
      instance.die?.()
    } else {
      typeof instance.isAttacked === 'function' && instance.isAttacked(this.owner)
    }
  }

  die() {
    this.createImpactEffect(this.x, this.y)
    this.isDead = true
    if (this.interval != null) this.context.scheduler.remove(this.interval)
    this.interval = null
    this.destroy({ children: true, texture: false })
  }
}
