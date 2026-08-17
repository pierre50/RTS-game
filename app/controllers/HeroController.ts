import { Assets, Graphics } from 'pixi.js'
import {
  cartesianToIsometric,
  drawRoundedIsoShape,
  getReliefOffset,
  getRoundedIsoShapePoints,
  playSoundCue,
  updateInstanceRenderVisibility,
} from '../lib'
import {
  COMM_INDICATOR_FILL_ALPHA,
  COMM_INDICATOR_FILL_COLOR,
  COMM_INDICATOR_STROKE_ALPHA,
  COMM_INDICATOR_STROKE_COLOR,
  COMM_INDICATOR_STROKE_WIDTH,
  HERO_ACTION_MOVE_SPEED_FACTOR,
  HERO_LOCKED_BACKPEDAL_MOVE_SPEED_FACTOR,
  HERO_LOCKED_STRAFE_MOVE_SPEED_FACTOR,
  LABEL_TYPES,
  MOUNTED_HORSE_SPEED_BONUS,
  HERO_STEALTH_SPEED_FACTOR,
  SHEET_TYPES,
  SOUND_CUES,
  STEP_TIME,
} from '../constants'
import {
  aimHeroBowChargeAt,
  aimHeroDefenseAt,
  applyToolAppearance,
  beginHeroDefense,
  cancelHeroBowCharge,
  cancelHeroLasso,
  cancelHeroDefense,
  isHeroBowChargeActiveForTool,
  isMountedAttackAimBlocked,
  releaseHeroDefense,
  releaseHeroBowCharge,
  triggerToolAttackAt,
  updateHeroDefense,
  updateHeroBowCharge,
  findFacingEntity,
  getHeroAimDegree,
  HERO_TOOL_ORDER,
  type HeroEquippedItem,
} from '../lib/heroTools'
import { updateHeroCursor } from '../lib/heroCursor'
import { applyBakedLpcUnitAssets } from '../lib/lpc'
import { heroCanCommand } from '../lib/chief'
import {
  COMM_INDICATOR_DELAY_MS,
  getCommCellsInRadius,
  getCommRadiusForHold,
  releaseIfStillLooking,
  resolveCommGroup,
  resolveHoverTarget,
  sendNpcGroupToTarget,
  updateNpcFollow,
} from '../lib/npcInteraction'
import { isHeroInteractionTargetReachable } from '../lib/heroActionRange'
import type { ControlBindingAction } from '../lib/settings'
import { setUnitControlMode } from '../lib/unitControl'
import { updateUnitEnergy } from '../lib/unitEnergy'
import { updateUnitHealthRegen } from '../lib/unitHealth'
import { t } from '../lib/lang'
import { HeroCriticalHealthEffects } from '../services/HeroCriticalHealthEffects'
import { HeroOcclusionFade } from '../services/HeroOcclusionFade'
import type Controls from '../classes/Controls'
import type { AnimalEntity, RuntimeEntity, UnitEntity } from '../types/entities'
import type { RuntimeCell } from '../types/map'

const TARGET_FRAME_MS = 1000 / 60
const HERO_MOVE_DEBUG_THROTTLE_MS = 250
type HeroAimPoint = { x: number; y: number }
const HERO_MOVE_DIRECTIONS: Partial<Record<ControlBindingAction, { dx: number; dy: number }>> = {
  heroUp: { dx: 0, dy: -1 },
  heroDown: { dx: 0, dy: 1 },
  heroLeft: { dx: -1, dy: 0 },
  heroRight: { dx: 1, dy: 0 },
}
const HERO_TOOL_ACTIONS: Partial<Record<ControlBindingAction, number>> = {
  heroTool1: 0,
  heroTool2: 1,
  heroTool3: 2,
  heroTool4: 3,
}
const COMPANION_HORSE_CALL_MIN_RADIUS = 10
const COMPANION_HORSE_CALL_MAX_RADIUS = 36
const MOUNT_TRANSITION_FADE_OUT_MS = 120
const MOUNT_TRANSITION_FADE_IN_MS = 140
const MOUNT_TRANSITION_CAMERA_MS = 180
const MOUNT_TRANSITION_TICK_MS = 40
const MOUNT_TRANSITION_HIDDEN_ALPHA = 0.05
type MoveVector = { dx: number; dy: number }
type HorseCallDestination = Pick<RuntimeCell, 'i' | 'j' | 'x' | 'y' | 'z'>
type CompanionHorse = AnimalEntity & {
  degree?: number
  companionOwner?: UnitEntity | null
  companionHitCount?: number
  strategy?: string
  ambientMovement?: boolean
  stop?: () => void
  sendTo?: (
    target: RuntimeEntity | RuntimeCell | HorseCallDestination | null,
    action?: string | null,
    options?: { forceRepath?: boolean }
  ) => void
}

let lastHeroMoveDebugAt = 0

