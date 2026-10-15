import { getBuildingAttackRange } from '../lib/buildings/towerCombat'
import type { Container, ContainerChild, Graphics } from 'pixi.js'
import {
  average,
  degreeToDirection,
  getInstanceZIndex,
  getPointsDegree,
  getReliefOffset,
  pointsDistance,
  uuidv4,
} from '../lib/maths'
import { moveTowardPoint } from '../lib/grid/movement'
import { addDisplayObjectToMapSpaceContainer, getEntitySpaceMapLike } from '../lib/mapSpaces'
import { getEffectiveProjectileType } from '../lib/projectiles'
import { playAudibleSoundCue, type AudibleInstance } from '../lib/audio/sound'
import { getUnitCombatRange } from '../lib/equipment/equipmentStats'
import { CELL_DEPTH, FAMILY_TYPES, LABEL_TYPES, STEP_TIME } from '../constants'
import type { GameContextLike, SchedulerTaskId } from '../types/context'
import type { CommandSound, ResourceEntity, RuntimeEntity, UnitEntity } from '../types/entities'
import type { Point } from '../types/grid'
import {
  PROJECTILE_CELL_DISTANCE,
  PROJECTILE_MIN_DAMAGE_FACTOR,
  PROJECTILE_MIN_SPEED_FACTOR,
  PROJECTILE_SLOWDOWN_START,
  debugProjectileGeometry,
  getProjectileDestinationVisualDelta,
  getProjectileVisualOffset,
  canUseEmbeddedMask,
  getEmbeddedMaskJitter,
} from './ProjectileGeometry'
import type { EmbeddedMaskKind, ProjectileSprite } from '../rendering/pixi/PixiProjectileVisuals'
import {
  canProjectileCollideWith,
  findProjectileCollisionTarget,
  findProjectileTreeCollision,
  getProjectileCollisionCandidates,
} from './ProjectileCollision'
import { applyProjectileHit, getProjectileXpCategory } from './ProjectileImpact'
import {
  clearProjectile,
  destroyProjectile,
  landProjectileOnGround,
  stickProjectileInTree,
  stopProjectileTimeout,
} from './ProjectileLifecycle'
import { PixiProjectileView } from '../rendering/pixi/PixiProjectileView'
import { projectileVisualState, type ProjectileVisualState } from '../rendering/ProjectileView'
import { createProjectileTrajectoryState, sampleProjectileTrajectory } from './ProjectileTrajectory'

type ProjectileOptions = {
  owner: RuntimeEntity
  type: string
  target?: RuntimeEntity
  destination?: Point
  spawnPoint?: Point
  spaceId?: string
  degree?: number
  weaponPower?: number
  maxDistance?: number
}

type ProjectileSpawnOffset = { x?: number; y?: number }

export class Projectile {
  context: GameContextLike
  label: string
  family: string
  interval: SchedulerTaskId | null
  timeoutId: SchedulerTaskId | null
  isDestroyed: boolean
  sprite?: ProjectileSprite
  shadow?: ProjectileSprite
  private readonly projectileView: PixiProjectileView
  private mapX = 0
  private mapY = 0
  private renderOrder = 0
  private renderAlpha = 1
  private renderVisible = true

  get displayObject(): Container { return this.projectileView.container }
  get x(): number { return this.mapX }
  set x(value: number) { this.mapX = value; if (this.projectileView) this.displayObject.x = value }
  get y(): number { return this.mapY }
  set y(value: number) { this.mapY = value; if (this.projectileView) this.displayObject.y = value }
  get zIndex(): number { return this.renderOrder }
  set zIndex(value: number) { this.renderOrder = value; if (this.projectileView) this.displayObject.zIndex = value }
  get alpha(): number { return this.renderAlpha }
  set alpha(value: number) { this.renderAlpha = value; if (this.projectileView) this.displayObject.alpha = value }
  get visible(): boolean { return this.renderVisible }
  set visible(value: boolean) { this.renderVisible = value; if (this.projectileView) this.displayObject.visible = value }
  get parent(): Container | null { return this.projectileView?.container.parent ?? null }
  get position(): Container['position'] { return this.displayObject.position }
  get destroyed(): boolean { return this.projectileView?.container.destroyed ?? false }
  get width(): number { return this.projectileView?.container.width ?? 0 }
  get height(): number { return this.projectileView?.container.height ?? 0 }
  addChild: Container['addChild'] = ((...children: ContainerChild[]) =>
    this.displayObject.addChild(...children)) as Container['addChild']
  once: Container['once'] = ((...args: Parameters<Container['once']>) =>
    this.displayObject.once(...args)) as Container['once']
  destroy(options?: Parameters<Container['destroy']>[0]): void {
    this.displayObject.destroy(options)
  }

