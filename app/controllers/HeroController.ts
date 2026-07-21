import { Graphics } from 'pixi.js'
import {
  drawRoundedIsoShape,
  getInstanceDegree,
  getRoundedIsoShapePoints,
  updateInstanceRenderVisibility,
} from '../lib'
import { COLOR_GOLD, HERO_ACTION_MOVE_SPEED_FACTOR, LABEL_TYPES, SHEET_TYPES, STEP_TIME } from '../constants'
import {
  aimHeroBowChargeAt,
  applyToolAppearance,
  cancelHeroBowCharge,
  releaseHeroBowCharge,
  triggerToolAttackAt,
  updateHeroBowCharge,
  HERO_TOOL_ORDER,
  type HeroTool,
} from '../lib/heroTools'
import { updateHeroCursor } from '../lib/heroCursor'
import {
  getCommRadiusForHold,
  isAnyNpcNear,
  releaseIfStillLooking,
  resolveCommGroup,
  resolveHoverTarget,
  sendNpcGroupToTarget,
  updateNpcFollow,
} from '../lib/npcInteraction'
import type { ControlBindingAction } from '../lib/settings'
import { setUnitControlMode } from '../lib/unitControl'
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
  heroTool5: 4,
  heroTool6: 5,
}

let lastHeroMoveDebugAt = 0