function debugHeroMove(message: string, unit: UnitEntity, details: Record<string, unknown>): void {
  const now = performance.now()
  if (now - lastHeroMoveDebugAt < HERO_MOVE_DEBUG_THROTTLE_MS) return
  lastHeroMoveDebugAt = now
  console.debug('[hero-controlled unit move]', {
    message,
    details,
    unit: {
      controlMode: unit.controlMode,
      actionLocked: unit.actionLocked,
      isDead: unit.isDead,
      isDestroyed: unit.isDestroyed,
      currentSheet: unit.currentSheet,
      speed: unit.speed,
      i: unit.i,
      j: unit.j,
      x: Math.round(unit.x),
      y: Math.round(unit.y),
      visible: unit.visible,
      currentCell: {
        i: unit.currentCell?.i,
        j: unit.currentCell?.j,
        solid: unit.currentCell?.solid,
        border: unit.currentCell?.border,
        category: unit.currentCell?.category,
        has: unit.currentCell?.has
          ? { type: unit.currentCell.has.type, family: unit.currentCell.has.family, label: unit.currentCell.has.label }
          : null,
      },
    },
  })
}

function getKeyboardMoveVector(keysPressed: Set<ControlBindingAction>): MoveVector {
  let dx = 0
  let dy = 0
  for (const action of keysPressed) {
    const dir = HERO_MOVE_DIRECTIONS[action]
    if (!dir) continue
    dx += dir.dx
    dy += dir.dy
  }
  return { dx, dy }
}

function easeInOut(t: number): number {
  const clamped = Math.max(0, Math.min(1, t))
  return clamped * clamped * (3 - 2 * clamped)
}

function isHeroDirectionLockActive(controls: Controls): boolean {
  return controls.isHeroDirectionLockActive?.() ?? controls.shiftKeyActive
}

function getVectorFromDegree(degree: number): MoveVector {
  const radians = ((degree - 180) * Math.PI) / 180
  return { dx: Math.cos(radians), dy: Math.sin(radians) }
}

function getPointInDirection(unit: UnitEntity, degree: number, distance = 100): HeroAimPoint {
  const vector = getVectorFromDegree(degree)
  return {
    x: unit.x + vector.dx * distance,
    y: unit.y + vector.dy * distance,
  }
}

function getLockedMoveSpeedFactor(move: MoveVector, facing: MoveVector): number {
  const moveLength = Math.hypot(move.dx, move.dy)
  const facingLength = Math.hypot(facing.dx, facing.dy)
  if (moveLength <= 0 || facingLength <= 0) return 1

  const alignment = (move.dx * facing.dx + move.dy * facing.dy) / (moveLength * facingLength)
  if (alignment >= 0) {
    return HERO_LOCKED_STRAFE_MOVE_SPEED_FACTOR + (1 - HERO_LOCKED_STRAFE_MOVE_SPEED_FACTOR) * alignment
  }
  return (
    HERO_LOCKED_STRAFE_MOVE_SPEED_FACTOR +
    (HERO_LOCKED_STRAFE_MOVE_SPEED_FACTOR - HERO_LOCKED_BACKPEDAL_MOVE_SPEED_FACTOR) * alignment
  )
}

// controlMode determines the baked look (see applyBakedLpcUnitAssets), and this
// runs after the unit's initial spawn-time bake, so the sheet aliases must be
// re-resolved into actual textures here too — same pattern as UnitActions.upgrade().
function refreshBakedAppearance(unit: UnitEntity): void {
  applyBakedLpcUnitAssets(unit)
  Object.assign(
    unit,
    Object.fromEntries(Object.entries(unit.assets ?? {}).map(([key, value]) => [key, Assets.cache.get(value)]))
  )
  unit.setTextures?.(unit.currentSheet ?? SHEET_TYPES.standing)
}

function drawCommIndicatorCells(indicator: Graphics, hero: UnitEntity, radius: number): void {
  const cells = getCommCellsInRadius(hero, radius)
  for (const cell of cells) {
    const [cellX, cellY] = cartesianToIsometric(cell.i, cell.j)
    drawRoundedIsoShape(
      indicator,
      getRoundedIsoShapePoints({
        x: cellX - hero.x,
        y: cellY - hero.y,
        factor: 1,
      })
    )
  }
  if (!cells.length) return
  indicator.fill({ color: COMM_INDICATOR_FILL_COLOR, alpha: COMM_INDICATOR_FILL_ALPHA })
  indicator.stroke({
    color: COMM_INDICATOR_STROKE_COLOR,
    width: COMM_INDICATOR_STROKE_WIDTH,
    alpha: COMM_INDICATOR_STROKE_ALPHA,
  })
}

function isFreeHorseCell(cell?: RuntimeCell | null): cell is RuntimeCell {
  return Boolean(cell && !cell.solid && !cell.has && cell.category !== 'Water' && !cell.waterBorder && !cell.border)
}

type ViewportMetrics = { visibleLeft: number; visibleTop: number; visibleWidth: number; visibleHeight: number }

function cellIsOutsideViewport(cell: RuntimeCell, viewport: ViewportMetrics, margin = 48): boolean {
  return (
    cell.x < viewport.visibleLeft - margin ||
    cell.x > viewport.visibleLeft + viewport.visibleWidth + margin ||
    cell.y < viewport.visibleTop - margin ||
    cell.y > viewport.visibleTop + viewport.visibleHeight + margin
  )
}

