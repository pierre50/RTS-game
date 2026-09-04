import type { AnimatedSprite } from 'pixi.js'
import { LABEL_TYPES, SHEET_TYPES, STEP_TIME } from '../../constants'
import { canUpdateMinimap } from '../../lib'
import { Instance } from '../Instance'
import './UnitRuntimeShape'
import { resumeEnergyWaitIfReady, updateUnitEnergy } from '../../lib/units/unitEnergy'
import { updateUnitHealthRegen } from '../../lib/units/unitHealth'
import { watchBanditStep } from './UnitBanditDebug'
import { syncUnitAppearanceLayers } from './UnitAppearanceLayers'
import { handleUnitIsAttacked, stopUnit } from './UnitStateHandlers'
import {
  applyUnitSpawnConfiguration,
  getCachedUnitSpritesheet,
  initializeUnitRuntimeState,
  initializeUnitServices,
  initializeUnitWorkRole,
  loadConfiguredUnitSpritesheets,
  registerInitialUnitMapPresence,
  scheduleInitialUnitVisibilityUpdate,
  setupUnitCommandDispatch,
  setupUnitInterface,
  setupUnitPointerInteraction,
  setupUnitPrimarySprite,
} from './UnitInitialization'
import {
  applyUnitOwnerColorToSprite,
  applyUnitReliefLift,
  createUnitShadow,
  pauseUnitVisuals,
  resumeUnitVisuals,
  syncUnitShadow,
  syncUnitVisualSettings,
} from './UnitVisualState'
import { flushUnitPendingOrder, handleUnitChangeDest, queueUnitPendingOrder, setUnitDestination } from './UnitOrders'
import {
  clearMountedRiderMask as clearMountedRiderMaskVisual,
  getMountedHorseBob as getMountedHorseBobVisual,
  getMountedRiderBodyTopLeft as getMountedRiderBodyTopLeftVisual,
  getMountedRiderX as getMountedRiderXVisual,
  getMountedRiderY as getMountedRiderYVisual,
  removeMountedHorseSprite as removeMountedHorseSpriteVisual,
  removeMountedRiderLegsSprite as removeMountedRiderLegsSpriteVisual,
  setupMountedHorseSprite as setupMountedHorseSpriteVisual,
  setupMountedRiderLegsSprite as setupMountedRiderLegsSpriteVisual,
  shouldUseMountedRiderCut as shouldUseMountedRiderCutVisual,
  syncMountedHorseSprite as syncMountedHorseSpriteVisual,
  syncMountedRiderLegsSprite as syncMountedRiderLegsSpriteVisual,
  syncMountedRiderPosition as syncMountedRiderPositionVisual,
  updateMountedRiderMask as updateMountedRiderMaskVisual,
} from './UnitMountedVisuals'
import type {
  BuildingEntity,
  EntityInfoRenderOptions,
  RuntimeEntity,
  UnitCommandOptions,
  UnitCreationExtra,
  UnitEntity,
  UnitResourceDeliveryReturnTask,
} from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import type { GameContextLike } from '../../types/context'
import type { UnitConfig } from '../../types/config'
import type { ActionProps } from '../../lib/combat'
import type { UnitSpawnOptions } from './UnitTypes'

export type { UnitSpawnOptions } from './UnitTypes'

export class Unit extends Instance implements UnitEntity {
  declare sprite: AnimatedSprite
  declare reliefLift: number
  private isMovingStep = false

  constructor(options: UnitSpawnOptions, context: GameContextLike) {
    super(context)
    this.sortableChildren = true
    this.selectionFactor = 0.5

    initializeUnitServices(this)
    initializeUnitRuntimeState(this)
    const spawnCell = applyUnitSpawnConfiguration(this, options)
    registerInitialUnitMapPresence(this)
    initializeUnitWorkRole(this)
    loadConfiguredUnitSpritesheets(this)
    setupUnitInterface(this)
    setupUnitPrimarySprite(this, spawnCell)
    setupUnitCommandDispatch(this)
    setupUnitPointerInteraction(this)
    scheduleInitialUnitVisibilityUpdate(this)
  }

