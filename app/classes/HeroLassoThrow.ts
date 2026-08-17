import { Graphics } from 'pixi.js'
import { CELL_HEIGHT, CELL_WIDTH, FAMILY_TYPES, STEP_TIME } from '../constants'
import { getReliefOffset } from '../lib'
import { degreeToDirection, pointIsBetweenTwoPoint, pointsDistance } from '../lib/maths'
import { t } from '../lib/lang'
import {
  HORSE_CAPTURE_STABLE_MAX_DISTANCE,
  HORSE_CAPTURE_STABLE_TIMEOUT_MS,
  routeCapturedHorseToStableWithOwnerContact,
} from '../lib/horseCapture'
import { findTreeSegmentCollision } from '../lib/treeCollision'
import { spookWildHorse } from '../lib/wildHorseBehavior'
import type { AnimalEntity, RuntimeEntity, UnitEntity } from '../types/entities'
import type { GameContextLike, SchedulerTaskId } from '../types/context'
import type { Point } from '../types/grid'
import type { RuntimeCell } from '../types/map'

const LASSO_MAX_DISTANCE = Math.hypot(CELL_WIDTH, CELL_HEIGHT) * 4
const LASSO_SPEED = 18
const LASSO_RETRACT_SPEED = 24
const LASSO_HIT_THICKNESS = 18
const LASSO_TREE_THICKNESS = 12
const LASSO_LINE_COLOR = 0x583126
const LASSO_BORDER_COLOR = 0x000000
const LASSO_LINE_WIDTH = 1
const LASSO_BORDER_WIDTH = 3
const LASSO_LOOP_RADIUS = 10
const LASSO_START_HEIGHT = 18
const LASSO_FOLLOW_DISTANCE = Math.hypot(CELL_WIDTH, CELL_HEIGHT) * 1.8
const LASSO_REPATH_DISTANCE = Math.hypot(CELL_WIDTH, CELL_HEIGHT) * 2.4
const LASSO_REPATH_INTERVAL_MS = 300
const LASSO_HAND_FRAME_COUNT = 8
const LASSO_HORSE_NECK_FRAME_COUNT = 6
const LASSO_DEFAULT_Z_OFFSET = 2
const LASSO_ATTACHED_HORSE_Z_OFFSET = -1
const LASSO_HAND_OFFSETS = {
  north: [
    { x: -9, y: -7 },
    { x: -9, y: -7 },
    { x: -10, y: -7 },
    { x: -9, y: -7 },
    { x: -9, y: -7 },
    { x: -7, y: -8 },
    { x: -6, y: -8 },
    { x: -8, y: -8 },
  ],
  west: [
    { x: -10, y: -9 },
    { x: -8, y: -7 },
    { x: -8, y: -5 },
    { x: -8, y: -5 },
    { x: -12, y: -7 },
    { x: -11, y: -7 },
    { x: -11, y: -8 },
    { x: -10, y: -7 },
  ],
  south: [
    { x: 8, y: -7 },
    { x: 8, y: -7 },
    { x: 9, y: -7 },
    { x: 8, y: -7 },
    { x: 8, y: -7 },
    { x: 6, y: -6 },
    { x: 5, y: -8 },
    { x: 7, y: -6 },
  ],
} as const
const LASSO_HORSE_NECK_OFFSETS = {
  north: [
    { x: 0, y: -34 },
    { x: 0, y: -35 },
    { x: 0, y: -34 },
    { x: 0, y: -33 },
    { x: 0, y: -34 },
    { x: 0, y: -35 },
  ],
  west: [
    { x: -24, y: -31 },
    { x: -25, y: -32 },
    { x: -24, y: -33 },
    { x: -23, y: -32 },
    { x: -24, y: -31 },
    { x: -25, y: -32 },
  ],
  south: [
    { x: 0, y: -31 },
    { x: 1, y: -32 },
    { x: 0, y: -31 },
    { x: -1, y: -30 },
    { x: 0, y: -31 },
    { x: 1, y: -32 },
  ],
} as const

type LassoState = 'outbound' | 'attached' | 'retracting'
type HeroLassoThrowOptions = {
  allowStableOnRelease?: boolean
  releaseHorseOnClear?: boolean
  showMessages?: boolean
  pullCapturedHorseToOwner?: boolean
}
type LassoedHorse = AnimalEntity & {
  degree?: number
  isLassoed?: boolean
  lassoOwner?: UnitEntity | null
  strategy?: string
  ambientMovement?: boolean
  stop?: () => void
  sendTo?: (
    target: RuntimeEntity | RuntimeCell | null,
    action?: string | null,
    options?: { forceRepath?: boolean; movementSheet?: string }
  ) => void
}

