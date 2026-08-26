import type { Graphics } from 'pixi.js'
import { updateInstanceRenderVisibility } from '../lib'
import { SHEET_TYPES } from '../constants'
import {
  cancelHeroPowerCharge,
  cancelHeroLasso,
  cancelHeroDefense,
  getHeroAimDegree,
  type HeroEquippedItem,
} from '../lib/hero/heroTools'
import { heroCanCommand } from '../lib/chief'
import type { ControlBindingAction } from '../lib/audio/settings'
import { setUnitControlMode } from '../lib/units/unitControl'
import { HeroCriticalHealthEffects } from '../services/HeroCriticalHealthEffects'
import { HeroOcclusionFade } from '../services/HeroOcclusionFade'
import type { ControlsLike } from '../types/context'
import type { UnitEntity } from '../types/entities'
import type { RuntimeCell } from '../types/map'
import { HeroActionInputController } from './HeroActionInputController'
import { HeroCompanionHorseController } from './HeroCompanionHorseController'
import {
  beginHeroCommCharge,
  beginHeroGoToPicking,
  cancelHeroCommCharge,
  cancelHeroGoToPicking,
  endHeroCommCharge,
  resolveHeroGoTo,
  updateHeroCommIndicator,
} from './HeroCommunicationController'
import { updateHeroControllerRuntime } from './HeroControllerUpdate'
import { HeroEquipmentController } from './HeroEquipmentController'
import {
  COMPANION_HORSE_CALL_MAX_RADIUS,
  TARGET_FRAME_MS,
  getPointInDirection,
  isHeroMoveAction,
  refreshBakedAppearance,
  type CompanionHorse,
  type HeroAimPoint,
  type ViewportMetrics,
} from './HeroControllerSupport'

const HERO_TOOL_ACTIONS: Partial<Record<ControlBindingAction, number>> = {
  heroTool1: 0,
  heroTool2: 1,
  heroTool3: 2,
  heroTool4: 3,
}

export class HeroController {
  controls: ControlsLike
  heroUnit: UnitEntity | null
  equippedItem: HeroEquippedItem | null
  keysPressed: Set<ControlBindingAction>
  wasMoving: boolean
  mouseHeld: boolean
  defenseHeld: boolean
  commCharging: boolean
  commChargeStart: number
  commIndicator: Graphics | null
  pendingGoToNpcs: UnitEntity[] | null
  primaryClickPoint: HeroAimPoint | null
  shiftMoveLockedDegree: number | null
  actionInputController: HeroActionInputController
  companionHorseController: HeroCompanionHorseController
  equipmentController: HeroEquipmentController
  keyboardInteractHeld: boolean
  criticalHealthEffects: HeroCriticalHealthEffects
  occlusionFade: HeroOcclusionFade

  constructor(controls: ControlsLike) {
    this.controls = controls
    this.heroUnit = null
    this.equippedItem = null
    this.keysPressed = new Set()
    this.wasMoving = false
    this.mouseHeld = false
    this.defenseHeld = false
    this.commCharging = false
    this.commChargeStart = 0
    this.commIndicator = null
    this.pendingGoToNpcs = null
    this.primaryClickPoint = null
    this.shiftMoveLockedDegree = null
    this.actionInputController = new HeroActionInputController(this)
    this.companionHorseController = new HeroCompanionHorseController(controls, () => this.heroUnit)
    this.equipmentController = new HeroEquipmentController(this)
    this.keyboardInteractHeld = false
    this.criticalHealthEffects = new HeroCriticalHealthEffects(controls.context.app)
    this.occlusionFade = new HeroOcclusionFade()
  }

  get companionHorse(): CompanionHorse | null {
    return this.companionHorseController.companionHorse
  }

  set companionHorse(horse: CompanionHorse | null) {
    this.companionHorseController.companionHorse = horse
  }

  get mountTransitionTaskId(): number | null {
    return this.companionHorseController.mountTransitionTaskId
  }

  set mountTransitionTaskId(taskId: number | null) {
    this.companionHorseController.mountTransitionTaskId = taskId
  }

  isHeroActionHeld(): boolean {
    return this.mouseHeld || this.keyboardInteractHeld
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
      this.keyboardInteractHeld = true
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

    if (isHeroMoveAction(action)) {
      if (this.keysPressed.size === 0 && !this.heroUnit?.actionLocked) this.heroUnit?.stop?.()
      this.keysPressed.add(action)
      return true
    }

    return false
  }

  equipToolAt(index: number): boolean {
    return this.equipmentController.equipToolAt(index)
  }

