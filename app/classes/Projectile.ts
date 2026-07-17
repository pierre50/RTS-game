import { AnimatedSprite, Assets, Container } from 'pixi.js'
import {
  degreesToRadians,
  getHitPointsWithDamage,
  getInstanceZIndex,
  isFriendlyTarget,
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
import { showDamageFeedback } from '../lib/combatFeedback'
import { CELL_HEIGHT, CELL_WIDTH, FAMILY_TYPES, LABEL_TYPES, MENU_INFO_IDS, STEP_TIME, UNIT_TYPES } from '../constants'
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
  spawnPoint?: Point
  degree?: number
  damage?: number
  maxDistance?: number
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
const PROJECTILE_CELL_DISTANCE = Math.hypot(CELL_WIDTH, CELL_HEIGHT)
const PROJECTILE_SLOWDOWN_START = 0.65
const PROJECTILE_MIN_SPEED_FACTOR = 0.18
const PROJECTILE_MIN_DAMAGE_FACTOR = 0.35
const PROJECTILE_COLLISION_SCALE = 0.35

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
  spawnPoint?: Point
  degree?: number
  direction?: string
  damage?: number
  tracksTarget!: boolean
  isDead!: boolean
  z!: number
  destinationPoint!: Point
  groundOrigin!: Point
  totalDistance!: number
  spawnOrigin!: Point
  maxDistance?: number
  slowDownStart?: number
  minSpeedFactor?: number
  minDamageFactor?: number
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
    this.maxDistance = options.maxDistance ?? this.maxDistance ?? this.getOwnerProjectileMaxDistance()

    const ownerSpriteHeight = this.owner.sprite?.height ?? 0
    this.x = this.spawnPoint?.x ?? this.owner.x + (this.spawnOffsetX ?? 0)
    this.y = this.spawnPoint?.y ?? this.owner.y - ownerSpriteHeight / 2 + (this.spawnOffsetY ?? 0)
    this.z = this.owner.z ?? 0
    const targetPoint = this.destination || this.target
    if (!targetPoint) {
      this.isDead = true
      return
    }
    let { x: targetX, y: targetY } = targetPoint

    playAudibleSoundCue(this as AudibleInstance, this.sounds?.launch)

    const degree = this.degree || getPointsDegree(this.x, this.y, targetX, targetY)
    this.direction = degreeToDirection(degree)
    this.zIndex = this.getProjectileZIndex()
    const sprite = this.createSprite(degree)
    this.sprite = sprite
    this.spawnOrigin = { x: this.x, y: this.y }
    this.groundOrigin = { x: this.owner.x, y: this.owner.y }
    this.destinationPoint = this.getVisualDestinationPoint(targetX, targetY)
    this.totalDistance = Math.max(
      pointsDistance(this.spawnOrigin.x, this.spawnOrigin.y, this.destinationPoint.x, this.destinationPoint.y),
      1
    )
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
          this.destinationPoint = this.getVisualDestinationPoint(targetX, targetY)
          this.totalDistance = Math.max(
            pointsDistance(this.spawnOrigin.x, this.spawnOrigin.y, this.destinationPoint.x, this.destinationPoint.y),
            1
          )
          this.trajectoryState = this.createTrajectoryState()
        }
        let currentSpeed = this.getCurrentSpeed()
        const traveledDistance = this.getTraveledDistance()
        if (this.maxDistance && traveledDistance >= this.maxDistance) {
          this.die()
          return
        }
        if (this.maxDistance) {
          currentSpeed = Math.min(currentSpeed, this.maxDistance - traveledDistance)
        }
        if (pointsDistance(this.x, this.y, targetX, targetY) <= Math.max(currentSpeed, this.size)) {
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
        moveTowardPoint(this, targetX, targetY, currentSpeed)
        const collisionTarget = this.findCollisionTarget()
        if (collisionTarget) {
          this.onHit(collisionTarget)
          this.die()
          return
        }
        this.updateTrajectoryVisual()
        this.zIndex = this.getProjectileZIndex()
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

  getOwnerProjectileMaxDistance(): number | undefined {
    const ownerRange =
      this.owner.type === UNIT_TYPES.villager && this.type === 'Spear'
        ? (this.owner as { huntRange?: number }).huntRange || 4
        : (this.owner as { range?: number }).range
    return ownerRange ? ownerRange * PROJECTILE_CELL_DISTANCE : undefined
  }

  getVisualDestinationPoint(targetX: number, targetY: number): Point {
    if (!this.maxDistance) return { x: targetX, y: targetY }

    const origin = this.spawnOrigin ?? { x: this.x, y: this.y }
    const distance = pointsDistance(origin.x, origin.y, targetX, targetY)
    if (distance <= this.maxDistance) return { x: targetX, y: targetY }

    const ratio = this.maxDistance / distance
    return {
      x: origin.x + (targetX - origin.x) * ratio,
      y: origin.y + (targetY - origin.y) * ratio,
    }
  }

  getTraveledDistance(): number {
    return pointsDistance(this.spawnOrigin.x, this.spawnOrigin.y, this.x, this.y)
  }

  getRangeProgress(): number {
    if (!this.maxDistance) return 0
    return Math.max(0, Math.min(1, this.getTraveledDistance() / this.maxDistance))
  }

  getFalloffProgress(): number {
    const slowDownStart = this.slowDownStart ?? PROJECTILE_SLOWDOWN_START
    if (!this.maxDistance || slowDownStart >= 1) return 0
    return Math.max(0, Math.min(1, (this.getRangeProgress() - slowDownStart) / (1 - slowDownStart)))
  }

  getCurrentSpeed(): number {
    const falloffProgress = this.getFalloffProgress()
    if (falloffProgress <= 0) return this.speed
    const minSpeedFactor = this.minSpeedFactor ?? PROJECTILE_MIN_SPEED_FACTOR
    return Math.max(this.size, this.speed * (1 - falloffProgress * (1 - minSpeedFactor)))
  }

  getDamageFactor(): number {
    const falloffProgress = this.getFalloffProgress()
    if (falloffProgress <= 0) return 1
    const minDamageFactor = this.minDamageFactor ?? PROJECTILE_MIN_DAMAGE_FACTOR
    return 1 - falloffProgress * (1 - minDamageFactor)
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

  getProjectileZIndex(): number {
    const zIndex = getInstanceZIndex(this)
    // Firing north means the arrow travels away from the camera behind the shooter's
    // back, so it must not win the depth sort over the unit it was just fired from.
    return this.direction === 'north' ? zIndex : zIndex + PROJECTILE_Z_OFFSET
  }

  canCollideWith(instance: RuntimeEntity): boolean {
    if (
      instance === this.owner ||
      isFriendlyTarget(this.owner, instance) ||
      instance.isDead ||
      instance.isDestroyed ||
      (instance.hitPoints ?? 0) <= 0
    ) {
      return false
    }
    return instance.family === FAMILY_TYPES.unit || instance.family === FAMILY_TYPES.animal
  }

  getCollisionCandidates(): RuntimeEntity[] {
    const candidates = new Set<RuntimeEntity>()
    if (this.target) candidates.add(this.target)
    for (const player of this.context.players ?? []) {
      for (const unit of player.units ?? []) candidates.add(unit)
      for (const animal of player.animals ?? []) candidates.add(animal)
    }
    const gaia = this.context.map.gaia
    for (const animal of gaia?.animals ?? []) candidates.add(animal)
    return [...candidates].filter(instance => this.canCollideWith(instance))
  }

  findCollisionTarget(): RuntimeEntity | null {
    let closest: RuntimeEntity | null = null
    let closestDistance = Infinity
    for (const candidate of this.getCollisionCandidates()) {
      const collisionRadius = Math.max(
        this.size,
        average(candidate.width || CELL_WIDTH, candidate.height || CELL_HEIGHT) * PROJECTILE_COLLISION_SCALE
      )
      const distance = pointsDistance(this.x, this.y, candidate.x, candidate.y)
      if (distance > collisionRadius || distance >= closestDistance) continue
      closest = candidate
      closestDistance = distance
    }
    return closest
  }

  onHit(instance: RuntimeEntity) {
    const {
      context: { menu, player },
    } = this
    if (instance.family === FAMILY_TYPES.building) {
      playAudibleSoundCue(this as AudibleInstance, this.sounds?.impact)
    }
    const damageFactor = this.getDamageFactor()
    const damage = this.damage == null ? undefined : Math.max(1, Math.round(this.damage * damageFactor))
    const source =
      damageFactor >= 1
        ? this.owner
        : {
            ...this.owner,
            meleeAttack: Math.max(
              0,
              Math.round(((this.owner as { meleeAttack?: number }).meleeAttack ?? 0) * damageFactor)
            ),
            pierceAttack: Math.max(
              0,
              Math.round(((this.owner as { pierceAttack?: number }).pierceAttack ?? 0) * damageFactor)
            ),
          }
    const beforeHitPoints = instance.hitPoints ?? 0
    instance.hitPoints = getHitPointsWithDamage(source, instance, damage)
    showDamageFeedback(instance, beforeHitPoints - (instance.hitPoints ?? 0))
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