function clampToMaxDistance(origin: Point, destination: Point, maxDistance: number): Point {
  const distance = pointsDistance(origin.x, origin.y, destination.x, destination.y)
  if (distance <= maxDistance) return destination
  const ratio = maxDistance / Math.max(distance, 1)
  return {
    x: origin.x + (destination.x - origin.x) * ratio,
    y: origin.y + (destination.y - origin.y) * ratio,
  }
}

function getHeroLassoStart(hero: UnitEntity): Point {
  return {
    x: hero.x,
    y: hero.y + getReliefOffset(hero) - LASSO_START_HEIGHT,
  }
}

function getHeroLassoHandPoint(hero: UnitEntity): Point {
  const direction = degreeToDirection(hero.degree ?? 270) ?? 'south'
  const frame = Math.max(0, Math.floor(hero.sprite?.currentFrame ?? 0)) % LASSO_HAND_FRAME_COUNT
  const offsetDirection =
    direction === 'northwest' || direction === 'northeast'
      ? 'north'
      : direction === 'southwest' || direction === 'southeast'
        ? 'south'
        : direction === 'east'
          ? 'west'
          : direction
  const offset = LASSO_HAND_OFFSETS[offsetDirection as keyof typeof LASSO_HAND_OFFSETS]?.[frame] ?? LASSO_HAND_OFFSETS.south[0]
  const mirror = direction === 'east'
  return {
    x: hero.x + (mirror ? -offset.x : offset.x),
    y: hero.y + getReliefOffset(hero) + offset.y,
  }
}

function getEntityVisualPoint(entity: RuntimeEntity): Point {
  return {
    x: entity.x,
    y: entity.y + getReliefOffset(entity),
  }
}

function getHorseLassoNeckPoint(horse: LassoedHorse): Point {
  const direction = degreeToDirection(horse.degree ?? 270) ?? 'south'
  const spriteFrame = (horse.sprite as { currentFrame?: number } | undefined)?.currentFrame ?? 0
  const frame = Math.max(0, Math.floor(spriteFrame)) % LASSO_HORSE_NECK_FRAME_COUNT
  const offsetDirection =
    direction === 'northwest' || direction === 'northeast'
      ? 'north'
      : direction === 'southwest' || direction === 'southeast'
        ? 'south'
        : direction === 'east'
          ? 'west'
          : direction
  const offset =
    LASSO_HORSE_NECK_OFFSETS[offsetDirection as keyof typeof LASSO_HORSE_NECK_OFFSETS]?.[frame] ??
    LASSO_HORSE_NECK_OFFSETS.south[0]
  const mirror = direction === 'east'
  return {
    x: horse.x + (mirror ? -offset.x : offset.x),
    y: horse.y + getReliefOffset(horse) + offset.y,
  }
}

function isHorse(entity: RuntimeEntity): entity is LassoedHorse {
  return entity.family === FAMILY_TYPES.animal && entity.type === 'Horse' && !entity.isDead && !entity.isDestroyed
}

export class HeroLassoThrow extends Graphics {
  gameContext: GameContextLike
  hero: UnitEntity
  destination: Point
  tip: Point
  target: LassoedHorse | null
  state: LassoState
  taskId: SchedulerTaskId | null
  spawnOrigin: Point
  lastFollowAt: number
  options: Required<HeroLassoThrowOptions>
  stableRouteCleanup: (() => void) | null
  isStableHorseRouteActive: boolean

  constructor(hero: UnitEntity, destination: Point, context: GameContextLike, options: HeroLassoThrowOptions = {}) {
    super()
    this.gameContext = context
    this.hero = hero
    this.options = {
      allowStableOnRelease: true,
      releaseHorseOnClear: true,
      showMessages: true,
      pullCapturedHorseToOwner: true,
      ...options,
    }
    this.spawnOrigin = getHeroLassoStart(hero)
    this.destination = clampToMaxDistance(this.spawnOrigin, destination, LASSO_MAX_DISTANCE)
    this.tip = { ...this.spawnOrigin }
    this.target = null
    this.state = 'outbound'
    this.taskId = null
    this.lastFollowAt = 0
    this.isStableHorseRouteActive = false
    this.stableRouteCleanup = null
    hero.heroLasso?.clearLasso({ releaseHorse: true })
    hero.heroLasso = this
    this.eventMode = 'none'
    this.zIndex = (hero.zIndex ?? 0) + LASSO_DEFAULT_Z_OFFSET
    this.draw()
    this.taskId = context.scheduler.add(() => this.step(), STEP_TIME, 'hero.lassoThrow')
  }