function findCompanionHorseSpawnCell(
  hero: UnitEntity,
  radiusLimit = COMPANION_HORSE_CALL_MAX_RADIUS,
  options: { minRadius?: number; viewport?: ViewportMetrics | null } = {}
): RuntimeCell | null {
  const grid = hero.context?.map?.grid
  if (!grid) return null
  const minRadius = Math.max(1, Math.min(options.minRadius ?? 1, radiusLimit))
  const viewport = options.viewport ?? null
  if (radiusLimit > 1 && !viewport) {
    const preferred: Array<[number, number]> = [
      [0, radiusLimit],
      [-radiusLimit, 0],
      [radiusLimit, 0],
      [0, -radiusLimit],
    ]
    for (const [di, dj] of preferred) {
      const cell = grid[hero.i + di]?.[hero.j + dj]
      if (isFreeHorseCell(cell)) return cell
    }
  }
  let firstFreeCell: RuntimeCell | null = null
  for (let radius = minRadius; radius <= radiusLimit; radius++) {
    for (let di = -radius; di <= radius; di++) {
      const djAbs = radius - Math.abs(di)
      const offsets: Array<[number, number]> = djAbs === 0 ? [[di, 0]] : [[di, djAbs], [di, -djAbs]]
      for (const [oi, oj] of offsets) {
        const cell = grid[hero.i + oi]?.[hero.j + oj]
        if (!isFreeHorseCell(cell)) continue
        if (!firstFreeCell) firstFreeCell = cell
        if (!viewport || cellIsOutsideViewport(cell, viewport)) return cell
      }
    }
  }
  return firstFreeCell
}

export class HeroController {
  controls: Controls
  heroUnit: UnitEntity | null
  equippedItem: HeroEquippedItem | null
  keysPressed: Set<ControlBindingAction>
  wasMoving: boolean
  mouseHeld: boolean
  commCharging: boolean
  commChargeStart: number
  commIndicator: Graphics | null
  pendingGoToNpcs: UnitEntity[] | null
  primaryClickPoint: HeroAimPoint | null
  shiftMoveLockedDegree: number | null
  companionHorse: CompanionHorse | null
  mountTransitionTaskId: number | null
  criticalHealthEffects: HeroCriticalHealthEffects
  occlusionFade: HeroOcclusionFade

  constructor(controls: Controls) {
    this.controls = controls
    this.heroUnit = null
    this.equippedItem = null
    this.keysPressed = new Set()
    this.wasMoving = false
    this.mouseHeld = false
    this.commCharging = false
    this.commChargeStart = 0
    this.commIndicator = null
    this.pendingGoToNpcs = null
    this.primaryClickPoint = null
    this.shiftMoveLockedDegree = null
    this.companionHorse = null
    this.mountTransitionTaskId = null
    this.criticalHealthEffects = new HeroCriticalHealthEffects(controls.context.app)
    this.occlusionFade = new HeroOcclusionFade()
  }

  facePoint(point: HeroAimPoint): void {
    const unit = this.heroUnit
    if (!unit || unit.actionLocked) return
    const aimDegree = getHeroAimDegree(unit, point)
    if (unit.degree !== aimDegree) {
      unit.degree = aimDegree
      unit.setTextures?.(unit.currentSheet === SHEET_TYPES.walking ? SHEET_TYPES.walking : SHEET_TYPES.standing)
    }
  }

  getShiftMoveLockedAimPoint(): HeroAimPoint | null {
    const unit = this.heroUnit
    if (!unit || unit.mountedOnHorse || this.shiftMoveLockedDegree == null) return null
    return getPointInDirection(unit, this.shiftMoveLockedDegree)
  }

  isActive(): boolean {
    return Boolean(this.heroUnit && !this.heroUnit.isDead && !this.heroUnit.isDestroyed)
  }

  handleKeyDown(action: ControlBindingAction): boolean {
    if (!this.isActive()) return false

    if (action === 'inventory') {
      this.controls.context.menu?.toggleInventory?.()
      return true
    }

    if (action === 'heroDefense') {
      this.handleDefenseKeyDown()
      return true
    }

    if (action === 'heroInteract') {
      // Pressing the key again closes whichever panel it can open, instead of starting a new
      // charge or re-resolving a target.
      if (this.controls.closeAnyHeroPanel()) return true
      if (this.commCharging) return true
      // Only a chief can charge up to give orders — everyone else just resolves the tap
      // immediately as an inspect/chatter interaction.
      if (!heroCanCommand(this.heroUnit)) {
        this.controls.openHeroEntityInteraction()
        return true
      }
      this.beginCommCharge()
      return true
    }

    if (action === 'heroMountHorse') {
      this.toggleHeroHorse()
      return true
    }

    const toolIndex = HERO_TOOL_ACTIONS[action]
    if (toolIndex != null) {
      this.equipToolAt(toolIndex)
      return true
    }

    if (HERO_MOVE_DIRECTIONS[action]) {
      if (this.keysPressed.size === 0 && !this.heroUnit?.actionLocked) this.heroUnit?.stop?.()
      this.keysPressed.add(action)
      return true
    }

    return false
  }

  equipToolAt(index: number): boolean {
    const tool = HERO_TOOL_ORDER[index]
    if (!tool) return false
    this.setEquippedTool(tool)
    return true
  }

