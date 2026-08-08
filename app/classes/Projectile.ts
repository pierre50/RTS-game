import { AnimatedSprite, Assets, Container, Graphics } from 'pixi.js'
import {
  DEFAULT_HUNT_RANGE,
  degreesToRadians,
  applyCombatHit,
  getInstanceZIndex,
  getReliefOffset,
  getTerrainSetZIndex,
  HUNTING_SPEAR_PROJECTILE,
  isFriendlyTarget,
  isometricToCartesian,
  moveTowardPoint,
  pointIsBetweenTwoPoint,
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
  randomRange,
} from '../lib'
import { fadeOutThenClear } from '../lib/entityFade'
import { getCombatXpBonus, XP_CATEGORIES } from '../lib/unitExperience'
import {
  ARROW_GROUND_TIME,
  BUCKET_SIZE,
  CELL_DEPTH,
  CELL_HEIGHT,
  CELL_WIDTH,
  FADE_DURATION_MS,
  FAMILY_TYPES,
  LABEL_TYPES,
  RESOURCE_TYPES,
  STEP_TIME,
  UNIT_TYPES,
} from '../constants'
import { getShadowsEnabled } from '../lib/settings'
import type { Texture } from 'pixi.js'
import type { GameContextLike, SchedulerTaskId } from '../types/context'
import type { CommandSound, ResourceEntity, RuntimeEntity, UnitEntity } from '../types/entities'
import type { RuntimeMap } from '../types/map'
import type { Point } from '../types/grid'
import type { AudibleInstance } from '../lib'

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
type EmbeddedMaskKind = 'ground' | 'tree'

const PROJECTILE_SHADOW_ALPHA = 0.42
const PROJECTILE_SHADOW_MAX_ALTITUDE_FADE = 0.28
const PROJECTILE_SHADOW_MAX_ALTITUDE_SCALE = 0.35
const PROJECTILE_SHADOW_SCALE_Y = 0.48
const PROJECTILE_CELL_DISTANCE = Math.hypot(CELL_WIDTH, CELL_HEIGHT)
const PROJECTILE_SLOWDOWN_START = 0.65
const PROJECTILE_MIN_SPEED_FACTOR = 0.18
const PROJECTILE_MIN_DAMAGE_FACTOR = 0.35
const PROJECTILE_COLLISION_SCALE = 0.35
// Small fixed hitbox around a tree's anchor point — deliberately much smaller than the canopy
// sprite, which visually overlaps neighboring tiles. Using the sprite's bounds instead would
// block shots that only cross rendered foliage pixels while their real ground path passes beside
// the tree.
const TREE_TRUNK_RADIUS = 10
// Shots flying higher above the ground than this (arced lobs, mostly) are treated as clearing the
// canopy and never test against trees at all.
const TREE_CANOPY_BLOCK_HEIGHT = 90
// Cartesian-cell radius used to gather bucket candidates around the projectile's current cell —
// comfortably larger than the trunk radius plus a tick's worth of travel, in cell units.
const TREE_SEARCH_RADIUS = 1.5
const TREE_STICK_JITTER = 5
const TREE_STICK_HEIGHT = 10
const EMBEDDED_MASK_PROJECTILE_TYPES = new Set(['Arrow', 'FireArrow', 'Spear', 'Bolt', 'FireBolt'])
const EMBEDDED_MASK_SIZE = 256
const GROUND_EMBED_DEPTH = 5
const TREE_EMBED_DEPTH = 4
const EMBED_DEPTH_JITTER = 3
const EMBEDDED_TIP_DEPTH = 9
const EMBEDDED_PARALLEL_CUT_THRESHOLD = 0.35

type HalfPlane = {
  normalX: number
  normalY: number
  limit: number
}

function halfPlaneValue(point: Point, plane: HalfPlane): number {
  return point.x * plane.normalX + point.y * plane.normalY
}

function clipPolygonWithHalfPlane(polygon: Point[], plane: HalfPlane): Point[] {
  const clipped: Point[] = []
  for (let index = 0; index < polygon.length; index++) {
    const current = polygon[index]
    const previous = polygon[(index + polygon.length - 1) % polygon.length]
    const currentValue = halfPlaneValue(current, plane)
    const previousValue = halfPlaneValue(previous, plane)
    const currentInside = currentValue <= plane.limit
    const previousInside = previousValue <= plane.limit

    if (currentInside !== previousInside) {
      const progress = (plane.limit - previousValue) / (currentValue - previousValue)
      clipped.push({
        x: previous.x + (current.x - previous.x) * progress,
        y: previous.y + (current.y - previous.y) * progress,
      })
    }
    if (currentInside) clipped.push(current)
  }
  return clipped
}

