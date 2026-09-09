import { Graphics } from 'pixi.js'
import { CELL_HEIGHT, CELL_WIDTH, FAMILY_TYPES, SHEET_TYPES, STEP_TIME } from '../constants'
import { getReliefOffset, playAudibleSoundCue } from '../lib'
import { degreeToDirection, pointIsBetweenTwoPoint, pointsDistance } from '../lib/maths'
import { t } from '../lib/lang'
import {
  HORSE_CAPTURE_STABLE_MAX_DISTANCE,
  HORSE_CAPTURE_STABLE_TIMEOUT_MS,
  routeCapturedHorseToStableWithOwnerContact,
} from '../lib/horses/horseCapture'
import { findTreeSegmentCollision } from '../lib/treeCollision'
import { spookWildHorse } from '../lib/horses/wildHorseBehavior'
import { isWildHorse } from '../lib/horses/horseTaming'
import type { AnimalEntity, RuntimeEntity, UnitEntity } from '../types/entities'
import type { GameContextLike, SchedulerTaskId } from '../types/context'
import type { Point } from '../types/grid'
import type { RuntimeCell } from '../types/map'

const CATCHING_POLE_MAX_DISTANCE = Math.hypot(CELL_WIDTH, CELL_HEIGHT) * 4
const CATCHING_POLE_SPEED = 30
const CATCHING_POLE_RETRACT_SPEED = 36
const CATCHING_POLE_HIT_THICKNESS = 18
const CATCHING_POLE_TREE_THICKNESS = 12
const CATCHING_POLE_LINE_COLOR = 0x583126
const CATCHING_POLE_BORDER_COLOR = 0x000000
const CATCHING_POLE_LINE_WIDTH = 1
const CATCHING_POLE_BORDER_WIDTH = 3
const CATCHING_POLE_FOLLOW_DISTANCE = Math.hypot(CELL_WIDTH, CELL_HEIGHT) * 1.8
const CATCHING_POLE_REPATH_DISTANCE = Math.hypot(CELL_WIDTH, CELL_HEIGHT) * 2.4
const CATCHING_POLE_REPATH_INTERVAL_MS = 300
const CATCHING_POLE_WALKING_STICK_TIP_FRAME_COUNT = 8
const CATCHING_POLE_ACTION_STICK_TIP_FRAME_COUNT = 6
const CATCHING_POLE_HORSE_NECK_FRAME_COUNT = 6
const CATCHING_POLE_DEFAULT_Z_OFFSET = 2
const CATCHING_POLE_ATTACHED_HORSE_Z_OFFSET = -1
const CATCHING_POLE_HORSE_CAPTURE_SOUNDS = ['horse-2', 'horse-3']
const CATCHING_POLE_WALKING_STICK_TIP_OFFSETS = {
  north: [
    { x: 12, y: -28 },
    { x: 8, y: -29 },
    { x: 6, y: -30 },
    { x: 8, y: -29 },
    { x: 11, y: -29 },
    { x: 12, y: -27 },
    { x: 12, y: -25 },
    { x: 12, y: -23 },
  ],
  west: [
    { x: -8, y: -27 },
    { x: -18, y: -9 },
    { x: -18, y: -14 },
    { x: -16, y: -21 },
    { x: -12, y: -24 },
    { x: -11, y: -26 },
    { x: -13, y: -24 },
    { x: -16, y: -21 },
  ],
  south: [
    { x: 12, y: -26 },
    { x: 8, y: -27 },
    { x: 6, y: -28 },
    { x: 8, y: -27 },
    { x: 11, y: -27 },
    { x: 12, y: -25 },
    { x: 12, y: -23 },
    { x: 11, y: -21 },
  ],
  east: [
    { x: 7, y: -27 },
    { x: 17, y: -9 },
    { x: 16, y: -14 },
    { x: 15, y: -21 },
    { x: 11, y: -24 },
    { x: 10, y: -26 },
    { x: 12, y: -24 },
    { x: 15, y: -21 },
  ],
} as const
const CATCHING_POLE_ACTION_STICK_TIP_OFFSETS = {
  north: [
    { x: 13, y: -29 },
    { x: 13, y: -29 },
    { x: 14, y: -18 },
    { x: -22, y: -29 },
    { x: 31, y: -37 },
    { x: 47, y: -28 },
  ],
  west: [
    { x: -8, y: -30 },
    { x: -18, y: -2 },
    { x: 16, y: -19 },
    { x: -30, y: -12 },
    { x: -45, y: -24 },
    { x: -43, y: -31 },
  ],
  south: [
    { x: 11, y: -26 },
    { x: -2, y: -27 },
    { x: -23, y: -13 },
    { x: 17, y: -12 },
    { x: 16, y: -22 },
    { x: 39, y: -10 },
  ],
  east: [
    { x: 7, y: -30 },
    { x: 17, y: -2 },
    { x: -17, y: -19 },
    { x: 29, y: -12 },
    { x: 44, y: -24 },
    { x: 42, y: -31 },
  ],
} as const
const CATCHING_POLE_HORSE_NECK_OFFSETS = {
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

type CatchingPoleThrowState = 'outbound' | 'attached' | 'retracting'
type HeroCatchingPoleThrowOptions = {
  allowStableOnRelease?: boolean
  releaseHorseOnClear?: boolean
  showMessages?: boolean
  pullCapturedHorseToOwner?: boolean
  autoRouteStableWhileAttached?: boolean
  onThrowResolved?: () => void
}
type CatchingPoleCaughtHorse = AnimalEntity & {
  degree?: number
  isCatchingPoleCaught?: boolean
  catchingPoleOwner?: UnitEntity | null
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

function getHeroCatchingPoleVisualY(hero: UnitEntity): number {
  const mountedRiderY = hero.getMountedRiderY?.()
  return typeof mountedRiderY === 'number' && Number.isFinite(mountedRiderY) ? mountedRiderY : getReliefOffset(hero)
}

function getHeroCatchingPoleStickTipPoint(hero: UnitEntity): Point {
  const direction = degreeToDirection(hero.degree ?? 270) ?? 'south'
  const isActionSheet = hero.currentSheet === SHEET_TYPES.action
  const offsetTable = isActionSheet ? CATCHING_POLE_ACTION_STICK_TIP_OFFSETS : CATCHING_POLE_WALKING_STICK_TIP_OFFSETS
  const frameCount = isActionSheet
    ? CATCHING_POLE_ACTION_STICK_TIP_FRAME_COUNT
    : CATCHING_POLE_WALKING_STICK_TIP_FRAME_COUNT
  const frame = Math.max(0, Math.floor(hero.sprite?.currentFrame ?? 0)) % frameCount
  const offsetDirection =
    direction === 'northwest' || direction === 'northeast'
      ? 'north'
      : direction === 'southwest' || direction === 'southeast'
        ? 'south'
        : direction
  const offset = offsetTable[offsetDirection as keyof typeof offsetTable]?.[frame] ?? offsetTable.south[0]
  return {
    x: hero.x + offset.x,
    y: hero.y + getHeroCatchingPoleVisualY(hero) + offset.y,
  }
}

function getEntityVisualPoint(entity: RuntimeEntity): Point {
  return {
    x: entity.x,
    y: entity.y + getReliefOffset(entity),
  }
}

function getHorseCatchingPoleNeckPoint(horse: CatchingPoleCaughtHorse): Point {
  const direction = degreeToDirection(horse.degree ?? 270) ?? 'south'
  const spriteFrame = (horse.sprite as { currentFrame?: number } | undefined)?.currentFrame ?? 0
  const frame = Math.max(0, Math.floor(spriteFrame)) % CATCHING_POLE_HORSE_NECK_FRAME_COUNT
  const offsetDirection =
    direction === 'northwest' || direction === 'northeast'
      ? 'north'
      : direction === 'southwest' || direction === 'southeast'
        ? 'south'
        : direction === 'east'
          ? 'west'
          : direction
  const offset =
    CATCHING_POLE_HORSE_NECK_OFFSETS[offsetDirection as keyof typeof CATCHING_POLE_HORSE_NECK_OFFSETS]?.[frame] ??
    CATCHING_POLE_HORSE_NECK_OFFSETS.south[0]
  const mirror = direction === 'east'
  return {
    x: horse.x + (mirror ? -offset.x : offset.x),
    y: horse.y + getReliefOffset(horse) + offset.y,
  }
}

function isHorse(entity: RuntimeEntity): entity is CatchingPoleCaughtHorse {
  return (
    entity.family === FAMILY_TYPES.animal &&
    entity.type === 'Horse' &&
    isWildHorse(entity) &&
    !entity.isDead &&
    !entity.isDestroyed &&
    !(entity as CatchingPoleCaughtHorse).isCatchingPoleCaught &&
    !(entity as CatchingPoleCaughtHorse).catchingPoleOwner
  )
}

function clearHorseCatchingPoleClaim(horse: CatchingPoleCaughtHorse, owner: UnitEntity): void {
  if (horse.catchingPoleOwner && horse.catchingPoleOwner !== owner) return
  horse.isCatchingPoleCaught = false
  horse.catchingPoleOwner = null
}

export class HeroCatchingPoleThrow extends Graphics {
  gameContext: GameContextLike
  hero: UnitEntity
  destination: Point
  tip: Point
  target: CatchingPoleCaughtHorse | null
  state: CatchingPoleThrowState
  taskId: SchedulerTaskId | null
  spawnOrigin: Point
  lastFollowAt: number
  options: Required<HeroCatchingPoleThrowOptions>
  stableRouteCleanup: (() => void) | null
  isStableHorseRouteActive: boolean
  externalStableRouteActive: boolean
  throwVisualResolved: boolean

  constructor(
    hero: UnitEntity,
    destination: Point,
    context: GameContextLike,
    options: HeroCatchingPoleThrowOptions = {}
  ) {
    super()
    this.gameContext = context
    this.hero = hero
    this.options = {
      allowStableOnRelease: true,
      releaseHorseOnClear: true,
      showMessages: true,
      pullCapturedHorseToOwner: true,
      autoRouteStableWhileAttached: true,
      onThrowResolved: () => {},
      ...options,
    }
    this.spawnOrigin = getHeroCatchingPoleStickTipPoint(hero)
    this.destination = clampToMaxDistance(this.spawnOrigin, destination, CATCHING_POLE_MAX_DISTANCE)
    this.tip = { ...this.spawnOrigin }
    this.target = null
    this.state = 'outbound'
    this.taskId = null
    this.lastFollowAt = 0
    this.isStableHorseRouteActive = false
    this.externalStableRouteActive = false
    this.stableRouteCleanup = null
    this.throwVisualResolved = false
    hero.heroCatchingPoleThrow?.clearCatchingPoleThrow({ releaseHorse: true })
    hero.heroCatchingPoleThrow = this
    this.eventMode = 'none'
    this.zIndex = (hero.zIndex ?? 0) + CATCHING_POLE_DEFAULT_Z_OFFSET
    this.draw()
    this.taskId = context.scheduler.add(() => this.step(), STEP_TIME, 'hero.catchingPoleThrow')
  }

  getCollisionCandidates(): RuntimeEntity[] {
    const candidates = new Set<RuntimeEntity>()
    for (const player of this.gameContext.players ?? []) {
      for (const animal of player.animals ?? []) candidates.add(animal)
    }
    for (const animal of this.gameContext.map.gaia?.animals ?? []) candidates.add(animal)
    return [...candidates]
  }

  releaseHorseToWild(horse: CatchingPoleCaughtHorse): void {
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

  findHorseHit(previousTip: Point): CatchingPoleCaughtHorse | null {
    let closest: CatchingPoleCaughtHorse | null = null
    let closestDistance = Infinity
    for (const candidate of this.getCollisionCandidates()) {
      if (!isHorse(candidate)) continue
      const point = getEntityVisualPoint(candidate)
      if (!pointIsBetweenTwoPoint(previousTip, this.tip, point, CATCHING_POLE_HIT_THICKNESS)) continue
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
        trunkRadius: CATCHING_POLE_TREE_THICKNESS,
        searchRadius: 2.5,
      })
    )
  }

  attachToHorse(horse: CatchingPoleCaughtHorse): void {
    this.target = horse
    this.state = 'attached'
    this.zIndex = (horse.zIndex ?? this.zIndex) + CATCHING_POLE_ATTACHED_HORSE_Z_OFFSET
    this.resolveThrowVisual()
    horse.isCatchingPoleCaught = true
    horse.catchingPoleOwner = this.hero
    horse.stop?.()
    horse.animalBehavior?.stop?.()
    playAudibleSoundCue(horse, CATCHING_POLE_HORSE_CAPTURE_SOUNDS, { profile: 'voice' })
    if (this.options.showMessages) {
      this.gameContext.menu?.showMessage?.(t('catchingPoleHorseCaught'), 'success')
    }
  }

  resolveThrowVisual(): void {
    if (this.throwVisualResolved) return
    this.throwVisualResolved = true
    this.options.onThrowResolved()
  }

  releaseHorse({ allowFlee = true, allowStable = true }: { allowFlee?: boolean; allowStable?: boolean } = {}): void {
    const horse = this.target
    if (!horse) return
    clearHorseCatchingPoleClaim(horse, this.hero)
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
        taskName: 'hero.catchingPoleStableEntry',
        maxDistance: HORSE_CAPTURE_STABLE_MAX_DISTANCE,
        onStored: () => {
          this.gameContext.menu?.syncEntityInfoModal?.()
          this.gameContext.menu?.refreshHeroBuildingMenu?.()
          this.gameContext.menu?.showMessage?.(t('catchingPoleHorseStabled'), 'success')
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
    this.zIndex = (this.hero.zIndex ?? 0) + CATCHING_POLE_DEFAULT_Z_OFFSET
  }

  updateAttachedHorse(): void {
    const horse = this.target
    if (!horse || horse.isDestroyed || horse.isDead) {
      this.releaseHorse({ allowFlee: false })
      this.startRetracting()
      return
    }
    this.tip = getHorseCatchingPoleNeckPoint(horse)
    this.zIndex = (horse.zIndex ?? this.zIndex) + CATCHING_POLE_ATTACHED_HORSE_Z_OFFSET
    if (this.hitTree(this.spawnOrigin)) {
      this.releaseHorse()
      this.startRetracting()
      return
    }
    if (this.options.autoRouteStableWhileAttached) this.tryRouteAttachedHorseToStable()
    if (this.isStableHorseRouteActive || this.externalStableRouteActive) return
    const distance = pointsDistance(this.spawnOrigin.x, this.spawnOrigin.y, this.tip.x, this.tip.y)
    const now = this.gameContext.scheduler.elapsedMs
    if (distance >= CATCHING_POLE_REPATH_DISTANCE && now - this.lastFollowAt >= CATCHING_POLE_REPATH_INTERVAL_MS) {
      this.lastFollowAt = now
      if (this.options.pullCapturedHorseToOwner) {
        horse.sendTo?.(this.hero, null, { forceRepath: true })
      }
    } else if (distance <= CATCHING_POLE_FOLLOW_DISTANCE) {
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

  setExternalStableRouteActive(active: boolean): void {
    this.externalStableRouteActive = active
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
      taskName: 'hero.catchingPoleStableEntry',
      maxDistance: HORSE_CAPTURE_STABLE_MAX_DISTANCE,
      isRouteValid: () =>
        this.state === 'attached' &&
        this.target === horse &&
        (horse.catchingPoleOwner === this.hero || Boolean(horse.isCatchingPoleCaught)),
      onStored: () => {
        this.isStableHorseRouteActive = false
        this.stableRouteCleanup = null
        clearHorseCatchingPoleClaim(horse, this.hero)
        horse.clear?.()
        this.gameContext.menu?.syncEntityInfoModal?.()
        this.gameContext.menu?.refreshHeroBuildingMenu?.()
        this.gameContext.menu?.showMessage?.(t('catchingPoleHorseStabled'), 'success')
        this.clearCatchingPoleThrow({ releaseHorse: false })
      },
      onFailure: () => {
        this.isStableHorseRouteActive = false
        this.stableRouteCleanup = null
        clearHorseCatchingPoleClaim(horse, this.hero)
        this.releaseHorseToWild(horse)
        this.clearCatchingPoleThrow({ releaseHorse: false })
      },
      onHorseRouteStart: () => {
        this.isStableHorseRouteActive = true
      },
    })
  }

  step(): void {
    if (this.hero.isDestroyed || this.hero.isDead) {
      this.clearCatchingPoleThrow()
      return
    }
    this.spawnOrigin = getHeroCatchingPoleStickTipPoint(this.hero)
    if (this.state === 'attached') {
      this.updateAttachedHorse()
      this.draw()
      return
    }

    const previousTip = { ...this.tip }
    if (this.state === 'outbound') {
      this.stepToward(this.destination, CATCHING_POLE_SPEED)
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
      this.stepToward(this.spawnOrigin, CATCHING_POLE_RETRACT_SPEED)
      if (pointsDistance(this.tip.x, this.tip.y, this.spawnOrigin.x, this.spawnOrigin.y) <= 0.1) {
        this.resolveThrowVisual()
        this.clearCatchingPoleThrow()
        return
      }
    }
    this.draw()
  }

  draw(): void {
    this.clear()
    this.moveTo(this.spawnOrigin.x, this.spawnOrigin.y)
    this.lineTo(this.tip.x, this.tip.y)
    this.stroke({ color: CATCHING_POLE_BORDER_COLOR, width: CATCHING_POLE_BORDER_WIDTH, alpha: 0.95 })
    this.moveTo(this.spawnOrigin.x, this.spawnOrigin.y)
    this.lineTo(this.tip.x, this.tip.y)
    this.stroke({ color: CATCHING_POLE_LINE_COLOR, width: CATCHING_POLE_LINE_WIDTH, alpha: 0.95 })
  }

  clearCatchingPoleThrow({ releaseHorse = true }: { releaseHorse?: boolean } = {}): void {
    this.resolveThrowVisual()
    if (releaseHorse && this.options.releaseHorseOnClear) this.releaseHorse()
    else if (this.target) clearHorseCatchingPoleClaim(this.target, this.hero)
    this.externalStableRouteActive = false
    this.clearAttachedStableRoute()
    if (this.hero.heroCatchingPoleThrow === this) this.hero.heroCatchingPoleThrow = null
    if (this.taskId != null) {
      this.gameContext.scheduler.remove(this.taskId)
      this.taskId = null
    }
    this.parent?.removeChild(this)
    this.destroy({ children: true })
  }
}
