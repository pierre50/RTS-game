import { isUnitSuspended } from '../../lib/units/unitSuspension'
import { getUnitRestVisualSheet } from '../../lib/units/visuals/unitSittingPose'
import type { AnimatedSprite, Container, ContainerChild } from 'pixi.js'
import { FAMILY_TYPES, LABEL_TYPES, SHEET_TYPES, STEP_TIME } from '../../constants'
import { canUpdateMinimap, uuidv4 } from '../../lib'
import { getEntitySpaceMapLike } from '../../lib/mapSpaces'
import { unitVisualState, type UnitVisualState } from '../../rendering/UnitView'
import type { UnitAnimation } from '../../rendering/UnitAnimation'
import { PixiUnitView } from '../../rendering/pixi/PixiUnitView'
import { drawInstanceEnergyBar, drawInstanceHealthBar, drawInstanceHeroPowerBar, removeInstanceHudBar, isTeamHealthBarRestricted, isHeroTeamUnit } from '../InstanceHudBars'
import './UnitRuntimeShape'
import { resumeEnergyWaitIfReady, updateUnitEnergy } from '../../lib/units/unitEnergy'
import { watchBanditStep } from './UnitBanditDebug'
import { syncUnitAppearanceLayers } from './appearance/UnitAppearanceLayers'
import { handleUnitIsAttacked, stopUnit } from './UnitStateHandlers'
import {
  applyUnitSpawnConfiguration,
  assertUnitVisualAssets,
  getCachedUnitSpritesheet,
  initializeUnitRuntimeState,
  initializeUnitServices,
  initializeUnitWorkRole,
  loadConfiguredUnitSpritesheets,
  registerInitialUnitMapPresence,
  scheduleInitialUnitVisibilityUpdate,
  setupUnitCommandDispatch,
  setupUnitInterface,
} from './UnitInitialization'
import {
  applyUnitOwnerColorToSprite,
  createUnitShadow,
  syncUnitShadow,
  syncUnitVisualSettings,
} from './appearance/UnitVisualState'
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
} from './appearance/UnitMountedVisuals'
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

export class Unit implements UnitEntity {
  context: GameContextLike
  label: string
  selected = false
  isDead = false
  isDestroyed = false
  interval: number | null = null
  timeoutId: number | null = null
  family!: string
  type!: string
  i!: number
  j!: number
  z!: number | null
  size!: number
  degree!: number
  owner!: NonNullable<UnitEntity['owner']>
  hitPoints!: number
  totalHitPoints!: number
  action?: string | null
  playingBeforePause?: boolean
  private mapX = 0
  private mapY = 0
  private renderVisible = true
  private renderOrder = 0
  private renderAlpha = 1
  declare sprite: AnimatedSprite
  declare reliefLift: number
  exploringForAutonomy = false
  private isMovingStep = false
  private readonly unitView: PixiUnitView

  constructor(options: UnitSpawnOptions, context: GameContextLike) {
    this.context = context
    this.label = options.label ?? uuidv4()
    this.unitView = new PixiUnitView(this, id => {
      if (id === this.label) this.context.editor?.handleEntityInteraction?.(this)
    })
    initializeUnitServices(this)
    initializeUnitRuntimeState(this)
    try {
      applyUnitSpawnConfiguration(this, options)
      registerInitialUnitMapPresence(this)
      initializeUnitWorkRole(this)
      loadConfiguredUnitSpritesheets(this)
      setupUnitInterface(this)
      assertUnitVisualAssets(this)
      this.unitView.mount(this.getVisualState())
      setupUnitCommandDispatch(this)
      scheduleInitialUnitVisibilityUpdate(this)
    } catch (error) {
      this.isDestroyed = true
      const cell = this.currentCell
      if (cell?.has === this) {
        cell.has = null
        cell.solid = false
      }
      cell?.corpses.delete(this)
      for (const list of [this.owner?.units, this.owner?.corpses]) {
        const index = list?.indexOf(this) ?? -1
        if (index >= 0) list?.splice(index, 1)
      }
      context.map.removeFromInstanceBucket(this)
      this.stopInterval()
      this.stopTimeout()
      clearTimeout(this.visibilityTimeout)
      this.destroy({ children: true, texture: false })
      throw error
    }
  }

  get displayObject(): Container {
    return this.unitView.container
  }

  get visualAnimation(): UnitAnimation {
    return this.unitView
  }