  owner!: RuntimeEntity
  type!: string
  target?: RuntimeEntity
  destination?: Point
  spawnPoint?: Point
  spaceId?: string
  degree?: number
  direction?: string
  weaponPower?: number
  isDead!: boolean
  // Grid cell the projectile landed on — only set once it sticks in the ground, see landOnGround().
  i!: number
  j!: number
  z!: number
  destinationPoint!: Point
  groundOrigin!: Point
  terrainOrigin!: Point
  terrainDestination!: Point
  totalDistance!: number
  spawnOrigin!: Point
  maxDistance?: number
  slowDownStart?: number
  minSpeedFactor?: number
  minDamageFactor?: number
  trajectoryState: { kind: string; arcHeight: number } | null = null
  // Current height (px) above the ground point directly below the projectile. Flight sampling
  // updates it without a sprite because tree collision needs it even when shadows are hidden.
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
  directionalSpawnOffsets?: Record<string, ProjectileSpawnOffset>
  fullCircleStartDegree?: number
  trajectory?: { kind: string; minArcHeight?: number; arcHeightFactor?: number; maxArcHeight?: number }
  impactEffect?: { assets: string; animationSpeed?: number; scale?: number }
  sounds?: { launch?: CommandSound; impact?: CommandSound }

  constructor(options: ProjectileOptions, context: GameContextLike) {
    this.context = context
    this.label = uuidv4()
    this.family = FAMILY_TYPES.projectile
    this.projectileView = new PixiProjectileView(this)
    this.interval = null
    this.timeoutId = null
    this.isDestroyed = false

    Object.assign(this, options)
    this.spaceId = options.spaceId ?? this.owner.spaceId
    const player = this.owner.owner
    if (!player) throw new Error('Projectile owner must belong to a player')
    this.type = getEffectiveProjectileType(this.type, player)
    const projectileDefinition = player.config.projectiles?.[this.type] ?? player.config.projectiles?.[options.type]
    if (projectileDefinition) {
      const { scale, ...projectileConfig } = projectileDefinition
      Object.assign(this, projectileConfig)
      this.projectileScale = scale
    }
    this.maxDistance = options.maxDistance ?? this.maxDistance ?? this.getOwnerProjectileMaxDistance()

    const targetPoint = this.destination || this.target
    if (!targetPoint) {
      this.isDead = true
      return
    }
    const ownerSpriteHeight = this.owner.sprite?.height ?? 0
    const baseX = this.spawnPoint?.x ?? this.owner.x + (this.spawnOffsetX ?? 0)
    const baseY =
      this.spawnPoint?.y ??
      this.owner.y + getProjectileVisualOffset(this.owner) - ownerSpriteHeight / 2 + (this.spawnOffsetY ?? 0)
    // this.destination (when set) is a plain world point, never an instance with relief lift.
    let { x: targetX } = targetPoint
    let targetY =
      targetPoint.y +
      (this.destination ? getProjectileDestinationVisualDelta(this) : getProjectileVisualOffset(this.target))
    const degree = this.degree || getPointsDegree(baseX, baseY, targetX, targetY)
    this.direction = degreeToDirection(degree)
    const directionalSpawnOffset =
      !this.spawnPoint && this.direction ? this.directionalSpawnOffsets?.[this.direction] : undefined
    this.x = baseX + (directionalSpawnOffset?.x ?? 0)
    this.y = baseY + (directionalSpawnOffset?.y ?? 0)
    this.z = this.owner.z ?? 0

    playAudibleSoundCue(this as AudibleInstance, this.sounds?.launch, { profile: 'projectile' })

    const sprite = this.createSprite(degree)
    this.sprite = sprite
    this.spawnOrigin = { x: this.x, y: this.y }
    this.groundOrigin = { x: this.owner.x, y: this.owner.y + getReliefOffset(this.owner) }
    this.terrainOrigin = { x: this.owner.x, y: this.owner.y }
    this.terrainDestination = this.destination
      ? { x: this.destination.x, y: this.destination.y }
      : { x: targetPoint.x, y: targetPoint.y }
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
    debugProjectileGeometry(this, this.destinationPoint)

    this.interval = this.context.scheduler.add(
      () => {
        if (this.isDead || this.isDestroyed) return
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

  attachToMapSpace(): void {
    Object.assign(this.displayObject, { spaceId: this.spaceId })
    addDisplayObjectToMapSpaceContainer(this.context.map, this.displayObject)
  }

  getVisualState(): ProjectileVisualState {
    return projectileVisualState(this, getEntitySpaceMapLike(this, this.context.map))
  }

  createShadowSprite(source: ProjectileSprite): ProjectileSprite {
    return this.projectileView.createShadowSprite(source)
  }

  createSprite(degree: number): ProjectileSprite {
    return this.projectileView.createSprite(degree)
  }

  createTrajectoryState() {
    return createProjectileTrajectoryState(this)
  }

  getOwnerProjectileMaxDistance(): number | undefined {
    const ownerRange =
      this.owner.family === FAMILY_TYPES.unit
        ? getUnitCombatRange(this.owner as UnitEntity)
        : getBuildingAttackRange(this.owner)
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
    const frame = sampleProjectileTrajectory(this)
    this.currentAltitude = frame.altitude
    this.projectileView.updateTrajectory(frame)
  }

  updateShadowVisual(progress: number) {
    this.projectileView.updateShadow(progress)
  }

  createImpactEffect(x: number, y: number) {
    this.projectileView.createImpactEffect(x, y)
  }

  getProjectileScale(): number {
    return this.projectileScale ?? 1
  }

  canUseEmbeddedMask(): boolean {
    return canUseEmbeddedMask(this)
  }

  getEmbeddedMaskJitter(): number {
    return getEmbeddedMaskJitter(this)
  }

  applyEmbeddedMask(kind: EmbeddedMaskKind) {
    this.projectileView.applyEmbeddedMask(kind)
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
    return canProjectileCollideWith(this, instance)
  }

  getCollisionCandidates(): RuntimeEntity[] {
    return getProjectileCollisionCandidates(this)
  }

  findCollisionTarget(): RuntimeEntity | null {
    return findProjectileCollisionTarget(this)
  }

  // Swept-segment test (this tick's previous position -> new position) against nearby tree
  // trunks, rather than a point-radius test at the new position alone — a fast shot could
  // otherwise tunnel past a narrow trunk between two ticks. Skipped entirely once the shot is
  // flying above TREE_CANOPY_BLOCK_HEIGHT, so arced/lobbed projectiles can clear the canopy.
  findTreeCollision(previousX: number, previousY: number): ResourceEntity | null {
    return findProjectileTreeCollision(this, previousX, previousY)
  }

  // Hunting arrows train the hunting skill; every other unit-fired projectile
  // (archers, war boats, the hero-controlled unit's bow) trains the ranged-weapon skill.
  // Buildings (towers) fire projectiles too but never earn experience.
  getXpCategory(): string | null {
    return getProjectileXpCategory(this)
  }

  onHit(instance: RuntimeEntity) {
    applyProjectileHit(this, instance)
  }

  die() {
    destroyProjectile(this)
  }

  // A shot that missed: instead of despawning immediately, stick around as a purely decorative
  // ground prop (no damage, no collision — it never re-enters the movement/collision loop) for
  // ARROW_GROUND_TIME, then fade away. Registered in cell.corpses so it also disappears instantly
  // if a building goes up on top of it, the same way unit and animal corpses do.
  landOnGround() {
    landProjectileOnGround(this)
  }

  // A shot blocked by a tree trunk: freeze it and re-parent into the tree's own container (after
  // shadow/sprite in its children, so it draws in front of the trunk, embedded like a stuck
  // arrow) instead of the cell.corpses route landOnGround() uses. The display gains the tree's
  // depth while the projectile keeps its map coordinates. If the tree is felled, the display rides
  // with the tree's own destroy({children: true}) cascade. That cascade bypasses our own clear(),
  // so listen for Pixi's 'destroyed' event to keep isDestroyed/the fade timer in sync regardless
  // of which path tears this down.
  stickInTree(tree: ResourceEntity) {
    stickProjectileInTree(this, tree)
  }

  stopTimeout() {
    stopProjectileTimeout(this)
  }

  clear() {
    clearProjectile(this)
  }
}