function debugHeroMove(message: string, unit: UnitEntity, details: Record<string, unknown>): void {
  const now = performance.now()
  if (now - lastHeroMoveDebugAt < HERO_MOVE_DEBUG_THROTTLE_MS) return
  lastHeroMoveDebugAt = now
  console.debug('[ARPG hero move]', {
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

export class HeroController {
  controls: Controls
  heroUnit: UnitEntity | null
  equippedTool: HeroTool | null
  keysPressed: Set<ControlBindingAction>
  wasMoving: boolean
  mouseHeld: boolean
  commCharging: boolean
  commChargeStart: number
  commIndicator: Graphics | null
  pendingGoToNpcs: UnitEntity[] | null
  primaryClickPoint: HeroAimPoint | null

  constructor(controls: Controls) {
    this.controls = controls
    this.heroUnit = null
    this.equippedTool = null
    this.keysPressed = new Set()
    this.wasMoving = false
    this.mouseHeld = false
    this.commCharging = false
    this.commChargeStart = 0
    this.commIndicator = null
    this.pendingGoToNpcs = null
    this.primaryClickPoint = null
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

  isActive(): boolean {
    return Boolean(this.heroUnit && !this.heroUnit.isDead && !this.heroUnit.isDestroyed)
  }

  handleKeyDown(action: ControlBindingAction): boolean {
    if (!this.isActive()) return false

    if (action === 'inventory') {
      this.controls.context.menu?.toggleInventory?.()
      return true
    }

    if (action === 'heroInteract') {
      if (this.commCharging) return true
      this.beginCommCharge()
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
    const currentIndex = Math.max(0, HERO_TOOL_ORDER.indexOf(this.equippedTool ?? 'unarmed'))
    const nextIndex = (currentIndex + direction + HERO_TOOL_ORDER.length) % HERO_TOOL_ORDER.length
    return this.equipToolAt(nextIndex)
  }

  handleKeyUp(action: ControlBindingAction): void {
    if (HERO_MOVE_DIRECTIONS[action]) this.keysPressed.delete(action)
    if (action === 'heroInteract' && this.commCharging) this.endCommCharge()
  }

  update(frameScale: number): void {
    const unit = this.heroUnit
    if (!unit) return
    this.controls.context.menu?.updateHeroStatus?.(unit)
    updateNpcFollow(unit)
    if (this.commCharging) this.updateCommIndicator()
    const bowChargeAimPoint = this.controls.getWorldPointUnderCursor()
    const bowChargeAiming = aimHeroBowChargeAt(unit, bowChargeAimPoint)
    updateHeroBowCharge(unit)
    // Keep the hover-based cursor live even while picking a "go to" target — it already tells
    // the player what a click will do here (gather hand, move icon, combat icon, plain pointer).
    const hoverTarget = resolveHoverTarget(
      unit,
      this.controls.getWorldPointUnderCursor(),
      this.controls.getCellUnderCursor()
    )
    updateHeroCursor(this.equippedTool, hoverTarget, Boolean(this.pendingGoToNpcs))
    const menu = this.controls.context.menu
    if (menu?.isNpcOrdersOpen?.()) {
      const targets = menu.getNpcOrdersTarget?.() ?? []
      if (!isAnyNpcNear(unit, targets)) menu.closeNpcOrders?.()
    }
    if (menu?.isArpgBuildingMenuOpen?.()) {
      menu.closeArpgBuildingMenuIfInvalid?.()
    }
    if (
      this.mouseHeld &&
      !unit.actionLocked &&
      unit.currentSheet !== SHEET_TYPES.action &&
      !this.attackTowardCursor()
    ) {
      this.mouseHeld = false
      this.primaryClickPoint = null
    }
    const attacking = Boolean(unit.actionLocked)

    let dx = 0
    let dy = 0
    for (const action of this.keysPressed) {
      const dir = HERO_MOVE_DIRECTIONS[action]
      if (!dir) continue
      dx += dir.dx
      dy += dir.dy
    }
    const gamepadMove = this.controls.getGamepadMoveVector()
    dx += gamepadMove.dx
    dy += gamepadMove.dy
    const isMoving = dx !== 0 || dy !== 0

    let moved = false
    if (isMoving) {
      const len = Math.hypot(dx, dy)
      const speedFactor = attacking ? HERO_ACTION_MOVE_SPEED_FACTOR : 1
      const distance = (unit.speed ?? 0) * speedFactor * (TARGET_FRAME_MS / STEP_TIME) * frameScale
      const before = { x: unit.x, y: unit.y, i: unit.i, j: unit.j }
      const bowChargeDegree = bowChargeAiming ? unit.degree : null
      moved = unit.moveDirect?.(dx / len, dy / len, distance) ?? false
      if (bowChargeDegree != null && unit.degree !== bowChargeDegree) {
        unit.degree = bowChargeDegree
      }
      if (moved && menu?.isArpgBuildingMenuOpen?.()) menu.closeArpgBuildingMenu?.()
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

  attackTowardCursor(): boolean {
    return this.attackTowardPoint(this.controls.getWorldPointUnderCursor())
  }

  attackTowardPoint(point: HeroAimPoint): boolean {
    const hero = this.heroUnit
    if (!hero) return false
    if (hero.actionLocked) return false
    this.facePoint(point)
    hero.stop?.()
    return triggerToolAttackAt(hero, this.equippedTool, point)
  }

  handlePrimaryPointerDown(): void {
    if (this.pendingGoToNpcs) {
      this.resolveGoTo()
      return
    }
    this.primaryClickPoint = this.controls.getWorldPointUnderCursor()
    const beforeLoad = this.heroUnit?.loading ?? 0
    const triggered = this.attackTowardPoint(this.primaryClickPoint)
    const unit = this.heroUnit
    const deliveredLoad = beforeLoad > 0 && (unit?.loading ?? 0) <= 0
    this.mouseHeld = triggered && !deliveredLoad
    if (!this.mouseHeld) this.primaryClickPoint = null
  }

  handlePointerUp(): void {
    const unit = this.heroUnit
    if (unit && this.equippedTool === 'bow' && releaseHeroBowCharge(unit)) {
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
    if (!indicator) return
    const elapsed = performance.now() - this.commChargeStart
    const radius = getCommRadiusForHold(elapsed)
    indicator.clear()
    drawRoundedIsoShape(indicator, getRoundedIsoShapePoints({ factor: radius }))
    indicator.stroke({ color: COLOR_GOLD, width: 2, alpha: 0.85 })
  }

  endCommCharge(): void {
    const hero = this.heroUnit
    const elapsed = performance.now() - this.commChargeStart
    this.cancelCommCharge()
    if (!hero) return
    const radius = getCommRadiusForHold(elapsed)
    const group = resolveCommGroup(hero, radius)
    if (group.length) this.controls.context.menu?.openNpcOrders?.(group)
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

  setEquippedTool(tool: HeroTool | null): void {
    this.equippedTool = tool
    if (tool && this.heroUnit) applyToolAppearance(this.heroUnit, tool)
    this.controls.context.menu?.setEquippedTool?.(tool)
  }

  stopKeyboardMove(): void {
    this.keysPressed.clear()
  }

  cancelActiveInteraction(): void {
    this.stopKeyboardMove()
    this.mouseHeld = false
    this.primaryClickPoint = null
    if (this.heroUnit) cancelHeroBowCharge(this.heroUnit)
    if (this.commCharging) this.cancelCommCharge()
    if (this.pendingGoToNpcs) this.cancelGoToPicking()
  }

  initFromPlayerStart(): boolean {
    const {
      context: { map, player },
    } = this.controls

    if (!map.arpgMode || !player?.units?.length) return false

    if (this.heroUnit && this.heroUnit !== player.units[0]) {
      setUnitControlMode(this.heroUnit, 'rts')
    }
    this.heroUnit = player.units[0]
    setUnitControlMode(this.heroUnit, 'arpg')
    this.heroUnit.stop?.()
    this.heroUnit.removeHealthBar?.()
    player.unselectAll?.()
    this.setEquippedTool('unarmed')
    this.controls.context.menu?.setHeroStatusTarget?.(this.heroUnit)
    this.controls.context.menu?.setBottombar?.(this.heroUnit)
    this.controls.setCamera(this.heroUnit.x, this.heroUnit.y)
    updateInstanceRenderVisibility(this.heroUnit)
    this.heroUnit.visible = true
    return true
  }
}