  cycleTool(direction: 1 | -1): boolean {
    return this.equipmentController.cycleTool(direction)
  }

  setHeroMountedOnHorse(mounted: boolean): boolean {
    return this.companionHorseController.setHeroMountedOnHorse(mounted)
  }

  getViewportMetrics(): ViewportMetrics | null {
    return this.companionHorseController.getViewportMetrics()
  }

  createCompanionHorseNearHero(
    radiusLimit = COMPANION_HORSE_CALL_MAX_RADIUS,
    options: { minRadius?: number; useViewport?: boolean } = {}
  ): CompanionHorse | null {
    return this.companionHorseController.createCompanionHorseNearHero(radiusLimit, options)
  }

  createCompanionHorseAt(cell: RuntimeCell): CompanionHorse | null {
    return this.companionHorseController.createCompanionHorseAt(cell)
  }

  registerCompanionHorse(horse: CompanionHorse): CompanionHorse {
    return this.companionHorseController.registerCompanionHorse(horse)
  }

  getActiveCompanionHorse(): CompanionHorse | null {
    return this.companionHorseController.getActiveCompanionHorse()
  }

  sendCompanionHorseToHero(horse: CompanionHorse, unit: UnitEntity): void {
    this.companionHorseController.sendCompanionHorseToHero(horse, unit)
  }

  callCompanionHorse(): boolean {
    return this.companionHorseController.callCompanionHorse()
  }

  snapHeroToCell(targetCell: RuntimeCell): void {
    this.companionHorseController.snapHeroToCell(targetCell)
  }

  snapHeroToHorse(horse: CompanionHorse): void {
    this.companionHorseController.snapHeroToHorse(horse)
  }

  finishCompanionHorseMount(horse: CompanionHorse): boolean {
    return this.companionHorseController.finishCompanionHorseMount(horse)
  }

  finishCompanionHorseDismount(): boolean {
    return this.companionHorseController.finishCompanionHorseDismount()
  }

  cancelMountTransition(restoreAlpha = true): void {
    this.companionHorseController.cancelMountTransition(restoreAlpha)
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
    return this.companionHorseController.startHorseTransition({ cameraEnd, finish, taskName, targetValid })
  }

  mountCompanionHorse(horse: CompanionHorse): boolean {
    return this.companionHorseController.mountCompanionHorse(horse)
  }

  dismountCompanionHorse(): boolean {
    return this.companionHorseController.dismountCompanionHorse()
  }

  toggleHeroHorse(): boolean {
    return this.companionHorseController.toggleHeroHorse()
  }

  handleKeyUp(action: ControlBindingAction): void {
    if (isHeroMoveAction(action)) this.keysPressed.delete(action)
    if (action === 'heroInteract') {
      this.keyboardInteractHeld = false
      if (this.commCharging) this.endCommCharge()
    }
    if (action === 'heroDefense') this.actionInputController.handleDefenseKeyUp()
  }

  update(frameScale: number): void {
    updateHeroControllerRuntime(this, frameScale)
  }

  attackTowardPoint(point: HeroAimPoint): boolean {
    return this.actionInputController.attackTowardPoint(point)
  }

  handlePrimaryPointerDown(): void {
    this.actionInputController.handlePrimaryPointerDown()
  }

  handleDefenseKeyDown(): void {
    this.actionInputController.handleDefenseKeyDown()
  }

  handleSecondaryPointerDown(): void {
    this.actionInputController.handleSecondaryPointerDown()
  }

  handlePointerUp(button = 0): void {
    this.actionInputController.handlePointerUp(button)
  }

  beginCommCharge(): void {
    beginHeroCommCharge(this)
  }

  updateCommIndicator(): void {
    updateHeroCommIndicator(this)
  }

  endCommCharge(): void {
    endHeroCommCharge(this)
  }

  cancelCommCharge(): void {
    cancelHeroCommCharge(this)
  }

  beginGoToPicking(npcs: UnitEntity[]): void {
    beginHeroGoToPicking(this, npcs)
  }

  cancelGoToPicking(): void {
    cancelHeroGoToPicking(this)
  }

  resolveGoTo(): void {
    resolveHeroGoTo(this)
  }

  setEquippedItem(item: HeroEquippedItem | null): void {
    this.equipmentController.setEquippedItem(item)
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
    this.defenseHeld = false
    this.keyboardInteractHeld = false
    this.primaryClickPoint = null
    this.cancelMountTransition()
    if (this.heroUnit) cancelHeroPowerCharge(this.heroUnit)
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