  getCollisionCandidates(): RuntimeEntity[] {
    const candidates = new Set<RuntimeEntity>()
    for (const player of this.gameContext.players ?? []) {
      for (const animal of player.animals ?? []) candidates.add(animal)
    }
    for (const animal of this.gameContext.map.gaia?.animals ?? []) candidates.add(animal)
    return [...candidates]
  }

  releaseHorseToWild(horse: LassoedHorse): void {
    if (horse.isDead || horse.isDestroyed) return
    spookWildHorse(horse, this.hero)
  }

  stepToward(point: Point, speed: number): void {
    const distance = pointsDistance(this.tip.x, this.tip.y, point.x, point.y)
    if (distance <= speed) {
      this.tip = { ...point }
      return
    }
    this.tip.x += ((point.x - this.tip.x) / distance) * speed
    this.tip.y += ((point.y - this.tip.y) / distance) * speed
  }

  findHorseHit(previousTip: Point): LassoedHorse | null {
    let closest: LassoedHorse | null = null
    let closestDistance = Infinity
    for (const candidate of this.getCollisionCandidates()) {
      if (!isHorse(candidate)) continue
      const point = getEntityVisualPoint(candidate)
      if (!pointIsBetweenTwoPoint(previousTip, this.tip, point, LASSO_HIT_THICKNESS)) continue
      const distance = pointsDistance(this.spawnOrigin.x, this.spawnOrigin.y, point.x, point.y)
      if (distance >= closestDistance) continue
      closest = candidate
      closestDistance = distance
    }
    return closest
  }

  hitTree(segmentStart: Point): boolean {
    return Boolean(
      findTreeSegmentCollision(this.gameContext.map, segmentStart, this.tip, {
        trunkRadius: LASSO_TREE_THICKNESS,
        searchRadius: 2.5,
      })
    )
  }

  attachToHorse(horse: LassoedHorse): void {
    this.target = horse
    this.state = 'attached'
    this.zIndex = (horse.zIndex ?? this.zIndex) + LASSO_ATTACHED_HORSE_Z_OFFSET
    horse.isLassoed = true
    horse.lassoOwner = this.hero
    horse.stop?.()
    horse.animalBehavior?.stop?.()
    if (this.options.showMessages) {
      this.gameContext.menu?.showMessage?.(t('lassoHorseCaught'), 'success')
    }
  }

  releaseHorse({ allowFlee = true, allowStable = true }: { allowFlee?: boolean; allowStable?: boolean } = {}): void {
    const horse = this.target
    if (!horse) return
    horse.isLassoed = false
    horse.lassoOwner = null
    this.target = null
    if (allowStable && this.options.allowStableOnRelease) {
      horse.stop?.()
      horse.animalBehavior?.stop?.()
      routeCapturedHorseToStableWithOwnerContact({
        gameContext: this.gameContext,
        horse,
        owner: this.hero,
        forceRepath: false,
        timeoutMs: HORSE_CAPTURE_STABLE_TIMEOUT_MS,
        taskName: 'hero.lassoStableEntry',
        maxDistance: HORSE_CAPTURE_STABLE_MAX_DISTANCE,
        onStored: () => {
          this.gameContext.menu?.syncEntityInfoModal?.()
          this.gameContext.menu?.refreshHeroBuildingMenu?.()
          this.gameContext.menu?.showMessage?.(t('lassoHorseStabled'), 'success')
        },
        onStableUnavailable: () => {
          if (allowFlee) this.releaseHorseToWild(horse)
        },
        onFailure: () => this.releaseHorseToWild(horse),
      })
      return
    }
    if (allowFlee) this.releaseHorseToWild(horse)
  }

  startRetracting({ releaseHorse = false }: { releaseHorse?: boolean } = {}): void {
    if (releaseHorse) this.releaseHorse()
    if (this.state === 'attached' && this.target) return
    this.state = 'retracting'
    this.zIndex = (this.hero.zIndex ?? 0) + LASSO_DEFAULT_Z_OFFSET
  }

  updateAttachedHorse(): void {
    const horse = this.target
    if (!horse || horse.isDestroyed || horse.isDead) {
      this.releaseHorse({ allowFlee: false })
      this.startRetracting()
      return
    }
    this.tip = getHorseLassoNeckPoint(horse)
    this.zIndex = (horse.zIndex ?? this.zIndex) + LASSO_ATTACHED_HORSE_Z_OFFSET
    if (this.hitTree(this.spawnOrigin)) {
      this.releaseHorse()
      this.startRetracting()
      return
    }
    this.tryRouteAttachedHorseToStable()
    if (this.isStableHorseRouteActive) return
    const distance = pointsDistance(this.spawnOrigin.x, this.spawnOrigin.y, this.tip.x, this.tip.y)
    const now = this.gameContext.scheduler.elapsedMs
    if (distance >= LASSO_REPATH_DISTANCE && now - this.lastFollowAt >= LASSO_REPATH_INTERVAL_MS) {
      this.lastFollowAt = now
      if (this.options.pullCapturedHorseToOwner) {
        horse.sendTo?.(this.hero, null, { forceRepath: true })
      }
    } else if (distance <= LASSO_FOLLOW_DISTANCE) {
      if (this.options.pullCapturedHorseToOwner) {
        horse.stop?.()
      }
    }
  }