  createShadow(source: AnimatedSprite = this.sprite, label: string = LABEL_TYPES.shadow) {
    return createUnitShadow(this, source, label)
  }

  syncShadow(shadow = this.shadow, source: AnimatedSprite | null = this.sprite) {
    syncUnitShadow(this, shadow, source)
  }

  getMountedHorseBob(): number {
    return getMountedHorseBobVisual(this)
  }

  getMountedRiderY(): number {
    return getMountedRiderYVisual(this)
  }

  getMountedRiderX(): number {
    return getMountedRiderXVisual(this)
  }

  setupMountedHorseSprite() {
    setupMountedHorseSpriteVisual(this, getCachedUnitSpritesheet)
  }

  setupMountedRiderLegsSprite() {
    setupMountedRiderLegsSpriteVisual(this, getCachedUnitSpritesheet)
  }

  syncMountedRiderPosition() {
    syncMountedRiderPositionVisual(this, getCachedUnitSpritesheet)
  }

  shouldUseMountedRiderCut(sheet = this.currentSheet): boolean {
    return shouldUseMountedRiderCutVisual(this, sheet)
  }

  updateMountedRiderMask(sheet = this.currentSheet) {
    updateMountedRiderMaskVisual(this, sheet)
  }

  clearMountedRiderMask() {
    clearMountedRiderMaskVisual(this)
  }

  getMountedRiderBodyTopLeft(): { x: number; y: number; width: number; scale: number } {
    return getMountedRiderBodyTopLeftVisual(this)
  }

  syncMountedRiderLegsSprite() {
    syncMountedRiderLegsSpriteVisual(this, getCachedUnitSpritesheet)
  }

  removeMountedRiderLegsSprite() {
    removeMountedRiderLegsSpriteVisual(this)
  }

  syncMountedHorseSprite() {
    syncMountedHorseSpriteVisual(this, getCachedUnitSpritesheet)
  }

  removeMountedHorseSprite() {
    removeMountedHorseSpriteVisual(this)
  }

  syncVisualSettings(): void {
    syncUnitVisualSettings(this)
  }

  // Render-only: this is the SOLE source of visual relief for the unit — this.x/y stay flat
  // (pathing/collision/zIndex), so this offsets the sprite, shadow and equipment layers to
  // represent the ground relief level (fractional on slopes — see getGroundReliefLevel).
  // Eased toward the target unless immediate, since the underfoot sampling can step at tile
  // boundaries. Never touches this.x/y or zIndex.
  applyReliefLift(level: number, immediate = false): void {
    applyUnitReliefLift(this, level, immediate)
  }

  syncAppearanceLayers(sheet: string) {
    syncUnitAppearanceLayers(this, sheet)
  }

  override setTextures(sheet: string) {
    super.setTextures(sheet)
    this.applyOwnerColorToSprite()
    this.syncShadow()
    this.syncMountedHorseSprite()
    this.syncAppearanceLayers(sheet)
    this.updateMountedRiderMask(sheet)
  }

  applyOwnerColorToSprite() {
    applyUnitOwnerColorToSprite(this)
  }

  override pause() {
    super.pause()
    pauseUnitVisuals(this)
  }

  override resume() {
    if (resumeUnitVisuals(this)) {
      return
    }
    super.resume()
    this.shadow?.play()
    this.horseSprite?.play()
    this.horseShadow?.play()
    for (const sprite of this.appearanceLayerSprites.values()) {
      sprite.play()
    }
  }

  override select() {
    if (this.selected) return
    super.select()
    const {
      context: { menu, player },
    } = this
    canUpdateMinimap(this, player) && menu.isMiniMapActive?.() !== false && menu.updatePlayerMiniMapEvt?.(this.owner)
  }

  override unselect() {
    if (!this.selected) return
    super.unselect()
    const {
      context: { menu, player },
    } = this
    canUpdateMinimap(this, player) && menu.isMiniMapActive?.() !== false && menu.updatePlayerMiniMapEvt?.(this.owner)
  }

