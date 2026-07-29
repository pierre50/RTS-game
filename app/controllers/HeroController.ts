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
  ACTION_TYPES,
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
  applyToolAppearance,
  cancelHeroBowCharge,
  releaseHeroBowCharge,
  triggerToolAttackAt,
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
  isAnyNpcNear,
  releaseIfStillLooking,
  resolveCommGroup,
  resolveHoverTarget,
  sendNpcGroupToTarget,
  updateNpcFollow,
} from '../lib/npcInteraction'
import type { ControlBindingAction } from '../lib/settings'
import { t } from '../lib/lang'
import { setUnitControlMode } from '../lib/unitControl'
import { updateUnitEnergy } from '../lib/unitEnergy'
import { updateUnitHealthRegen } from '../lib/unitHealth'
import type Controls from '../classes/Controls'
import type { UnitEntity } from '../types/entities'

const TARGET_FRAME_MS = 1000 / 60
const HERO_MOVE_DEBUG_THROTTLE_MS = 250
type HeroAimPoint = { x: number; y: number }
type AnimationLayer = {
  loop: boolean
  onComplete?: () => void
  onFrameChange?: (frame: number) => void
  onLoop?: () => void
  play: () => void
  stop: () => void
}
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

let lastHeroMoveDebugAt = 0

function getAnimationLayers(unit: UnitEntity): Iterable<AnimationLayer> {
  return (
    (unit as UnitEntity & { appearanceLayerSprites?: Map<number, AnimationLayer> }).appearanceLayerSprites?.values() ??
    []
  )
}

function finishHeldFishingAnimation(unit: UnitEntity): void {
  const sprite = unit.sprite
  if (!sprite) {
    unit.previousDest = null
    unit.stop?.()
    return
  }
  ;(unit as UnitEntity & { shoreFishingFinishing?: boolean }).shoreFishingFinishing = true
  unit.stopInterval?.()
  sprite.onLoop = undefined
  sprite.loop = false
  unit.shadow && (unit.shadow.loop = false)
  for (const layer of getAnimationLayers(unit)) {
    layer.loop = false
    layer.play()
  }
  sprite.onComplete = () => {
    sprite.onComplete = undefined
    ;(unit as UnitEntity & { shoreFishingFinishing?: boolean }).shoreFishingFinishing = false
    unit.previousDest = null
    unit.stop?.()
  }
  if (unit.shadow) unit.shadow.play()
  sprite.play()
}

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
      if (!heroCanCommand(this.heroUnit)) {
        this.controls.context.menu?.showMessage?.(t('requiresChief'), 'warning')
        return true
      }
      if (this.commCharging) return true
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
  }

  update(frameScale: number): void {
    const unit = this.heroUnit
    if (!unit) return
    updateUnitEnergy(unit, TARGET_FRAME_MS * frameScale)
    updateUnitHealthRegen(unit, TARGET_FRAME_MS * frameScale)
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
    updateHeroCursor(this.equippedItem, hoverTarget, Boolean(this.pendingGoToNpcs))
    const menu = this.controls.context.menu
    if (menu?.isNpcOrdersOpen?.()) {
      const targets = menu.getNpcOrdersTarget?.() ?? []
      if (!isAnyNpcNear(unit, targets)) menu.closeNpcOrders?.()
    }
    if (menu?.isHeroBuildingMenuOpen?.()) {
      menu.closeHeroBuildingMenuIfInvalid?.()
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
      const bowChargeDegree = bowChargeAiming ? unit.degree : null
      moved = unit.moveDirect?.(dx / len, dy / len, distance) ?? false
      if (bowChargeDegree != null && unit.degree !== bowChargeDegree) {
        unit.degree = bowChargeDegree
      }
      if (moved && menu?.isHeroBuildingMenuOpen?.()) menu.closeHeroBuildingMenu?.()
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
    return triggerToolAttackAt(hero, this.equippedItem, point)
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
    if (unit && this.equippedItem === 'bow' && releaseHeroBowCharge(unit)) {
      this.mouseHeld = false
      this.primaryClickPoint = null
      return
    }
    this.mouseHeld = false
    this.primaryClickPoint = null
    if (unit?.action === ACTION_TYPES.fishing && unit.currentSheet === SHEET_TYPES.action) {
      finishHeldFishingAnimation(unit)
      return
    }
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

  setEquippedItem(item: HeroEquippedItem | null): void {
    this.equippedItem = item
    if (item && this.heroUnit) applyToolAppearance(this.heroUnit, item)
    this.controls.context.menu?.setEquippedItem?.(item)
    this.controls.context.menu?.setEquippedTool?.(item)
  }

  setEquippedTool(tool: HeroEquippedItem | null): void {
    this.setEquippedItem(tool)
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
      context: { player },
    } = this.controls

    if (!player?.units?.length) return false

    if (this.heroUnit && this.heroUnit !== player.units[0]) {
      setUnitControlMode(this.heroUnit, 'standard')
      refreshBakedAppearance(this.heroUnit)
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