  clearAttachedStableRoute(): void {
    if (!this.stableRouteCleanup) return
    this.stableRouteCleanup()
    this.isStableHorseRouteActive = false
    this.stableRouteCleanup = null
  }

  tryRouteAttachedHorseToStable(): void {
    const horse = this.target
    if (!horse) return
    if (this.stableRouteCleanup) return
    this.stableRouteCleanup = routeCapturedHorseToStableWithOwnerContact({
      gameContext: this.gameContext,
      owner: this.hero,
      horse,
      forceRepath: false,
      timeoutMs: HORSE_CAPTURE_STABLE_TIMEOUT_MS,
      taskName: 'hero.lassoStableEntry',
      maxDistance: HORSE_CAPTURE_STABLE_MAX_DISTANCE,
      isRouteValid: () =>
        this.state === 'attached' && this.target === horse && (horse.lassoOwner === this.hero || Boolean(horse.isLassoed)),
      onStored: () => {
        this.isStableHorseRouteActive = false
        this.stableRouteCleanup = null
        horse.isLassoed = false
        horse.lassoOwner = null
        horse.clear?.()
        this.gameContext.menu?.syncEntityInfoModal?.()
        this.gameContext.menu?.refreshHeroBuildingMenu?.()
        this.gameContext.menu?.showMessage?.(t('lassoHorseStabled'), 'success')
        this.clearLasso({ releaseHorse: false })
      },
      onFailure: () => {
        this.isStableHorseRouteActive = false
        this.stableRouteCleanup = null
        this.releaseHorseToWild(horse)
        this.clearLasso({ releaseHorse: false })
      },
      onHorseRouteStart: () => {
        this.isStableHorseRouteActive = true
      },
    })
  }

  step(): void {
    if (this.hero.isDestroyed || this.hero.isDead) {
      this.clearLasso()
      return
    }
    this.spawnOrigin = this.state === 'attached' ? getHeroLassoHandPoint(this.hero) : getHeroLassoStart(this.hero)
    if (this.state === 'attached') {
      this.updateAttachedHorse()
      this.draw()
      return
    }

    const previousTip = { ...this.tip }
    if (this.state === 'outbound') {
      this.stepToward(this.destination, LASSO_SPEED)
      const horse = this.findHorseHit(previousTip)
      if (horse) {
        this.attachToHorse(horse)
      } else if (
        this.hitTree(previousTip) ||
        pointsDistance(this.tip.x, this.tip.y, this.destination.x, this.destination.y) <= 0.1
      ) {
        this.startRetracting()
      }
    } else {
      this.stepToward(this.spawnOrigin, LASSO_RETRACT_SPEED)
      if (pointsDistance(this.tip.x, this.tip.y, this.spawnOrigin.x, this.spawnOrigin.y) <= 0.1) {
        this.clearLasso()
        return
      }
    }
    this.draw()
  }

  draw(): void {
    this.clear()
    this.moveTo(this.spawnOrigin.x, this.spawnOrigin.y)
    this.lineTo(this.tip.x, this.tip.y)
    if (this.state !== 'attached') this.circle(this.tip.x, this.tip.y, LASSO_LOOP_RADIUS)
    this.stroke({ color: LASSO_BORDER_COLOR, width: LASSO_BORDER_WIDTH, alpha: 0.95 })
    this.moveTo(this.spawnOrigin.x, this.spawnOrigin.y)
    this.lineTo(this.tip.x, this.tip.y)
    if (this.state !== 'attached') this.circle(this.tip.x, this.tip.y, LASSO_LOOP_RADIUS)
    this.stroke({ color: LASSO_LINE_COLOR, width: LASSO_LINE_WIDTH, alpha: 0.95 })
  }

  clearLasso({ releaseHorse = true }: { releaseHorse?: boolean } = {}): void {
    if (releaseHorse && this.options.releaseHorseOnClear) this.releaseHorse()
    this.clearAttachedStableRoute()
    if (this.hero.heroLasso === this) this.hero.heroLasso = null
    if (this.taskId != null) {
      this.gameContext.scheduler.remove(this.taskId)
      this.taskId = null
    }
    this.parent?.removeChild(this)
    this.destroy({ children: true })
  }
}