  get x(): number {
    return this.mapX
  }

  set x(value: number) {
    this.mapX = value
    if (this.unitView) this.displayObject.x = value
  }

  get y(): number {
    return this.mapY
  }

  set y(value: number) {
    this.mapY = value
    if (this.unitView) this.displayObject.y = value
  }

  get visible(): boolean {
    return this.renderVisible
  }

  set visible(value: boolean) {
    this.renderVisible = value
    if (this.unitView) this.displayObject.visible = value
  }

  get zIndex(): number {
    return this.renderOrder
  }

  set zIndex(value: number) {
    this.renderOrder = value
    if (this.unitView) this.displayObject.zIndex = value
  }

  get alpha(): number {
    return this.renderAlpha
  }

  set alpha(value: number) {
    this.renderAlpha = value
    if (this.unitView) this.displayObject.alpha = value
  }

  get parent(): Container | null {
    return this.displayObject.parent
  }

  get width(): number {
    return this.displayObject.width
  }

  get height(): number {
    return this.displayObject.height
  }

  get destroyed(): boolean {
    return this.displayObject.destroyed
  }

  get sortableChildren(): boolean {
    return this.displayObject.sortableChildren
  }

  set sortableChildren(value: boolean) {
    this.displayObject.sortableChildren = value
  }

  get eventMode(): Container['eventMode'] {
    return this.displayObject.eventMode
  }

  set eventMode(value: Container['eventMode']) {
    this.displayObject.eventMode = value
  }

  addChild: Container['addChild'] = ((...children: ContainerChild[]) =>
    this.displayObject.addChild(...children)) as Container['addChild']

  addChildAt: Container['addChildAt'] = ((child: ContainerChild, index: number) =>
    this.displayObject.addChildAt(child, index)) as Container['addChildAt']

  removeChild: Container['removeChild'] = ((...children: ContainerChild[]) =>
    this.displayObject.removeChild(...children)) as Container['removeChild']

  getChildByLabel: Container['getChildByLabel'] = ((label: string) =>
    this.displayObject.getChildByLabel(label)) as Container['getChildByLabel']

  getChildIndex(child: ContainerChild): number {
    return this.displayObject.getChildIndex(child)
  }

  on: Container['on'] = ((...args: Parameters<Container['on']>) =>
    this.displayObject.on(...args)) as Container['on']

  once: Container['once'] = ((...args: Parameters<Container['once']>) =>
    this.displayObject.once(...args)) as Container['once']

  assignProperties(source: object | null | undefined): void {
    if (!source) return
    for (const [key, value] of Object.entries(source)) {
      if (key === 'name') {
        Object.defineProperty(this, key, { configurable: true, enumerable: true, writable: true, value })
      } else {
        ;(this as Record<string, unknown>)[key] = value
      }
    }
  }

  stopInterval(): void {
    if (this.interval) {
      this.context.scheduler.remove(this.interval)
      this.interval = null
    }
  }

  stopTimeout(): void {
    if (this.timeoutId != null) {
      this.context.scheduler.remove(this.timeoutId)
      this.timeoutId = null
    }
  }

  shouldKeepHealthBarVisible(): boolean {
    if (isTeamHealthBarRestricted(this)) return false
    const showEntityBars = Boolean(this.context.map.debugEntityBarsVisible)
    const showForHeroTeam = isHeroTeamUnit(this) && this.hitPoints < this.totalHitPoints
    const isHeroUnit = this.context.controls?.heroUnit?.label === this.label
    return Boolean(
      this.family === FAMILY_TYPES.unit && (showEntityBars || showForHeroTeam) && !isHeroUnit && !this.isDead && !this.isDestroyed
    )
  }

  shouldKeepEnergyBarVisible(): boolean {
    const showEntityBars = Boolean(this.context.map.debugEntityBarsVisible)
    const isHeroUnit = this.context.controls?.heroUnit?.label === this.label
    return Boolean(this.family === FAMILY_TYPES.unit && showEntityBars && !isHeroUnit && !this.isDead && !this.isDestroyed)
  }

  drawHealthBar(): void {
    drawInstanceHealthBar(this)
  }

  drawEnergyBar(): void {
    drawInstanceEnergyBar(this)
  }

  drawHeroPowerBar(ratio: number): void {
    drawInstanceHeroPowerBar(this, ratio)
  }

  removeHealthBar(): void {
    removeInstanceHudBar(this, LABEL_TYPES.healthBar)
  }

