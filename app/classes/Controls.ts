import { Container, Graphics } from 'pixi.js'
import { BuildingPlacer } from '../controllers/BuildingPlacer'
import { CameraController } from '../controllers/CameraController'
import { GamepadHeroInput } from '../controllers/GamepadHeroInput'
import { HeroController } from '../controllers/HeroController'
import { HeroInteractionController } from '../controllers/HeroInteractionController'
import { PointerInputController, type PointerPageEvent } from '../controllers/PointerInputController'
import { TouchInputController, type TouchInteraction } from '../controllers/TouchInputController'
import type { ControlBindingAction } from '../lib/audio/settings'
import type { HeroEquippedItem } from '../lib/hero/heroTools'
import type { AudibleInstanceLike, ControlsLike, GameContextLike } from '../types/context'
import type { PlaceableBuildingConfig, RuntimeEntity, UnitEntity } from '../types/entities'
import type { Bounds } from '../types/geometry'
import type { RuntimeCell } from '../types/map'
import type { TickerLike } from './ControlsFrame'
import { onTick as runOnTick } from './ControlsFrame'
import {
  getCellUnderCursor as runGetCellUnderCursor,
  getHeroCameraCenter as runGetHeroCameraCenter,
  getMapPointUnderCursor as runGetMapPointUnderCursor,
  getWorldPointUnderCursor as runGetWorldPointUnderCursor,
  init as runInit,
  instanceInCamera as runInstanceInCamera,
  instanceIsAudible as runInstanceIsAudible,
  localToScreen as runLocalToScreen,
  screenToLocal as runScreenToLocal,
} from './ControlsGeometry'
import {
  captureControlsMovement,
  handleControlsEscapeKey,
  handleControlsKeyDown,
  handleControlsKeyUp,
  panControlsCameraWithArrowKeys,
  restoreControlsMovement,
  type HeldMovementKeys,
} from './ControlsKeyboard'
type PointerPoint = { x: number; y: number }
type AudibleEntity = AudibleInstanceLike & { x: number; y: number }

export default class Controls extends Container implements ControlsLike {
  context: GameContextLike
  mouse: { x: number; y: number; prevent: boolean }
  cameraController: CameraController
  mouseHoldTimeout: ReturnType<typeof setTimeout> | undefined
  keysPressed: Partial<Record<ControlBindingAction, boolean>>
  keyActionsByCode: Partial<Record<string, ControlBindingAction>>
  keyPressedCount: number
  keySpeed: number
  heroDirectionLockActive: boolean
  shiftKeyActive: boolean
  freeCameraActive: boolean
  heroController: HeroController
  heroInteractionController: HeroInteractionController
  gamepadInput: GamepadHeroInput
  touchInputController: TouchInputController
  pointerInputController: PointerInputController
  mouseBuilding: ControlsLike['mouseBuilding']
  mouseTouch: PointerPoint | null | undefined
  mouseDrag: boolean
  touchInteraction: TouchInteraction | null
  touchPanActive: boolean
  ignoreMouseEventsUntil: number
  suppressContextMenuUntil: number
  minimapRectangle: Graphics
  buildingPlacer: BuildingPlacer
  runtimeInputEnabled: boolean
  _onDocMouseMove: (evt: MouseEvent) => void
  _onDocMouseOut: () => void
  _onKeyDown: (evt: KeyboardEvent) => void
  _onKeyUp: (evt: KeyboardEvent) => void
  _onTouchStart: (evt: TouchEvent) => void
  _onTouchEnd: (evt: TouchEvent) => void
  _onTouchMove: (evt: TouchEvent) => void
  _onMouseMove: (evt: MouseEvent) => void
  _onMouseDown: (evt: MouseEvent) => void
  _onMouseUp: (evt: MouseEvent) => void
  _onWheel: (evt: WheelEvent) => void
  _onContextMenu: (evt: MouseEvent) => void
  _onTouchCancel: () => void
  _onWindowBlur: () => void
  _onTick: (ticker: TickerLike) => void

