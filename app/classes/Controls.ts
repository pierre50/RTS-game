import { Container, Graphics } from 'pixi.js'
import { getReliefOffset, isometricToCartesian } from '../lib'
import { CameraController } from '../controllers/CameraController'
import { BuildingPlacer } from '../controllers/BuildingPlacer'
import { RallyPointController } from '../controllers/RallyPointController'
import { HeroController } from '../controllers/HeroController'
import { HeroInteractionController } from '../controllers/HeroInteractionController'
import { GamepadHeroInput } from '../controllers/GamepadHeroInput'
import { TouchInputController, type TouchInteraction } from '../controllers/TouchInputController'
import { PointerInputController, type PointerPageEvent } from '../controllers/PointerInputController'
import type { ControlBindingAction } from '../lib/settings'
import { setHeroGameCursorEnabled } from '../lib/heroCursor'
import type { HeroEquippedItem } from '../lib/heroTools'
import type { AudibleInstanceLike, ControlsLike, GameContextLike } from '../types/context'
import type { PlaceableBuildingConfig, RuntimeEntity, UnitEntity } from '../types/entities'
import type { RuntimeCell } from '../types/map'
import type { Bounds } from '../types/geometry'
import {
  handleControlsEscapeKey,
  handleControlsKeyDown,
  handleControlsKeyUp,
  panControlsCameraWithArrowKeys,
} from './ControlsKeyboard'

