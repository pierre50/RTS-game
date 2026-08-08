import { Assets, Graphics } from 'pixi.js'
import {
  cartesianToIsometric,
  drawRoundedIsoShape,
  getInstanceDegree,
  getReliefOffset,
  getRoundedIsoShapePoints,
  updateInstanceRenderVisibility,
} from '../lib'
import {
  COMM_INDICATOR_FILL_ALPHA,
  COMM_INDICATOR_FILL_COLOR,
  COMM_INDICATOR_STROKE_ALPHA,
  COMM_INDICATOR_STROKE_COLOR,
  COMM_INDICATOR_STROKE_WIDTH,
  HERO_ACTION_MOVE_SPEED_FACTOR,
  LABEL_TYPES,
  MOUNTED_HORSE_SPEED_BONUS,
  SHEET_TYPES,
  STEP_TIME,
} from '../constants'
import {
  aimHeroBowChargeAt,
  aimHeroDefenseAt,
  applyToolAppearance,
  beginHeroDefense,
  cancelHeroBowCharge,
  cancelHeroDefense,
  isMountedAttackAimBlocked,
  releaseHeroDefense,
  releaseHeroBowCharge,
  triggerToolAttackAt,
  updateHeroDefense,
  updateHeroBowCharge,
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
import type { ControlBindingAction } from '../lib/settings'
import { setUnitControlMode } from '../lib/unitControl'
import { updateUnitEnergy } from '../lib/unitEnergy'
import { updateUnitHealthRegen } from '../lib/unitHealth'
import { HeroCriticalHealthEffects } from '../services/HeroCriticalHealthEffects'
import { HeroOcclusionFade } from '../services/HeroOcclusionFade'
import type Controls from '../classes/Controls'
import type { UnitEntity } from '../types/entities'

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
type MoveVector = { dx: number; dy: number }

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
    this.criticalHealthEffects = new HeroCriticalHealthEffects(controls.context.app)
    this.occlusionFade = new HeroOcclusionFade()
  }

  facePoint(point: HeroAimPoint): void {
    const unit = this.heroUnit
    if (!unit || unit.actionLocked) return
    const aimDegree = getInstanceDegree(unit, point.x, point.y)
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
      // immediately as an inspect/chatter interaction, same as a non-chief always could via F.
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

  toggleHeroHorse(): boolean {
    const unit = this.heroUnit
    if (!unit) return false
    if (unit.mountedOnHorse) {
      unit.mountedOnHorse = false
      unit.speed = Math.max(0, Number(((unit.speed ?? 0) - MOUNTED_HORSE_SPEED_BONUS).toFixed(6)))
      unit.removeMountedHorseSprite?.()
      unit.syncMountedRiderPosition?.()
      unit.setTextures?.(unit.currentSheet ?? SHEET_TYPES.standing)
      return true
    }
    unit.mountedOnHorse = true
    unit.speed = (unit.speed ?? 0) + MOUNTED_HORSE_SPEED_BONUS
    unit.setTextures?.(unit.currentSheet ?? SHEET_TYPES.standing)
    return true
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
    const bowChargeAiming = aimHeroBowChargeAt(unit, aimPoint)
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

    const keyboardMove = getKeyboardMoveVector(this.keysPressed)
    const keyboardMoving = keyboardMove.dx !== 0 || keyboardMove.dy !== 0
    const lockedKeyboardMove = Boolean(this.controls.shiftKeyActive && keyboardMoving && !unit.mountedOnHorse)
    if (lockedKeyboardMove && this.shiftMoveLockedDegree == null) {
      this.shiftMoveLockedDegree = unit.degree ?? 0
    } else if (!lockedKeyboardMove) {
      this.shiftMoveLockedDegree = null
    }
    const lockedDegree = this.shiftMoveLockedDegree
    let { dx, dy } = keyboardMove
    const gamepadMove = this.controls.getGamepadMoveVector()
    dx += gamepadMove.dx
    dy += gamepadMove.dy
    const isMoving = dx !== 0 || dy !== 0
    if (unit.isDirectMoving !== isMoving) {
      unit.isDirectMoving = isMoving
      unit.syncMountedHorseSprite?.()
    }

    let moved = false
    if (isMoving) {
      const len = Math.hypot(dx, dy)
      const speedFactor = attacking && !unit.mountedOnHorse ? HERO_ACTION_MOVE_SPEED_FACTOR : 1
      const distance = (unit.speed ?? 0) * speedFactor * (TARGET_FRAME_MS / STEP_TIME) * frameScale
      const before = { x: unit.x, y: unit.y, i: unit.i, j: unit.j }
      const aimedDegree = bowChargeAiming || defenseAiming ? unit.degree : null
      const facingVector =
        lockedKeyboardMove && lockedDegree != null && !attacking ? getVectorFromDegree(lockedDegree) : null
      const moveOptions = facingVector ? { facingDirX: facingVector.dx, facingDirY: facingVector.dy } : undefined
      moved = unit.moveDirect?.(dx / len, dy / len, distance, moveOptions) ?? false
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
    if (unit && this.equippedItem === 'bow' && releaseHeroBowCharge(unit)) {
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
    if (this.heroUnit?.heroDefenseActive) cancelHeroDefense(this.heroUnit)
    this.equippedItem = item
    if (this.heroUnit?.actionLocked) {
      // Mid-action (e.g. chopping wood) the sprite is looping on the action sheet;
      // reconcile via stop() first so it resets actionLocked/sprite.loop and clears
      // the loop callback, instead of applyToolAppearance swapping to the walking
      // sheet mid-loop and leaving actionLocked stuck true forever.
      this.heroUnit.stop?.()
    } else if (item && this.heroUnit) {
      applyToolAppearance(this.heroUnit, item)
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
    if (this.heroUnit) cancelHeroBowCharge(this.heroUnit)
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