  cycleTool(direction: 1 | -1): boolean {
    const currentIndex = Math.max(0, HERO_TOOL_ORDER.indexOf(this.equippedItem ?? 'interact'))
    const nextIndex = (currentIndex + direction + HERO_TOOL_ORDER.length) % HERO_TOOL_ORDER.length
    return this.equipToolAt(nextIndex)
  }

  setHeroMountedOnHorse(mounted: boolean): boolean {
    const unit = this.heroUnit
    if (!unit) return false
    if (!mounted && unit.mountedOnHorse) {
      unit.mountedOnHorse = false
      unit.speed = Math.max(0, Number(((unit.speed ?? 0) - MOUNTED_HORSE_SPEED_BONUS).toFixed(6)))
      unit.removeMountedHorseSprite?.()
      unit.syncMountedRiderPosition?.()
      unit.setTextures?.(unit.currentSheet ?? SHEET_TYPES.standing)
      return true
    }
    if (!mounted || unit.mountedOnHorse) return false
    unit.mountedOnHorse = true
    unit.speed = (unit.speed ?? 0) + MOUNTED_HORSE_SPEED_BONUS
    unit.setTextures?.(unit.currentSheet ?? SHEET_TYPES.standing)
    return true
  }

  getViewportMetrics(): ViewportMetrics | null {
    const getViewportMetrics = this.controls.getViewportMetrics
    if (typeof getViewportMetrics !== 'function') return null
    const viewport = getViewportMetrics.call(this.controls)
    if (
      typeof viewport?.visibleLeft !== 'number' ||
      typeof viewport.visibleTop !== 'number' ||
      typeof viewport.visibleWidth !== 'number' ||
      typeof viewport.visibleHeight !== 'number'
    ) {
      return null
    }
    return viewport
  }

  createCompanionHorseNearHero(
    radiusLimit = COMPANION_HORSE_CALL_MAX_RADIUS,
    options: { minRadius?: number; useViewport?: boolean } = {}
  ): CompanionHorse | null {
    const unit = this.heroUnit
    const map = unit?.context?.map
    const createAnimal = map?.gaia?.createAnimal
    if (!unit || !map || typeof createAnimal !== 'function') return null
    const cell = findCompanionHorseSpawnCell(unit, radiusLimit, {
      minRadius: options.minRadius,
      viewport: options.useViewport ? this.getViewportMetrics() : null,
    })
    if (!cell) return null
    return this.createCompanionHorseAt(cell)
  }

  createCompanionHorseAt(cell: RuntimeCell): CompanionHorse | null {
    const unit = this.heroUnit
    const map = unit?.context?.map
    const createAnimal = map?.gaia?.createAnimal
    if (!unit || !map || typeof createAnimal !== 'function') return null
    const horseColor = unit.companionHorseColor ?? unit.horseColor
    const horse = createAnimal.call(map.gaia, { i: cell.i, j: cell.j, type: 'Horse', horseColor }) as CompanionHorse
    return this.registerCompanionHorse(horse)
  }

  registerCompanionHorse(horse: CompanionHorse): CompanionHorse {
    const unit = this.heroUnit
    horse.strategy = undefined
    horse.ambientMovement = false
    horse.companionOwner = unit ?? null
    horse.companionHitCount = 0
    horse.animalBehavior?.stop?.()
    this.companionHorse = horse
    return horse
  }

  getActiveCompanionHorse(): CompanionHorse | null {
    const unit = this.heroUnit
    const horse = this.companionHorse
    if (horse?.isDead || horse?.isDestroyed) {
      if (unit) unit.companionHorseColor = null
      this.companionHorse = null
      return null
    }
    if (horse && unit?.companionHorseColor && horse.companionOwner === unit) return horse
    this.companionHorse = null
    return null
  }

  sendCompanionHorseToHero(horse: CompanionHorse, unit: UnitEntity): void {
    const cell = unit.currentCell ?? unit.context?.map?.grid?.[unit.i]?.[unit.j]
    const destination = cell
      ? { i: cell.i, j: cell.j, x: cell.x, y: cell.y, z: cell.z }
      : { i: unit.i, j: unit.j, x: unit.x, y: unit.y, z: unit.z ?? 0 }
    horse.sendTo?.(destination, null, { forceRepath: true })
    playSoundCue(SOUND_CUES.unit.horseMoving)
    this.controls.context.menu?.showMessage(t('companionHorseComing'), 'success')
  }

  callCompanionHorse(): boolean {
    const unit = this.heroUnit
    if (!unit) return false
    const activeHorse = this.getActiveCompanionHorse()
    if (activeHorse) {
      const facingHorse = findFacingEntity(
        unit,
        target => target === activeHorse && isHeroInteractionTargetReachable(unit, null, target)
      )
      if (facingHorse === activeHorse) return this.mountCompanionHorse(activeHorse)
      this.sendCompanionHorseToHero(activeHorse, unit)
      return true
    }
    if (!unit.companionHorseColor) {
      this.controls.context.menu?.showMessage(t('heroNeedsLinkedHorse'), 'warning')
      return false
    }

    const horse = this.createCompanionHorseNearHero(COMPANION_HORSE_CALL_MAX_RADIUS, {
      minRadius: COMPANION_HORSE_CALL_MIN_RADIUS,
      useViewport: true,
    })
    if (!horse) return false
    this.sendCompanionHorseToHero(horse, unit)
    return true
  }