type PointerPoint = { x: number; y: number }
type TickerLike = { elapsedMS?: number; deltaMS?: number; deltaTime: number }
type AudibleEntity = AudibleInstanceLike & { x: number; y: number }
const MAX_CAMERA_FRAME_SCALE = 3
const TARGET_FRAME_MS = 1000 / 60

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
  rallyPointController: RallyPointController
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
    this.rallyPointController = new RallyPointController(this)

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
    const hero = this.heroUnit
    if (!hero) return null
    return { x: hero.x, y: hero.y + getReliefOffset(hero) }
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
    const { zoom, offsetX, offsetY } = this.getViewportMetrics()
    const rect = this.context.gamebox.getBoundingClientRect()
    const scaleX = this.context.app.screen.width / rect.width
    const scaleY = this.context.app.screen.height / rect.height
    const rendererX = (x - rect.left) * scaleX
    const rendererY = (y - rect.top) * scaleY
    return {
      x: (rendererX - offsetX) / zoom,
      y: (rendererY - offsetY) / zoom,
    }
  }

  localToScreen(x: number, y: number): { x: number; y: number } {
    const { zoom, offsetX, offsetY } = this.getViewportMetrics()
    const rect = this.context.gamebox.getBoundingClientRect()
    const scaleX = this.context.app.screen.width / rect.width
    const scaleY = this.context.app.screen.height / rect.height
    return {
      x: rect.left + (offsetX + x * zoom) / scaleX,
      y: rect.top + (offsetY + y * zoom) / scaleY,
    }
  }

  isInteractionBlocked(): boolean {
    return Boolean(
      this.context.devConsoleOpen ||
        this.context.paused ||
        this.context.defeat
    )
  }

  isInGameMenuOpen(): boolean {
    const menu = this.context.menu
    return Boolean(
      this.context.devConsoleOpen ||
        this.context.paused ||
        this.context.defeat ||
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
    return handleControlsEscapeKey(this, evt)
  }

  onKeyDown(evt: KeyboardEvent): void {
    handleControlsKeyDown(this, evt)
  }

  onKeyUp(evt: KeyboardEvent): void {
    handleControlsKeyUp(this, evt)
  }

  onTick(ticker: TickerLike): void {
    setHeroGameCursorEnabled(this.isHeroControlActive() && !this.isInGameMenuOpen())
    const gameFrameScale = (ticker.deltaMS ?? ticker.deltaTime * TARGET_FRAME_MS) / TARGET_FRAME_MS
    if (this.isInteractionBlocked()) {
      this.heroController.updateCriticalHealthEffects(TARGET_FRAME_MS * gameFrameScale, false)
      this.heroController.updateOcclusionFade(TARGET_FRAME_MS * gameFrameScale, false)
      this.cancelActiveInteraction()
      return
    }

    const frameScale = Math.min(
      (ticker.elapsedMS ?? ticker.deltaTime * TARGET_FRAME_MS) / TARGET_FRAME_MS,
      MAX_CAMERA_FRAME_SCALE
    )

    if (this.isHeroControlActive()) {
      this.gamepadInput.update()
      this.heroController.update(gameFrameScale)
      if (this.freeCameraActive) {
        this.panCameraWithArrowKeys(frameScale)
      } else {
        const cameraCenter = this.getHeroCameraCenter()
        if (cameraCenter) this.cameraController.set(cameraCenter.x, cameraCenter.y, false, false)
      }
      if (this.mouseBuilding || this.rallyPointController.active) {
        this.mouseBuilding ? this.buildingPlacer.handleMouseMove() : this.rallyPointController.handleMouseMove()
      }
      return
    }

    this.heroController.updateCriticalHealthEffects(TARGET_FRAME_MS * gameFrameScale, false)
    this.heroController.updateOcclusionFade(TARGET_FRAME_MS * gameFrameScale, false)
    this.cameraController.updateMouseMove(frameScale)
    this.panCameraWithArrowKeys(frameScale)
  }

  panCameraWithArrowKeys(frameScale: number): void {
    panControlsCameraWithArrowKeys(this, frameScale)
  }

  onTouchStart(evt: TouchEvent): void {
    this.touchInputController.onTouchStart(evt)
  }

  onTouchMove(evt: TouchEvent): void {
    this.touchInputController.onTouchMove(evt)
  }

  onTouchEnd(evt: TouchEvent): void {
    this.touchInputController.onTouchEnd(evt)
  }

  onMouseDown(evt: PointerPageEvent): void {
    this.pointerInputController.onMouseDown(evt)
  }

  onMouseMove(evt: PointerPageEvent): void {
    this.pointerInputController.onMouseMove(evt)
  }

  onWheel(evt: WheelEvent): void {
    this.pointerInputController.onWheel(evt)
  }

  onContextMenu(evt: MouseEvent): void {
    this.pointerInputController.onContextMenu(evt)
  }

  onMouseUp(evt: PointerPageEvent): void {
    this.pointerInputController.onMouseUp(evt)
  }

  getWorldPointUnderCursor(): PointerPoint {
    const {
      context: { map },
    } = this
    const pointer = this.screenToLocal(this.mouse.x, this.mouse.y)
    return {
      x: pointer.x - map.x,
      y: pointer.y - map.y,
    }
  }

  getCellUnderCursor(): RuntimeCell | null {
    const {
      context: { map },
    } = this
    const pointer = this.getWorldPointUnderCursor()
    const pos = isometricToCartesian(pointer.x, pointer.y)
    const i = Math.min(Math.max(pos[0], 0), map.size)
    const j = Math.min(Math.max(pos[1], 0), map.size)
    return map.grid[i]?.[j] || null
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
    this.cameraController.move(dir, moveSpeed, isSpeedDivided, deltaScale)
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
    return this.heroController.isActive()
  }

  setFreeCamera(enabled: boolean): void {
    this.freeCameraActive = enabled
    this.keysPressed = {}
    this.keyPressedCount = 0
    this.keySpeed = 0
    if (!enabled && this.heroUnit) {
      const cameraCenter = this.getHeroCameraCenter()
      if (cameraCenter) this.cameraController.set(cameraCenter.x, cameraCenter.y)
    }
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
    this.rallyPointController.cancel()
  }

  instanceInCamera(instance: { x: number; y: number }, bounds?: Bounds): boolean {
    return this.cameraController.instanceInCamera(instance, bounds)
  }

  instanceIsAudible(instance: AudibleEntity): boolean {
    const {
      context: { map },
    } = this

    if (!this.instanceInCamera(instance)) return false
    if (map.revealEverything) return true
    if (instance.owner?.isPlayed || instance.owner?.owner?.isPlayed) return true

    return Boolean(instance.visible || instance.owner?.visible || instance.target?.visible)
  }

  getCellOnCamera(callback: (cell: RuntimeCell) => void): void {
    this.cameraController.getCellOnCamera(callback)
  }

  updateVisibleCells(): void {
    this.cameraController.updateVisibleCells()
  }

  init(): void {
    const {
      context: { player, map },
    } = this

    if (this.heroController.initFromPlayerStart()) return

    if (player?.buildings?.length) {
      this.setCamera(player.buildings[0].x, player.buildings[0].y)
    } else if (player?.units?.length) {
      this.setCamera(player.units[0].x, player.units[0].y)
    } else {
      this.setCamera(map.size / 2, map.size / 2)
    }
  }

  setCamera(x: number, y: number, direct?: boolean): void {
    if (this.isInteractionBlocked()) return
    this.cameraController.set(x, y, direct)
  }
}