  override hasPath() {
    return this.path.length > 0
  }

  setDest(dest: RuntimeEntity | RuntimeCell | null) {
    setUnitDestination(this, dest)
  }

  setPath(path: RuntimeCell[]) {
    if (!path.length) {
      this.stop()
      return
    }
    this.sprite.loop = this.loop ?? true
    if (this.shadow) this.shadow.loop = this.sprite.loop
    for (const sprite of this.appearanceLayerSprites.values()) {
      sprite.loop = this.loop ?? true
    }
    this.setTextures(SHEET_TYPES.walking)
    this.inactif = false
    this.path = path
    const runImmediate = !this.isMovingStep
    this.startInterval(() => this.step(), STEP_TIME, runImmediate, 'unit.step')
  }

  queueOrder(orderOrDest: (() => void) | RuntimeEntity | RuntimeCell, action: string | null = null): boolean {
    return queueUnitPendingOrder(this, orderOrDest, action)
  }

  flushPendingOrder(): boolean {
    return flushUnitPendingOrder(this)
  }

  handleChangeDest() {
    handleUnitChangeDest(this)
  }

  sendToEvt(
    dest: RuntimeEntity | RuntimeCell | null,
    action?: string | null,
    options?: {
      forceRepath?: boolean
      allowBlockedGatherApproach?: boolean
      preserveAutonomy?: boolean
      allowPassageStop?: boolean
    }
  ) {
    return this.unitMovement.sendToEvt(dest, action ?? null, options)
  }

  goBackToPrevious() {
    return this.unitActions.goBackToPrevious()
  }

  startGathering(
    loadingType: string,
    soundId: string | string[] | null | undefined,
    opts?: { dieOnEmpty?: boolean; checkOwner?: boolean; updateTexture?: boolean }
  ) {
    return this.unitActions.startGathering(loadingType, soundId, opts)
  }

  getAction(name: string) {
    return this.unitActions.getAction(name)
  }

  override getActionCondition(
    target: object | null | undefined,
    action = this.action ?? undefined,
    props?: ActionProps | UnitCreationExtra
  ) {
    return this.unitCommands.getActionCondition(target, action, props)
  }

  detect(instance: RuntimeEntity | null) {
    return this.unitCombat.detect(instance)
  }

  handleAffectNewDestHunter() {
    return this.unitCombat.handleAffectNewDestHunter()
  }

  upgrade(type: string) {
    return this.unitActions.upgrade(type)
  }

  affectNewDest() {
    return this.unitMovement.affectNewDest()
  }

  isUnitAtDest(action: string | null | undefined, dest: RuntimeEntity | RuntimeCell | null | undefined) {
    return this.unitMovement.isUnitAtDest(action, dest)
  }

  destHasMoved() {
    return this.unitMovement.destHasMoved()
  }

  override moveToPath() {
    return this.unitMovement.moveToPath()
  }

  override step(): void {
    if (this.isMovingStep) return
    this.isMovingStep = true
    const beforeX = this.x
    const beforeY = this.y
    updateUnitEnergy(this)
    updateUnitHealthRegen(this)
    try {
      if (resumeEnergyWaitIfReady(this)) {
        watchBanditStep(this, beforeX, beforeY)
        return
      }
      super.step()
      watchBanditStep(this, beforeX, beforeY)
    } finally {
      this.isMovingStep = false
    }
  }

  moveDirect(
    dirX: number,
    dirY: number,
    distance: number,
    options?: { facingDirX?: number; facingDirY?: number }
  ): boolean {
    return this.unitMovement.moveDirect(dirX, dirY, distance, options)
  }

  isAttacked(instance: RuntimeEntity | null) {
    return handleUnitIsAttacked(this, instance)
  }

  stop() {
    return stopUnit(this)
  }

  override startInterval(callback: () => void, time: number, immediate = true, name = 'unit.interval') {
    if (this.isDead) {
      return
    }
    this.stopInterval()
    this.interval = this.context.scheduler.add(callback, time, name)
    if (immediate) callback()
  }