  snapHeroToCell(targetCell: RuntimeCell): void {
    const unit = this.heroUnit
    const map = unit?.context?.map
    if (!unit || !map) return
    const oldI = unit.i
    const oldJ = unit.j
    const currentCell = unit.currentCell
    if (currentCell?.has === unit) {
      currentCell.has = null
      currentCell.solid = false
    }
    unit.i = targetCell.i
    unit.j = targetCell.j
    unit.x = targetCell.x
    unit.y = targetCell.y
    unit.z = targetCell.z
    unit.currentCell = targetCell
    targetCell.place(unit)
    targetCell.solid = true
    map.updateInstanceBucket?.(unit, oldI, oldJ)
  }

  snapHeroToHorse(horse: CompanionHorse): void {
    const map = this.heroUnit?.context?.map
    const targetCell = map?.grid[horse.i]?.[horse.j]
    if (targetCell) this.snapHeroToCell(targetCell)
  }

  finishCompanionHorseMount(horse: CompanionHorse): boolean {
    const unit = this.heroUnit
    if (unit && horse.horseColor) {
      unit.horseColor = horse.horseColor
      unit.companionHorseColor = horse.horseColor
    }
    if (unit && typeof horse.degree === 'number') unit.degree = horse.degree
    this.snapHeroToHorse(horse)
    if (!this.setHeroMountedOnHorse(true)) return false
    horse.clear?.()
    this.companionHorse = null
    if (unit) this.controls.setCamera?.(unit.x, unit.y)
    return true
  }

  finishCompanionHorseDismount(): boolean {
    const unit = this.heroUnit
    const map = unit?.context?.map
    const createAnimal = map?.gaia?.createAnimal
    if (!unit || !map || typeof createAnimal !== 'function') return false
    const horseCell = unit.currentCell ?? map.grid[unit.i]?.[unit.j]
    const heroCell = findCompanionHorseSpawnCell(unit, 1)
    if (!horseCell || !heroCell) return false
    unit.companionHorseColor = unit.horseColor ?? unit.companionHorseColor ?? 'brown'
    if (!this.setHeroMountedOnHorse(false)) return false
    this.snapHeroToCell(heroCell)
    const horse = this.createCompanionHorseAt(horseCell)
    if (!horse) return false
    if (typeof unit.degree === 'number') horse.degree = unit.degree
    this.controls.setCamera?.(unit.x, unit.y)
    return true
  }

  cancelMountTransition(restoreAlpha = true): void {
    if (this.mountTransitionTaskId != null) {
      this.controls.context.scheduler?.remove(this.mountTransitionTaskId)
      this.mountTransitionTaskId = null
    }
    if (restoreAlpha && this.heroUnit && !this.heroUnit.isDestroyed) this.heroUnit.alpha = 1
  }

  startHorseTransition({
    cameraEnd,
    finish,
    taskName,
    targetValid,
  }: {
    cameraEnd: HeroAimPoint
    finish: () => boolean
    taskName: string
    targetValid?: () => boolean
  }): boolean {
    const unit = this.heroUnit
    const scheduler = this.controls.context.scheduler
    if (!unit) return false
    if (this.mountTransitionTaskId != null) return true
    if (!scheduler) return finish()

    const startedAt = scheduler.elapsedMs
    const cameraStart = { x: unit.x, y: unit.y }
    let swapped = false
    unit.alpha = 1
    const taskId = scheduler.add(
      () => {
        const currentUnit = this.heroUnit
        if (!currentUnit || currentUnit.isDead || currentUnit.isDestroyed || targetValid?.() === false) {
          this.cancelMountTransition()
          return
        }
        const elapsed = scheduler.elapsedMs - startedAt
        const cameraProgress = easeInOut(elapsed / MOUNT_TRANSITION_CAMERA_MS)
        this.controls.setCamera?.(
          cameraStart.x + (cameraEnd.x - cameraStart.x) * cameraProgress,
          cameraStart.y + (cameraEnd.y - cameraStart.y) * cameraProgress
        )
        if (elapsed < MOUNT_TRANSITION_FADE_OUT_MS) {
          const progress = Math.max(0, elapsed / MOUNT_TRANSITION_FADE_OUT_MS)
          currentUnit.alpha = 1 - (1 - MOUNT_TRANSITION_HIDDEN_ALPHA) * progress
          return
        }
        if (!swapped) {
          currentUnit.alpha = MOUNT_TRANSITION_HIDDEN_ALPHA
          if (!finish()) {
            this.cancelMountTransition()
            return
          }
          swapped = true
        }
        const fadeInProgress = Math.min(1, (elapsed - MOUNT_TRANSITION_FADE_OUT_MS) / MOUNT_TRANSITION_FADE_IN_MS)
        currentUnit.alpha = MOUNT_TRANSITION_HIDDEN_ALPHA + (1 - MOUNT_TRANSITION_HIDDEN_ALPHA) * fadeInProgress
        if (fadeInProgress >= 1) this.cancelMountTransition(false)
      },
      MOUNT_TRANSITION_TICK_MS,
      taskName
    )
    this.mountTransitionTaskId = taskId
    return true
  }