  constructor(context: GameContextLike) {
    super()

    this.context = context

    const { map, gamebox } = context

    this.sortableChildren = true

    this.mouse = {
      x: 0,
      y: 0,
      prevent: false,
    }

    this.cameraController = new CameraController(context)
    this.setCamera(Math.floor(map.size / 2), Math.floor(map.size / 2))

    this.mouseHoldTimeout = undefined
    this.keysPressed = {}
    this.keyActionsByCode = {}
    this.keyPressedCount = 0
    this.keySpeed = 0
    this.heroDirectionLockActive = false
    this.shiftKeyActive = false
    this.freeCameraActive = false
    this.heroController = new HeroController(this)
    this.heroInteractionController = new HeroInteractionController(this)
    this.gamepadInput = new GamepadHeroInput(this)
    this.touchInputController = new TouchInputController(this)
    this.pointerInputController = new PointerInputController(this)
    this.eventMode = 'auto'
    this.mouseTouch = undefined
    this.mouseDrag = false
    this.touchInteraction = null
    this.touchPanActive = false
    this.ignoreMouseEventsUntil = 0
    this.suppressContextMenuUntil = 0
    this.minimapRectangle = new Graphics()
    this.addChild(this.minimapRectangle)

    this.buildingPlacer = new BuildingPlacer(this)
    this.runtimeInputEnabled = true

    this._onDocMouseMove = (evt: MouseEvent) => this.moveCameraWithMouse(evt)
    this._onDocMouseOut = () => this.stopMouseCameraMove()
    this._onKeyDown = (evt: KeyboardEvent) => this.onKeyDown(evt)
    this._onKeyUp = (evt: KeyboardEvent) => this.onKeyUp(evt)
    this._onTouchStart = (evt: TouchEvent) => this.onTouchStart(evt)
    this._onTouchEnd = (evt: TouchEvent) => this.onTouchEnd(evt)
    this._onTouchMove = (evt: TouchEvent) => this.onTouchMove(evt)
    this._onMouseMove = (evt: MouseEvent) => this.onMouseMove(evt)
    this._onMouseDown = (evt: MouseEvent) => this.onMouseDown(evt)
    this._onMouseUp = (evt: MouseEvent) => this.onMouseUp(evt)
    this._onWheel = (evt: WheelEvent) => this.onWheel(evt)
    this._onContextMenu = (evt: MouseEvent) => this.onContextMenu(evt)
    this._onTouchCancel = () => this.cancelActiveInteraction()
    this._onWindowBlur = () => this.cancelActiveInteraction()
    this._onTick = (ticker: TickerLike) => this.onTick(ticker)

    document.addEventListener('mousemove', this._onDocMouseMove)
    document.addEventListener('mouseout', this._onDocMouseOut)
    document.addEventListener('keydown', this._onKeyDown)
    document.addEventListener('keyup', this._onKeyUp)
    gamebox.addEventListener('touchstart', this._onTouchStart)
    gamebox.addEventListener('touchend', this._onTouchEnd)
    gamebox.addEventListener('touchmove', this._onTouchMove)
    gamebox.addEventListener('touchcancel', this._onTouchCancel)
    gamebox.addEventListener('mousemove', this._onMouseMove)
    gamebox.addEventListener('mousedown', this._onMouseDown)
    gamebox.addEventListener('wheel', this._onWheel, { passive: false })
    gamebox.addEventListener('contextmenu', this._onContextMenu, true)
    document.addEventListener('contextmenu', this._onContextMenu, true)
    document.addEventListener('mouseup', this._onMouseUp)
    window.addEventListener('blur', this._onWindowBlur)
    context.app.ticker.add(this._onTick)
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    this.buildingPlacer.removeMouseBuilding()
    const {
      context: { gamebox },
    } = this

    document.removeEventListener('mousemove', this._onDocMouseMove)
    document.removeEventListener('mouseout', this._onDocMouseOut)
    document.removeEventListener('keydown', this._onKeyDown)
    document.removeEventListener('keyup', this._onKeyUp)
    gamebox.removeEventListener('touchstart', this._onTouchStart)
    gamebox.removeEventListener('touchend', this._onTouchEnd)
    gamebox.removeEventListener('touchmove', this._onTouchMove)
    gamebox.removeEventListener('touchcancel', this._onTouchCancel)
    gamebox.removeEventListener('mousemove', this._onMouseMove)
    gamebox.removeEventListener('mousedown', this._onMouseDown)
    gamebox.removeEventListener('wheel', this._onWheel)
    gamebox.removeEventListener('contextmenu', this._onContextMenu, true)
    document.removeEventListener('contextmenu', this._onContextMenu, true)
    document.removeEventListener('mouseup', this._onMouseUp)
    window.removeEventListener('blur', this._onWindowBlur)
    this.context.app.ticker.remove(this._onTick)
    this.cancelActiveInteraction()
    this.heroController.destroy()
    super.destroy(options ?? undefined)
  }