  explore() {
    return this.unitMovement.explore()
  }

  runaway(instance: RuntimeEntity) {
    return this.unitMovement.runaway(instance)
  }

  decompose() {
    return this.unitLifecycle.decompose()
  }

  death() {
    return this.unitLifecycle.death()
  }

  override die() {
    return this.unitLifecycle.die()
  }

  clear() {
    return this.unitLifecycle.clear()
  }

  commonSendTo(
    target: RuntimeEntity,
    work: string,
    action: string | null,
    keepPrevious: boolean | UnitCommandOptions,
    immediate = false,
    preserveBuildQueue = false
  ) {
    return this.unitCommands.commonSendTo(target, work, action, keepPrevious, immediate, preserveBuildQueue)
  }

  // Navigate to arrivalCell but set target as the attack dest.
  // Avoids the N×M A* calls getInstanceClosestFreeCellPath makes when multiple
  // units are sent to the same solid target — each unit gets exactly one A* call.
  sendToWithCell(target: RuntimeEntity, arrivalCell: RuntimeCell, action: string) {
    return this.unitCommands.sendToWithCell(target, arrivalCell, action)
  }

  sendToAttack(target: RuntimeEntity, options?: UnitCommandOptions) {
    return this.unitCommands.sendToAttack(target, options)
  }

  sendToConvert(target: RuntimeEntity) {
    return this.unitCommands.sendToConvert(target)
  }

  sendToTakeMeat(target: RuntimeEntity, immediate = false) {
    return this.unitCommands.sendToTakeMeat(target, immediate)
  }

  sendToHunt(target: RuntimeEntity, immediate = false) {
    return this.unitCommands.sendToHunt(target, immediate)
  }

  sendToCaptureHorse(target: RuntimeEntity, immediate = false) {
    return this.unitCommands.sendToCaptureHorse(target, immediate)
  }

  sendToBuilding(target: BuildingEntity, preserveBuildQueue = false) {
    return this.unitCommands.sendToBuilding(target, preserveBuildQueue)
  }

  sendToDelivery(
    target: BuildingEntity | null = null,
    returnTaskOverride: UnitResourceDeliveryReturnTask | null = null
  ) {
    return this.unitCommands.sendToDelivery(target, returnTaskOverride)
  }

  sendToBuildingQueue(targets: BuildingEntity[]) {
    return this.unitCommands.sendToBuildingQueue(targets)
  }

  continueBuildingQueue() {
    return this.unitCommands.continueBuildingQueue()
  }

  sendToFarm(target: RuntimeEntity, immediate = false) {
    return this.unitCommands.sendToFarm(target, immediate)
  }

  sendToTree(target: RuntimeEntity, immediate = false) {
    return this.unitCommands.sendToTree(target, immediate)
  }

  sendToBerrybush(target: RuntimeEntity, immediate = false) {
    return this.unitCommands.sendToBerrybush(target, immediate)
  }

  sendToStone(target: RuntimeEntity, immediate = false) {
    return this.unitCommands.sendToStone(target, immediate)
  }

  sendToGold(target: RuntimeEntity, immediate = false) {
    return this.unitCommands.sendToGold(target, immediate)
  }

  sendToCopper(target: RuntimeEntity, immediate = false) {
    return this.unitCommands.sendToCopper(target, immediate)
  }

  sendToIron(target: RuntimeEntity, immediate = false) {
    return this.unitCommands.sendToIron(target, immediate)
  }

  setDefaultInterface(element: HTMLElement, data: UnitConfig, options?: EntityInfoRenderOptions) {
    this.unitInterface.setDefaultInterface(element, data, options)
  }

  override destroy(options?: Parameters<Instance['destroy']>[0]): void {
    this.visualSettingsCleanup?.()
    this.visualSettingsCleanup = null
    this.shadow?.parent?.removeChild(this.shadow)
    this.shadow?.destroy({ children: true, texture: false })
    this.shadow = null
    this.removeMountedHorseSprite()
    super.destroy(options)
  }
}