  mountCompanionHorse(horse: CompanionHorse): boolean {
    return this.startHorseTransition({
      cameraEnd: { x: horse.x, y: horse.y },
      finish: () => this.finishCompanionHorseMount(horse),
      targetValid: () => !horse.isDead && !horse.isDestroyed,
      taskName: 'hero.mountHorseTransition',
    })
  }

  dismountCompanionHorse(): boolean {
    const unit = this.heroUnit
    const map = unit?.context?.map
    if (!unit || !map) return false
    const heroCell = findCompanionHorseSpawnCell(unit, 1)
    if (!heroCell) return false
    return this.startHorseTransition({
      cameraEnd: { x: heroCell.x, y: heroCell.y },
      finish: () => this.finishCompanionHorseDismount(),
      taskName: 'hero.dismountHorseTransition',
    })
  }

  toggleHeroHorse(): boolean {
    return this.heroUnit?.mountedOnHorse ? this.dismountCompanionHorse() : this.callCompanionHorse()
  }

  handleKeyUp(action: ControlBindingAction): void {
    if (HERO_MOVE_DIRECTIONS[action]) this.keysPressed.delete(action)
    if (action === 'heroInteract' && this.commCharging) this.endCommCharge()
    if (action === 'heroDefense' && this.heroUnit && releaseHeroDefense(this.heroUnit)) this.mouseHeld = false
  }

  update(frameScale: number): void {
    const unit = this.heroUnit
    if (!unit) return
    updateUnitEnergy(unit, TARGET_FRAME_MS * frameScale)
    updateUnitHealthRegen(unit, TARGET_FRAME_MS * frameScale)
    this.updateCriticalHealthEffects(TARGET_FRAME_MS * frameScale, !this.controls.context.paused)
    this.updateOcclusionFade(TARGET_FRAME_MS * frameScale, !this.controls.context.paused)
    this.controls.context.menu?.updateHeroStatus?.(unit)
    updateNpcFollow(unit)
    if (this.commCharging) this.updateCommIndicator()
    const aimPoint = this.controls.getWorldPointUnderCursor()
    const bowChargeAiming = isHeroBowChargeActiveForTool(unit, this.equippedItem)
      ? aimHeroBowChargeAt(unit, aimPoint)
      : false
    const defenseAiming = aimHeroDefenseAt(unit, aimPoint)
    updateHeroBowCharge(unit)
    updateHeroDefense(unit)
    // Keep the hover-based cursor live even while picking a "go to" target — it already tells
    // the player what a click will do here (gather hand, move icon, combat icon, plain pointer).
    const hoverTarget = resolveHoverTarget(
      unit,
      this.controls.getWorldPointUnderCursor(),
      this.controls.getCellUnderCursor()
    )
    updateHeroCursor(this.equippedItem, hoverTarget, Boolean(this.pendingGoToNpcs))
    const attacking = Boolean(unit.actionLocked)
    if (
      this.mouseHeld &&
      this.primaryClickPoint &&
      !attacking &&
      this.equippedItem !== 'bow' &&
      this.equippedItem !== 'lasso'
    ) {
      const nextPoint = this.getShiftMoveLockedAimPoint() ?? aimPoint
      this.primaryClickPoint = nextPoint
      if (!this.attackTowardPoint(nextPoint)) {
        this.mouseHeld = false
        this.primaryClickPoint = null
      }
    }

    const keyboardMove = getKeyboardMoveVector(this.keysPressed)
    let { dx, dy } = keyboardMove
    const gamepadMove = this.controls.getGamepadMoveVector()
    dx += gamepadMove.dx
    dy += gamepadMove.dy
    const isMoving = dx !== 0 || dy !== 0
    const lockedMove = Boolean(isHeroDirectionLockActive(this.controls) && isMoving && !unit.mountedOnHorse)
    if (lockedMove && this.shiftMoveLockedDegree == null) {
      this.shiftMoveLockedDegree = unit.degree ?? 0
    } else if (!lockedMove) {
      this.shiftMoveLockedDegree = null
    }
    const lockedDegree = this.shiftMoveLockedDegree
    if (unit.isDirectMoving !== isMoving) {
      unit.isDirectMoving = isMoving
      unit.syncMountedHorseSprite?.()
    }

    let moved = false
    if (isMoving) {
      const len = Math.hypot(dx, dy)
      const lockedFacingVector =
        lockedMove && lockedDegree != null && !attacking ? getVectorFromDegree(lockedDegree) : null
      const speedFactor = attacking && !unit.mountedOnHorse ? HERO_ACTION_MOVE_SPEED_FACTOR : 1
      const stealthSpeedFactor = this.controls.isHeroStealthMode?.() ? HERO_STEALTH_SPEED_FACTOR : 1
      const lockedMoveSpeedFactor = lockedFacingVector ? getLockedMoveSpeedFactor({ dx, dy }, lockedFacingVector) : 1
      const distance =
        (unit.speed ?? 0) * speedFactor * stealthSpeedFactor * (TARGET_FRAME_MS / STEP_TIME) * frameScale
      const before = { x: unit.x, y: unit.y, i: unit.i, j: unit.j }
      const aimedDegree = bowChargeAiming || defenseAiming ? unit.degree : null
      const moveOptions = lockedFacingVector
        ? { facingDirX: lockedFacingVector.dx, facingDirY: lockedFacingVector.dy }
        : undefined
      moved = unit.moveDirect?.(dx / len, dy / len, distance * lockedMoveSpeedFactor, moveOptions) ?? false
      if (aimedDegree != null && unit.degree !== aimedDegree) {
        unit.degree = aimedDegree
      }
      const delta = Math.hypot(unit.x - before.x, unit.y - before.y)
      if (!moved || delta < 0.01) {
        debugHeroMove(moved ? 'moveDirect-returned-true-without-position-change' : 'moveDirect-returned-false', unit, {
          keys: [...this.keysPressed],
          input: { dx, dy, len },
          normalized: { dx: dx / len, dy: dy / len },
          distance,
          frameScale,
          speedFactor,
          stealthSpeedFactor,
          lockedMoveSpeedFactor,
          attacking,
          hasMoveDirect: Boolean(unit.moveDirect),
          before,
          after: { x: unit.x, y: unit.y, i: unit.i, j: unit.j },
          delta,
        })
      }
    }
    if (moved) {
      if (!attacking && unit.currentSheet !== SHEET_TYPES.walking) unit.setTextures?.(SHEET_TYPES.walking)
      if (!attacking && !unit.sprite?.playing) unit.sprite?.play?.()
      this.wasMoving = true
    } else if (this.wasMoving) {
      this.wasMoving = false
      if (!attacking) {
        unit.setTextures?.(SHEET_TYPES.standing)
        unit.sprite?.stop?.()
      }
    }
  }