  get camera(): { x: number; y: number } {
    return this.cameraController.camera
  }

  get heroUnit(): UnitEntity | null {
    return this.heroController.heroUnit
  }

  get equippedItem(): HeroEquippedItem | null {
    return this.heroController.equippedItem
  }

  get equippedTool(): HeroEquippedItem | null {
    return this.equippedItem
  }

  get heroActionHeld(): boolean {
    return this.heroController.isHeroActionHeld()
  }

  getHeroCameraCenter(): { x: number; y: number } | null {
    return runGetHeroCameraCenter(this)
  }

  focusHeroCamera(): void {
    const center = this.getHeroCameraCenter()
    if (center) this.cameraController.set(center.x, center.y)
  }

  getViewportMetrics(): {
    zoom: number
    offsetX: number
    offsetY: number
    visibleLeft: number
    visibleTop: number
    visibleWidth: number
    visibleHeight: number
  } {
    return this.cameraController.getViewportRect()
  }

  screenToLocal(x: number, y: number): { x: number; y: number } {
    return runScreenToLocal(this, x, y)
  }

  localToScreen(x: number, y: number): { x: number; y: number } {
    return runLocalToScreen(this, x, y)
  }

  isInteractionBlocked(): boolean {
    return Boolean(
      !this.runtimeInputEnabled ||
        this.context.devConsoleOpen ||
        this.context.paused ||
        this.context.defeat ||
        this.context.timeSkip?.active
    )
  }

  isInGameMenuOpen(): boolean {
    const menu = this.context.menu
    return Boolean(
      this.context.devConsoleOpen ||
        this.context.paused ||
        this.context.defeat ||
        this.context.timeSkip?.active ||
        menu?.isInventoryOpen?.() ||
        menu?.isNpcOrdersOpen?.() ||
        menu?.isHeroBuildingMenuOpen?.() ||
        document.querySelector?.('.modal')
    )
  }

  isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false
    return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
  }

  handleEscapeKey(evt: KeyboardEvent): boolean {
    if (!this.runtimeInputEnabled) return false
    return handleControlsEscapeKey(this, evt)
  }

  onKeyDown(evt: KeyboardEvent): void {
    if (!this.runtimeInputEnabled) return
    handleControlsKeyDown(this, evt)
  }

  onKeyUp(evt: KeyboardEvent): void {
    if (!this.runtimeInputEnabled) return
    handleControlsKeyUp(this, evt)
  }

  onTick(ticker: TickerLike): void {
    return runOnTick(this, ticker)
  }

  panCameraWithArrowKeys(frameScale: number): void {
    panControlsCameraWithArrowKeys(this, frameScale)
  }

  onTouchStart(evt: TouchEvent): void {
    if (!this.runtimeInputEnabled) return
    this.touchInputController.onTouchStart(evt)
  }

  onTouchMove(evt: TouchEvent): void {
    if (!this.runtimeInputEnabled) return
    this.touchInputController.onTouchMove(evt)
  }

  onTouchEnd(evt: TouchEvent): void {
    if (!this.runtimeInputEnabled) return
    this.touchInputController.onTouchEnd(evt)
  }

  onMouseDown(evt: PointerPageEvent): void {
    if (!this.runtimeInputEnabled) return
    this.pointerInputController.onMouseDown(evt)
  }

  onMouseMove(evt: PointerPageEvent): void {
    if (!this.runtimeInputEnabled) return
    this.pointerInputController.onMouseMove(evt)
  }

  onWheel(evt: WheelEvent): void {
    if (!this.runtimeInputEnabled) return
    this.pointerInputController.onWheel(evt)
  }

  onContextMenu(evt: MouseEvent): void {
    if (!this.runtimeInputEnabled) return
    this.pointerInputController.onContextMenu(evt)
  }

  onMouseUp(evt: PointerPageEvent): void {
    if (!this.runtimeInputEnabled) return
    this.pointerInputController.onMouseUp(evt)
  }

  getWorldPointUnderCursor(): PointerPoint {
    return runGetWorldPointUnderCursor(this)
  }

  getMapPointUnderCursor(): PointerPoint {
    return runGetMapPointUnderCursor(this)
  }

  getCellUnderCursor(): RuntimeCell | null {
    return runGetCellUnderCursor(this)
  }

  getFacingEntityTarget(): RuntimeEntity | null {
    return this.heroInteractionController.getFacingEntityTarget()
  }

  closeAnyHeroPanel(): boolean {
    return this.heroInteractionController.closeAnyHeroPanel()
  }

  openHeroEntityInteraction(target: RuntimeEntity | null = this.getFacingEntityTarget()): boolean {
    return this.heroInteractionController.openHeroEntityInteraction(target)
  }

  getGamepadMoveVector(): { dx: number; dy: number } {
    return this.gamepadInput.moveVector
  }

  isHeroDirectionLockActive(): boolean {
    return this.heroDirectionLockActive || this.gamepadInput.directionLockActive
  }

  isHeroStealthMode(): boolean {
    return this.shiftKeyActive
  }

  isMouseInApp(evt: PointerPageEvent): boolean {
    return this.pointerInputController.isMouseInApp(evt)
  }

  shouldIgnoreCompatibilityMouseEvent(evt: PointerPageEvent): boolean {
    return this.touchInputController.shouldIgnoreCompatibilityMouseEvent(evt)
  }

  removeMouseBuilding(): void {
    return this.buildingPlacer.removeMouseBuilding()
  }

  setMouseBuilding(building: PlaceableBuildingConfig): void {
    return this.buildingPlacer.setMouseBuilding(building)
  }

  moveCamera(dir: string, moveSpeed: number, isSpeedDivided: boolean, deltaScale = 1): void {
    if (this.isInteractionBlocked()) return
    this.cameraController.move(dir, moveSpeed, isSpeedDivided, deltaScale, !this.freeCameraActive)
  }

  moveCameraWithMouse(evt: MouseEvent): void {
    if (this.isInteractionBlocked()) {
      this.stopMouseCameraMove()
      return
    }
    if (evt.target instanceof Element && evt.target.closest('button, .topbar-options-menu, .action-menu')) {
      this.cameraController.stopMouseMove()
      return
    }
    this.cameraController.moveWithMouse(evt)
  }

  stopMouseCameraMove(): void {
    this.cameraController.stopMouseMove()
  }

  stopKeyboardMove(): void {
    this.keysPressed = {}
    this.keyActionsByCode = {}
    this.keyPressedCount = 0
    this.heroDirectionLockActive = false
    this.keySpeed = 0
    this.shiftKeyActive = false
    this.heroController.stopKeyboardMove()
  }

  isHeroControlActive(): boolean {
    return !this.context.timeSkip?.active && this.heroController.isActive()
  }

  setFreeCamera(enabled: boolean): void {
    this.freeCameraActive = enabled
    this.keysPressed = {}
    this.keyPressedCount = 0
    this.keySpeed = 0
    if (!enabled) this.focusHeroCamera()
  }

  setRuntimeInputEnabled(enabled: boolean): void {
    if (this.runtimeInputEnabled === enabled) return
    this.runtimeInputEnabled = enabled
    this.eventMode = enabled ? 'auto' : 'none'
    this.renderable = enabled
    if (!enabled) this.cancelActiveInteraction()
  }

  captureMovementInput(): () => HeldMovementKeys {
    return captureControlsMovement(this)
  }

  restoreMovementInput(held: HeldMovementKeys): void {
    restoreControlsMovement(this, held)
  }

  setEquippedItem(item: HeroEquippedItem | null): void {
    this.heroController.setEquippedItem(item)
  }

  setEquippedTool(tool: HeroEquippedItem | null): void {
    this.setEquippedItem(tool)
  }

  beginNpcGoTo(npcs: UnitEntity[]): void {
    this.heroController.beginGoToPicking(npcs)
  }

  cancelActiveInteraction(): void {
    this.stopKeyboardMove()
    this.stopMouseCameraMove()
    this.touchInputController.cancel()
    this.heroController.cancelActiveInteraction()
    this.mouse.prevent = false
  }

  instanceInCamera(instance: { x: number; y: number }, bounds?: Bounds): boolean {
    return runInstanceInCamera(this, instance, bounds)
  }

  instanceIsAudible(instance: AudibleEntity): boolean {
    return runInstanceIsAudible(this, instance)
  }

  getCellOnCamera(callback: (cell: RuntimeCell) => void): void {
    this.cameraController.getCellOnCamera(callback)
  }

  updateVisibleCells(): void {
    this.cameraController.updateVisibleCells(true)
  }

  init(): void {
    return runInit(this)
  }

  setCamera(x: number, y: number, direct?: boolean): void {
    if (this.isInteractionBlocked()) return
    this.cameraController.set(x, y, direct)
  }
}