function findNearbyTrees(map: RuntimeMap, i: number, j: number): ResourceEntity[] {
  const buckets = map.instanceBuckets
  if (!buckets || !buckets.length) return []

  const minBi = Math.max(Math.floor((i - TREE_SEARCH_RADIUS) / BUCKET_SIZE), 0)
  const maxBi = Math.min(Math.floor((i + TREE_SEARCH_RADIUS) / BUCKET_SIZE), buckets.length - 1)
  const minBj = Math.max(Math.floor((j - TREE_SEARCH_RADIUS) / BUCKET_SIZE), 0)
  const maxBj = Math.min(Math.floor((j + TREE_SEARCH_RADIUS) / BUCKET_SIZE), (buckets[0]?.length ?? 1) - 1)

  const trees: ResourceEntity[] = []
  for (let bi = minBi; bi <= maxBi; bi++) {
    for (let bj = minBj; bj <= maxBj; bj++) {
      for (const instance of buckets[bi]?.[bj] ?? []) {
        if (instance.family === FAMILY_TYPES.resource && (instance as ResourceEntity).type === RESOURCE_TYPES.tree) {
          trees.push(instance as ResourceEntity)
        }
      }
    }
  }
  return trees
}

function getProjectileVisualOffset(instance: RuntimeEntity | null | undefined): number {
  const mountedRiderY = instance?.getMountedRiderY?.()
  return typeof mountedRiderY === 'number' && Number.isFinite(mountedRiderY) ? mountedRiderY : getReliefOffset(instance)
}