  attackTowardPoint(point: HeroAimPoint): boolean {
    const hero = this.heroUnit
    if (!hero) return false
    if (hero.actionLocked) return false
    if (isMountedAttackAimBlocked(hero, point)) return false
    this.facePoint(point)
    hero.stop?.()
    return triggerToolAttackAt(hero, this.equippedItem, point)
  }

  handlePrimaryPointerDown(): void {
    if (this.pendingGoToNpcs) {
      this.resolveGoTo()
      return
    }
    if (this.equippedItem === 'lasso' && this.heroUnit?.heroLasso) {
      cancelHeroLasso(this.heroUnit)
      this.mouseHeld = false
      this.primaryClickPoint = null
      return
    }
    this.primaryClickPoint = this.getShiftMoveLockedAimPoint() ?? this.controls.getWorldPointUnderCursor()
    const beforeLoad = this.heroUnit?.loading ?? 0
    const triggered = this.attackTowardPoint(this.primaryClickPoint)
    const unit = this.heroUnit
    const deliveredLoad = beforeLoad > 0 && (unit?.loading ?? 0) <= 0
    this.mouseHeld = triggered && !deliveredLoad
    if (!this.mouseHeld) this.primaryClickPoint = null
  }

  handleDefenseKeyDown(): void {
    const unit = this.heroUnit
    if (!unit) return
    this.facePoint(this.getShiftMoveLockedAimPoint() ?? this.controls.getWorldPointUnderCursor())
    if (beginHeroDefense(unit, this.equippedItem)) {
      this.mouseHeld = true
    }
  }

  handleSecondaryPointerDown(): void {
    this.handleDefenseKeyDown()
  }

  handlePointerUp(button = 0): void {
    const unit = this.heroUnit
    if (button === 2) {
      if (unit && releaseHeroDefense(unit)) {
        this.mouseHeld = false
      }
      return
    }
    if (button !== 0) return
    if (unit && isHeroBowChargeActiveForTool(unit, this.equippedItem) && releaseHeroBowCharge(unit)) {
      this.mouseHeld = false
      this.primaryClickPoint = null
      return
    }
    this.mouseHeld = false
    this.primaryClickPoint = null
    if (!unit || unit.actionLocked || unit.currentSheet !== SHEET_TYPES.action) return
    const sprite = unit.sprite
    if (!sprite) {
      unit.previousDest = null
      unit.stop?.()
      return
    }
    sprite.onLoop = () => {
      sprite.onLoop = undefined
      unit.previousDest = null
      unit.stop?.()
    }
  }

  beginCommCharge(): void {
    const hero = this.heroUnit
    if (!hero || this.commCharging) return
    if (!heroCanCommand(hero)) return
    this.commCharging = true
    this.commChargeStart = performance.now()
    const indicator = new Graphics()
    indicator.label = LABEL_TYPES.commRadius
    indicator.zIndex = -1
    hero.addChildAt(indicator, 0)
    this.commIndicator = indicator
  }

  updateCommIndicator(): void {
    const indicator = this.commIndicator
    const hero = this.heroUnit
    if (!indicator || !hero) return
    indicator.position.y = getReliefOffset(hero)
    const elapsed = performance.now() - this.commChargeStart
    indicator.clear()
    if (elapsed < COMM_INDICATOR_DELAY_MS) return
    const radius = getCommRadiusForHold(elapsed)
    drawCommIndicatorCells(indicator, hero, radius)
  }