  removeEnergyBar(): void {
    removeInstanceHudBar(this, LABEL_TYPES.energyBar)
  }

  removeHeroPowerBar(): void {
    removeInstanceHudBar(this, LABEL_TYPES.powerBar)
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
  // represent the sampled ground height immediately. Never touches this.x/y or zIndex.
  applyReliefLift(level: number): void {
    this.unitView.update(this.getVisualState(level))
  }

  getVisualState(level?: number): UnitVisualState {
    return unitVisualState(this, getEntitySpaceMapLike(this, this.context.map), level)
  }

  syncVisualState(): void {
    this.unitView.update(this.getVisualState())
  }

  isVisualAnimationPlaying(): boolean {
    return this.unitView.isAnimationPlaying()
  }

  playVisualAnimation(): void {
    this.unitView.playAnimation()
  }

  stopVisualAnimation(): void {
    this.unitView.stopAnimation()
  }

  syncAppearanceLayers(sheet: string) {
    const visualSheet =
      sheet === SHEET_TYPES.standing && this.currentSheet === SHEET_TYPES.sitting ? SHEET_TYPES.sitting : sheet
    syncUnitAppearanceLayers(this, visualSheet)
  }

  setTextures(sheet: string) {
    sheet = getUnitRestVisualSheet(this, sheet)
    this.unitView.setAction(sheet)
    this.syncVisualState()
  }

  applyOwnerColorToSprite() {
    applyUnitOwnerColorToSprite(this)
  }

  pause() {
    this.unitView.pause()
  }

  resume() {
    this.unitView.resume()
  }

  select() {
    if (this.selected) return
    this.selected = true
    this.unitView.setSelected(true)
    this.syncVisualState()
    const {
      context: { menu, player },
    } = this
    canUpdateMinimap(this, player) && menu.isMiniMapActive?.() !== false && menu.updatePlayerMiniMapEvt?.(this.owner)
  }

  unselect() {
    if (!this.selected) return
    this.selected = false
    this.unitView.setSelected(false)
    this.syncVisualState()
    const {
      context: { menu, player },
    } = this
    canUpdateMinimap(this, player) && menu.isMiniMapActive?.() !== false && menu.updatePlayerMiniMapEvt?.(this.owner)
  }

  hasPath() {
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
    this.unitView.setAnimationLoop(this.loop ?? true)
    this.setTextures(SHEET_TYPES.walking)
    this.inactif = false
    this.path = path
    const runImmediate = !this.isMovingStep && !this.exploringForAutonomy
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

  getActionCondition(
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

  affectNewDest() {
    return this.unitMovement.affectNewDest()
  }

  isUnitAtDest(action: string | null | undefined, dest: RuntimeEntity | RuntimeCell | null | undefined) {
    return this.unitMovement.isUnitAtDest(action, dest)
  }

  destHasMoved() {
    return this.unitMovement.destHasMoved()
  }

  moveToPath() {
    return this.unitMovement.moveToPath()
  }

  step(): void {
    if (this.isMovingStep) return
    this.isMovingStep = true
    const beforeX = this.x
    const beforeY = this.y
    updateUnitEnergy(this)
    try {
      if (resumeEnergyWaitIfReady(this)) {
        watchBanditStep(this, beforeX, beforeY)
        return
      }
      if (this.hitPoints <= 0) this.die()
      else if (this.hasPath()) this.moveToPath()
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

  startInterval(callback: () => void, time: number, immediate = true, name = 'unit.interval') {
    if (this.isDead) {
      return
    }
    this.stopInterval()
    this.interval = this.context.scheduler.add(
      () => {
        if (!isUnitSuspended(this)) callback()
      },
      time,
      name
    )
    if (immediate && !isUnitSuspended(this)) callback()
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

  die() {
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

  sendToTin(target: RuntimeEntity, immediate = false) {
    return this.unitCommands.sendToTin(target, immediate)
  }

  sendToIron(target: RuntimeEntity, immediate = false) {
    return this.unitCommands.sendToIron(target, immediate)
  }

  setDefaultInterface(element: HTMLElement, data: UnitConfig, options?: EntityInfoRenderOptions) {
    this.unitInterface.setDefaultInterface(element, data, options)
  }

  destroy(options?: Parameters<Container['destroy']>[0]): void {
    this.unitView.unmount()
    this.displayObject.destroy(options)
  }
}