function getProjectileDestinationVisualDelta(projectile: { target?: RuntimeEntity; destination?: Point }): number {
  if (!projectile.target || !projectile.destination) return 0
  return getProjectileVisualOffset(projectile.target) - getReliefOffset(projectile.target)
}

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
  timeoutId: SchedulerTaskId | null
  isDestroyed: boolean
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
  // Grid cell the projectile landed on — only set once it sticks in the ground, see landOnGround().
  i!: number
  j!: number
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
  // Current height (px) above the ground point directly below the projectile — kept in sync each
  // tick by updateTrajectoryVisual() regardless of whether shadows are visually enabled, since
  // tree-trunk collision needs it to tell an overhead arced shot from a trunk-level one.
  currentAltitude: number = 0
  // Set once the projectile embeds in a tree, see stickInTree() — used by clear() to know it must
  // not touch cell.corpses (only ground-landed/grid-registered projectiles use that).
  treeAnchor?: ResourceEntity | null
  embeddedMask?: Graphics | null

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
    this.timeoutId = null
    this.isDestroyed = false

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
    this.y =
      this.spawnPoint?.y ??
      this.owner.y + getProjectileVisualOffset(this.owner) - ownerSpriteHeight / 2 + (this.spawnOffsetY ?? 0)
    this.z = this.owner.z ?? 0
    const targetPoint = this.destination || this.target
    if (!targetPoint) {
      this.isDead = true
      return
    }
    // this.destination (when set) is a plain world point, never an instance with relief lift.
    let { x: targetX } = targetPoint
    let targetY =
      targetPoint.y +
      (this.destination ? getProjectileDestinationVisualDelta(this) : getProjectileVisualOffset(this.target))

    playAudibleSoundCue(this as AudibleInstance, this.sounds?.launch)

    const degree = this.degree || getPointsDegree(this.x, this.y, targetX, targetY)
    this.direction = degreeToDirection(degree)
    const sprite = this.createSprite(degree)
    this.sprite = sprite
    this.spawnOrigin = { x: this.x, y: this.y }
    this.groundOrigin = { x: this.owner.x, y: this.owner.y + getReliefOffset(this.owner) }
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
    this.zIndex = this.getProjectileZIndex()

    this.interval = this.context.scheduler.add(
      () => {
        if (this.tracksTarget && this.target && !this.target.isDead && !this.target.isDestroyed) {
          targetX = this.target.x
          targetY = this.target.y + getProjectileVisualOffset(this.target)
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
          this.landOnGround()
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
            pointsDistance(targetX, targetY, this.target.x, this.target.y + getProjectileVisualOffset(this.target)) <=
              average(this.target.width, this.target.height)
          ) {
            this.onHit(this.target)
            this.die()
          } else {
            this.landOnGround()
          }
          return
        }
        const previousX = this.x
        const previousY = this.y
        moveTowardPoint(this, targetX, targetY, currentSpeed)
        this.updateTrajectoryVisual()
        const collisionTarget = this.findCollisionTarget()
        if (collisionTarget) {
          this.onHit(collisionTarget)
          this.die()
          return
        }
        const treeCollision = this.findTreeCollision(previousX, previousY)
        if (treeCollision) {
          this.stickInTree(treeCollision)
          return
        }
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
      this.owner.type === UNIT_TYPES.villager && this.type === HUNTING_SPEAR_PROJECTILE
        ? (this.owner as { huntRange?: number }).huntRange || DEFAULT_HUNT_RANGE
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
    const groundY = this.groundOrigin.y + (this.destinationPoint.y - this.groundOrigin.y) * progress
    this.currentAltitude = Math.max(0, groundY - (this.y + this.sprite.y))
    this.updateShadowVisual(progress)
  }

  updateShadowVisual(progress: number) {
    if (!this.shadow || !this.sprite) return
    this.shadow.visible = getShadowsEnabled()
    if (!this.shadow.visible) return

    const groundX = this.groundOrigin.x + (this.destinationPoint.x - this.groundOrigin.x) * progress
    const groundY = this.groundOrigin.y + (this.destinationPoint.y - this.groundOrigin.y) * progress
    const altitudeRatio = Math.max(0, Math.min(1, this.currentAltitude / 180))
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

  canUseEmbeddedMask(): boolean {
    return EMBEDDED_MASK_PROJECTILE_TYPES.has(this.type)
  }

  getEmbeddedMaskJitter(): number {
    const seed = Math.abs(Math.round(this.x * 13 + this.y * 17 + (this.degree ?? 0) * 7))
    return (seed % (EMBED_DEPTH_JITTER * 2 + 1)) - EMBED_DEPTH_JITTER
  }

  applyEmbeddedMask(kind: EmbeddedMaskKind) {
    if (!this.sprite || !this.canUseEmbeddedMask()) return

    if (this.embeddedMask) {
      this.sprite.mask = null
      this.embeddedMask.destroy()
      this.embeddedMask = null
    }

    const mask = new Graphics()
    mask.label = `${kind}-embedded-mask`
    mask.eventMode = 'none'

    const maxScale = Math.max(1, Math.abs(this.sprite.scale.x), Math.abs(this.sprite.scale.y))
    const size = EMBEDDED_MASK_SIZE * maxScale
    const half = size / 2
    const travelX = this.destinationPoint.x - this.spawnOrigin.x
    const travelY = this.destinationPoint.y - this.spawnOrigin.y
    const travelLength = Math.max(1, Math.hypot(travelX, travelY))
    const unitX = travelX / travelLength
    const unitY = travelY / travelLength
    const spriteLength = Math.max(this.sprite.texture.width, this.sprite.texture.height) * maxScale
    const tipX = unitX * (spriteLength / 2)
    const tipY = this.sprite.y + unitY * (spriteLength / 2)
    const depth = (kind === 'ground' ? GROUND_EMBED_DEPTH : TREE_EMBED_DEPTH) + this.getEmbeddedMaskJitter()
    let polygon: Point[] = [
      { x: -half, y: -half },
      { x: half, y: -half },
      { x: half, y: half },
      { x: -half, y: half },
    ]

    if (kind === 'ground') {
      const direction = travelY >= 0 ? 1 : -1
      const cutY = tipY - direction * depth
      polygon = clipPolygonWithHalfPlane(polygon, {
        normalX: 0,
        normalY: direction,
        limit: direction * cutY,
      })
      if (Math.abs(unitY) < EMBEDDED_PARALLEL_CUT_THRESHOLD) {
        polygon = clipPolygonWithHalfPlane(polygon, {
          normalX: unitX,
          normalY: unitY,
          limit: tipX * unitX + tipY * unitY - EMBEDDED_TIP_DEPTH,
        })
      }
    } else {
      const direction = travelX >= 0 ? 1 : -1
      const cutX = tipX - direction * depth
      polygon = clipPolygonWithHalfPlane(polygon, {
        normalX: direction,
        normalY: 0,
        limit: direction * cutX,
      })
      if (Math.abs(unitX) < EMBEDDED_PARALLEL_CUT_THRESHOLD) {
        polygon = clipPolygonWithHalfPlane(polygon, {
          normalX: unitX,
          normalY: unitY,
          limit: tipX * unitX + tipY * unitY - EMBEDDED_TIP_DEPTH,
        })
      }
    }

    if (polygon.length < 3) {
      mask.destroy()
      return
    }

    mask.poly(polygon.flatMap(point => [point.x, point.y]))
    mask.fill({ color: 0xffffff })
    this.addChild(mask)
    this.sprite.mask = mask
    this.embeddedMask = mask
  }

  // Same i+j depth key every other entity uses, nudged by how high the projectile currently
  // flies above the ground (in the same px-per-level units as ground relief, see
  // getGroundReliefLevel). A shot above canopy height outranks nearby trees and draws in front,
  // exactly when findTreeCollision() has already decided it flies over them uncollided; a shot
  // near ground level gets no meaningful nudge and sorts by position like anything else, so a
  // tree standing between the camera and the shooter still correctly occludes it. Since altitude
  // rises and falls over the flight, this naturally flips the sort order mid-flight instead of
  // fixing it at launch.
  getProjectileZIndex(): number {
    return getInstanceZIndex(this) + this.currentAltitude / CELL_DEPTH
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
    return (
      instance.family === FAMILY_TYPES.building ||
      instance.family === FAMILY_TYPES.unit ||
      instance.family === FAMILY_TYPES.animal
    )
  }

  getCollisionCandidates(): RuntimeEntity[] {
    const candidates = new Set<RuntimeEntity>()
    if (this.target) candidates.add(this.target)
    for (const player of this.context.players ?? []) {
      for (const building of player.buildings ?? []) candidates.add(building)
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
      const distance = pointsDistance(this.x, this.y, candidate.x, candidate.y + getProjectileVisualOffset(candidate))
      if (distance > collisionRadius || distance >= closestDistance) continue
      closest = candidate
      closestDistance = distance
    }
    return closest
  }

  // Swept-segment test (this tick's previous position -> new position) against nearby tree
  // trunks, rather than a point-radius test at the new position alone — a fast shot could
  // otherwise tunnel past a narrow trunk between two ticks. Skipped entirely once the shot is
  // flying above TREE_CANOPY_BLOCK_HEIGHT, so arced/lobbed projectiles can clear the canopy.
  findTreeCollision(previousX: number, previousY: number): ResourceEntity | null {
    if (this.currentAltitude > TREE_CANOPY_BLOCK_HEIGHT) return null

    const [i, j] = isometricToCartesian(this.x, this.y)
    let closest: ResourceEntity | null = null
    let closestDistance = Infinity
    for (const tree of findNearbyTrees(this.context.map, i, j)) {
      if (tree.isDead || tree.isDestroyed) continue
      if (
        !pointIsBetweenTwoPoint(
          { x: previousX, y: previousY },
          { x: this.x, y: this.y },
          { x: tree.x, y: tree.y },
          TREE_TRUNK_RADIUS
        )
      ) {
        continue
      }
      const distance = pointsDistance(this.x, this.y, tree.x, tree.y)
      if (distance >= closestDistance) continue
      closest = tree
      closestDistance = distance
    }
    return closest
  }

  // Hunting spears train the hunting skill; every other unit-fired projectile
  // (archers, war boats, the hero-controlled unit's bow) trains the ranged-weapon skill.
  // Buildings (towers) fire projectiles too but never earn experience.
  getXpCategory(): string | null {
    if (this.owner.family !== FAMILY_TYPES.unit) return null
    return this.owner.type === UNIT_TYPES.villager && this.type === HUNTING_SPEAR_PROJECTILE
      ? XP_CATEGORIES.hunting
      : XP_CATEGORIES.ranged
  }

  onHit(instance: RuntimeEntity) {
    const {
      context: { menu, player },
    } = this
    if (instance.family === FAMILY_TYPES.building) {
      playAudibleSoundCue(this as AudibleInstance, this.sounds?.impact)
    }
    const xpCategory = this.getXpCategory()
    const xpBonusDamage = xpCategory ? getCombatXpBonus(this.owner as UnitEntity, xpCategory) : 0
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
    applyCombatHit(source, instance, {
      attacker: this.owner,
      bonusDamage: xpBonusDamage,
      defaultDamage: damage,
      // Direction the shot was flying (spawn -> aim point), so a hit animal can bolt
      // continuing along that line — away from the shooter — instead of just away
      // from wherever the shooter happens to be standing at impact time.
      hitDirection: {
        x: this.destinationPoint.x - this.spawnOrigin.x,
        y: this.destinationPoint.y - this.spawnOrigin.y,
      },
      menu,
      notifyTarget: 'survived',
      player,
      xpCategory,
      xpUnit: xpCategory ? (this.owner as UnitEntity) : null,
    })
  }

  die() {
    this.createImpactEffect(this.x, this.y)
    this.isDead = true
    if (this.interval != null) this.context.scheduler.remove(this.interval)
    this.interval = null
    this.destroy({ children: true, texture: false })
  }

  // A shot that missed: instead of despawning immediately, stick around as a purely decorative
  // ground prop (no damage, no collision — it never re-enters the movement/collision loop) for
  // ARROW_GROUND_TIME, then fade away. Registered in cell.corpses so it also disappears instantly
  // if a building goes up on top of it, the same way unit/animal corpses and rubble do.
  landOnGround() {
    this.isDead = true
    if (this.interval != null) this.context.scheduler.remove(this.interval)
    this.interval = null

    const [i, j] = isometricToCartesian(this.x, this.y)
    this.i = i
    this.j = j
    const cell = this.context.map.grid[i]?.[j]
    // A shot that falls in water has nothing to stick into: skip the decorative
    // ground-prop path entirely and destroy it right away instead of fading over ARROW_GROUND_TIME.
    if (!cell || cell.category === 'Water' || cell.waterBorder) {
      this.clear()
      return
    }

    this.createImpactEffect(this.x, this.y)
    this.sprite?.stop()
    if (this.shadow) this.shadow.visible = false
    this.applyEmbeddedMask('ground')
    this.zIndex = getTerrainSetZIndex({ i, j })
    cell.corpses.add(this as unknown as RuntimeEntity)
    this.timeoutId = this.context.scheduler.addOneShot(
      () => fadeOutThenClear(this, FADE_DURATION_MS),
      ARROW_GROUND_TIME * 1000,
      'projectile.groundFade'
    )
  }

  // A shot blocked by a tree trunk: freeze it and re-parent into the tree's own container (after
  // shadow/sprite in its children, so it draws in front of the trunk, embedded like a stuck
  // arrow) instead of the cell.corpses route landOnGround() uses. This makes it inherit the
  // tree's depth for free and, if the tree is felled while the arrow is still stuck, ride along
  // with the tree's own destroy({children: true}) cascade. That cascade bypasses our own clear(),
  // so listen for Pixi's 'destroyed' event to keep isDestroyed/the fade timer in sync regardless
  // of which path tears this down.
  stickInTree(tree: ResourceEntity) {
    this.createImpactEffect(this.x, this.y)
    this.isDead = true
    if (this.interval != null) this.context.scheduler.remove(this.interval)
    this.interval = null
    this.sprite?.stop()
    if (this.shadow) this.shadow.visible = false
    this.applyEmbeddedMask('tree')

    this.treeAnchor = tree
    const jitterX = randomRange(-TREE_STICK_JITTER, TREE_STICK_JITTER)
    this.parent?.removeChild(this)
    this.position.set(this.x - tree.x + jitterX, this.y - tree.y + getReliefOffset(tree) - TREE_STICK_HEIGHT)
    tree.addChild?.(this)
    this.once('destroyed', () => {
      this.isDestroyed = true
      this.stopTimeout()
    })

    this.timeoutId = this.context.scheduler.addOneShot(
      () => fadeOutThenClear(this, FADE_DURATION_MS),
      ARROW_GROUND_TIME * 1000,
      'projectile.treeFade'
    )
  }

  stopTimeout() {
    if (this.timeoutId != null) {
      this.context.scheduler.remove(this.timeoutId)
      this.timeoutId = null
    }
  }

  clear() {
    if (this.isDestroyed) return
    this.isDestroyed = true
    this.stopTimeout()
    if (this.treeAnchor) {
      this.treeAnchor = null
    } else {
      const cell = this.context.map.grid[this.i]?.[this.j]
      cell?.corpses.delete(this as unknown as RuntimeEntity)
    }
    this.parent?.removeChild(this)
    this.destroy({ children: true, texture: false })
  }
}