  endCommCharge(): void {
    const hero = this.heroUnit
    const elapsed = performance.now() - this.commChargeStart
    this.cancelCommCharge()
    if (!hero) return
    const precisionOnly = elapsed < COMM_INDICATOR_DELAY_MS
    const radius = precisionOnly ? 0 : getCommRadiusForHold(elapsed)
    const group = resolveCommGroup(hero, radius, { precisionOnly })
    if (group.length) {
      this.controls.context.menu?.openNpcOrders?.(group)
      return
    }
    // A quick tap that caught no commandable ally falls back to the same inspect/chatter
    // resolution a non-chief hero always gets — a genuine hold gesture that nets nobody
    // stays a silent no-op instead.
    if (precisionOnly) this.controls.openHeroEntityInteraction()
  }

  cancelCommCharge(): void {
    this.commCharging = false
    if (this.commIndicator) {
      this.commIndicator.parent?.removeChild(this.commIndicator)
      this.commIndicator.destroy(true)
      this.commIndicator = null
    }
  }

  beginGoToPicking(npcs: UnitEntity[]): void {
    this.pendingGoToNpcs = npcs
  }

  cancelGoToPicking(): void {
    const npcs = this.pendingGoToNpcs
    this.pendingGoToNpcs = null
    if (npcs?.length) releaseIfStillLooking(npcs)
  }

  resolveGoTo(): void {
    const npcs = this.pendingGoToNpcs
    this.pendingGoToNpcs = null
    if (!npcs?.length) return
    const cell = this.controls.getCellUnderCursor()
    if (cell) sendNpcGroupToTarget(npcs, cell, this.controls.getWorldPointUnderCursor())
    else releaseIfStillLooking(npcs)
  }

  setEquippedItem(item: HeroEquippedItem | null): void {
    const unit = this.heroUnit
    if (unit?.heroDefenseActive) cancelHeroDefense(unit)
    if (unit && item !== 'lasso') cancelHeroLasso(unit)
    if (unit && !isHeroBowChargeActiveForTool(unit, item)) {
      cancelHeroBowCharge(unit)
      this.mouseHeld = false
      this.primaryClickPoint = null
    }
    this.equippedItem = item
    if (unit?.actionLocked) {
      // Mid-action (e.g. chopping wood) the sprite is looping on the action sheet;
      // reconcile via stop() first so it resets actionLocked/sprite.loop and clears
      // the loop callback, instead of applyToolAppearance swapping to the walking
      // sheet mid-loop and leaving actionLocked stuck true forever.
      unit.stop?.()
    } else if (item && unit) {
      applyToolAppearance(unit, item)
    }
    this.controls.context.menu?.setEquippedItem?.(item)
    this.controls.context.menu?.setEquippedTool?.(item)
  }

  setEquippedTool(tool: HeroEquippedItem | null): void {
    this.setEquippedItem(tool)
  }

  stopKeyboardMove(): void {
    this.keysPressed.clear()
    this.shiftMoveLockedDegree = null
  }

  cancelActiveInteraction(): void {
    this.stopKeyboardMove()
    this.mouseHeld = false
    this.primaryClickPoint = null
    this.cancelMountTransition()
    if (this.heroUnit) cancelHeroBowCharge(this.heroUnit)
    if (this.heroUnit) cancelHeroLasso(this.heroUnit)
    if (this.heroUnit) cancelHeroDefense(this.heroUnit)
    if (this.commCharging) this.cancelCommCharge()
    if (this.pendingGoToNpcs) this.cancelGoToPicking()
  }

  updateCriticalHealthEffects(elapsedMs: number, active = true): void {
    this.criticalHealthEffects.update(active ? this.heroUnit : null, elapsedMs, active)
  }

  updateOcclusionFade(elapsedMs: number, active = true): void {
    this.occlusionFade.update(active ? this.heroUnit : null, elapsedMs)
  }

  destroy(): void {
    this.cancelMountTransition()
    this.criticalHealthEffects.destroy()
    this.occlusionFade.destroy()
  }

  initFromPlayerStart(): boolean {
    const {
      context: { player },
    } = this.controls

    if (!player?.units?.length) return false

    if (this.heroUnit && this.heroUnit !== player.units[0]) {
      setUnitControlMode(this.heroUnit, 'standard')
      refreshBakedAppearance(this.heroUnit)
      this.criticalHealthEffects.update(null, TARGET_FRAME_MS, false)
    }
    this.heroUnit = player.units[0]
    setUnitControlMode(this.heroUnit, 'hero')
    refreshBakedAppearance(this.heroUnit)
    this.heroUnit.stop?.()
    this.heroUnit.removeHealthBar?.()
    player.unselectAll?.()
    this.setEquippedTool('interact')
    this.controls.context.menu?.setHeroStatusTarget?.(this.heroUnit)
    this.controls.context.menu?.setActionTarget?.(this.heroUnit)
    this.controls.setCamera(this.heroUnit.x, this.heroUnit.y)
    updateInstanceRenderVisibility(this.heroUnit)
    this.heroUnit.visible = true
    return true
  }
}
