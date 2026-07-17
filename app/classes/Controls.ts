import { Container, Graphics } from 'pixi.js'
import { isometricToCartesian, pointsDistance } from '../lib'
import { CameraController } from '../controllers/CameraController'
import { BuildingPlacer } from '../controllers/BuildingPlacer'
import { SelectionManager } from '../controllers/SelectionManager'
import { RallyPointController } from '../controllers/RallyPointController'
import { HeroController } from '../controllers/HeroController'
import { getCameraZoom } from '../lib/settings'
import { hasRtsCommandableUnits } from '../lib/unitControl'
import { IS_MOBILE, TOUCH_DRAG_THRESHOLD } from '../constants'
import type { HeroTool } from '../lib/heroTools'
import type {
  AudibleInstanceLike,
  ControlPointerEvent,
  ControlsLike,
  GameContextLike,
  SelectionRectangle,
} from '../types/context'
import type { PlaceableBuildingConfig, RuntimeEntity, UnitEntity } from '../types/entities'
import type { RuntimeCell } from '../types/map'

type PointerPoint = { x: number; y: number }
type PointerPageEvent = ControlPointerEvent & {
  pageX: number
  pageY: number
  button?: number
  preventDefault?: () => void
}
type TouchInteraction = {
  mode: 'pan' | 'tap' | 'select'
  startX: number
  startY: number
  lastX: number
  lastY: number
  moved: boolean
}
type TickerLike = { elapsedMS?: number; deltaMS?: number; deltaTime: number }
type AudibleEntity = AudibleInstanceLike & { x: number; y: number }
const ARROW_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp'])
const KEYBOARD_CAMERA_INITIAL_SPEED = 7
const KEYBOARD_CAMERA_MAX_SPEED = 14
const KEYBOARD_CAMERA_ACCELERATION = 0.24
const MAX_CAMERA_FRAME_SCALE = 3
const TARGET_FRAME_MS = 1000 / 60
const COMPATIBILITY_MOUSE_EVENT_DELAY = 800

export default class Controls extends Container implements ControlsLike {
  context: GameContextLike
  mouse: { x: number; y: number; prevent: boolean }
  cameraController: CameraController
  mouseHoldTimeout: ReturnType<typeof setTimeout> | undefined
  keysPressed: Record<string, boolean>
  keyPressedCount: number
  keySpeed: number
  heroController: HeroController
  mouseBuilding: ControlsLike['mouseBuilding']
  mouseRectangle: SelectionRectangle | null | undefined
  mouseTouch: PointerPoint | null | undefined
  mouseDrag: boolean
  touchInteraction: TouchInteraction | null
  touchPanActive: boolean
  ignoreMouseEventsUntil: number
  lastClickedUnit: RuntimeEntity | null
  unitClickTimeout: ReturnType<typeof setTimeout> | null
  doubleClicked: boolean
  minimapRectangle: Graphics
  buildingPlacer: BuildingPlacer
  rallyPointController: RallyPointController
  selectionManager: SelectionManager
  pointerStart!: { x: number; y: number } | null
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
    this.keyPressedCount = 0
    this.keySpeed = 0
    this.heroController = new HeroController(this)
    this.eventMode = 'auto'
    this.mouseRectangle = undefined
    this.mouseTouch = undefined
    this.mouseDrag = false
    this.touchInteraction = null
    this.touchPanActive = false
    this.ignoreMouseEventsUntil = 0
    this.lastClickedUnit = null
    this.unitClickTimeout = null
    this.doubleClicked = false
    this.minimapRectangle = new Graphics()
    this.addChild(this.minimapRectangle)

    this.buildingPlacer = new BuildingPlacer(this)
    this.rallyPointController = new RallyPointController(this)
    this.selectionManager = new SelectionManager(this)

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
    this._onContextMenu = (evt: MouseEvent) => {
      if (this.isArpgActive()) evt.preventDefault()
    }
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
    gamebox.addEventListener('contextmenu', this._onContextMenu)
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
    gamebox.removeEventListener('contextmenu', this._onContextMenu)
    document.removeEventListener('mouseup', this._onMouseUp)
    window.removeEventListener('blur', this._onWindowBlur)
    this.context.app.ticker.remove(this._onTick)
    if (this.unitClickTimeout != null) clearTimeout(this.unitClickTimeout)
    this.cancelActiveInteraction()
    super.destroy(options ?? undefined)
  }

  get camera(): { x: number; y: number } {
    return this.cameraController.camera
  }

  get heroUnit(): UnitEntity | null {
    return this.heroController.heroUnit
  }

  get equippedTool(): HeroTool | null {
    return this.heroController.equippedTool
  }

  get heroActionHeld(): boolean {
    return this.heroController.mouseHeld
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
    const {
      context: { app },
    } = this
    const zoom = getCameraZoom()
    const offsetX = (app.screen.width * (1 - zoom)) / 2
    const offsetY = (app.screen.height * (1 - zoom)) / 2

    return {
      zoom,
      offsetX,
      offsetY,
      visibleLeft: this.camera.x - offsetX / zoom,
      visibleTop: this.camera.y - offsetY / zoom,
      visibleWidth: app.screen.width / zoom,
      visibleHeight: app.screen.height / zoom,
    }
  }

  screenToLocal(x: number, y: number): { x: number; y: number } {
    const { zoom, offsetX, offsetY } = this.getViewportMetrics()
    return {
      x: (x - offsetX) / zoom,
      y: (y - offsetY) / zoom,
    }
  }

  localToScreen(x: number, y: number): { x: number; y: number } {
    const { zoom, offsetX, offsetY } = this.getViewportMetrics()
    return {
      x: offsetX + x * zoom,
      y: offsetY + y * zoom,
    }
  }

  isInteractionBlocked(): boolean {
    return Boolean(this.context.devConsoleOpen || this.context.paused || this.context.victory || this.context.defeat)
  }

  isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false
    return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
  }

  onKeyDown(evt: KeyboardEvent): void {
    if (this.isInteractionBlocked() || this.isEditableTarget(evt.target)) return
    if (evt.repeat && !ARROW_KEYS.has(evt.key)) return
    if (evt.key === 'Escape' && this.buildingPlacer.cancelWallDraft()) {
      evt.preventDefault()
      return
    }
    if (evt.key === 'Escape' && this.rallyPointController.active) {
      evt.preventDefault()
      this.rallyPointController.cancel()
      return
    }
    if (evt.key === 'Escape' && this.isArpgActive() && this.context.menu?.isInventoryOpen?.()) {
      evt.preventDefault()
      this.context.menu.toggleInventory?.()
      return
    }

    if (evt.key === 'Delete' || evt.keyCode === 8) {
      const {
        context: { player },
      } = this
      for (const unit of [...player.selectedUnits]) {
        unit.die?.()
      }
      if (player.selectedBuilding) {
        player.selectedBuilding.die?.()
      }
      return
    }

    if (ARROW_KEYS.has(evt.key)) {
      if (!evt.repeat) {
        this.keysPressed[evt.key] = true
        this.keyPressedCount++
        if (this.keyPressedCount === 1) {
          this.keySpeed = KEYBOARD_CAMERA_INITIAL_SPEED
        }
      }
      return
    }

    const key = evt.key.toLowerCase()
    if (this.heroController.handleKeyDown(key)) return

    this.context.menu?.handleHotkey?.(key)
  }

  onKeyUp(evt: KeyboardEvent): void {
    if (this.isInteractionBlocked()) {
      this.stopKeyboardMove()
      return
    }

    const key = evt.key.toLowerCase()
    this.heroController.handleKeyUp(key)

    if (!ARROW_KEYS.has(evt.key)) return

    if (!evt.repeat && this.keysPressed[evt.key]) {
      delete this.keysPressed[evt.key]
      this.keyPressedCount--
    }
    if (this.keyPressedCount <= 0) {
      this.keyPressedCount = 0
      this.keySpeed = 0
    }
  }

  onTick(ticker: TickerLike): void {
    if (this.isInteractionBlocked()) {
      this.cancelActiveInteraction()
      return
    }

    const frameScale = Math.min(
      (ticker.elapsedMS ?? ticker.deltaTime * TARGET_FRAME_MS) / TARGET_FRAME_MS,
      MAX_CAMERA_FRAME_SCALE
    )
    const gameFrameScale = (ticker.deltaMS ?? ticker.deltaTime * TARGET_FRAME_MS) / TARGET_FRAME_MS

    if (this.isArpgActive()) {
      this.heroController.update(gameFrameScale)
      this.cameraController.set(this.heroUnit!.x, this.heroUnit!.y)
      return
    }

    this.cameraController.updateMouseMove(frameScale)

    if (this.keyPressedCount > 0) {
      const double = this.keyPressedCount > 1
      if (this.keySpeed < KEYBOARD_CAMERA_MAX_SPEED) {
        this.keySpeed = Math.min(KEYBOARD_CAMERA_MAX_SPEED, this.keySpeed + frameScale * KEYBOARD_CAMERA_ACCELERATION)
      }
      if (this.keysPressed['ArrowLeft']) this.moveCamera('left', this.keySpeed, double, frameScale)
      if (this.keysPressed['ArrowUp']) this.moveCamera('up', this.keySpeed, double, frameScale)
      if (this.keysPressed['ArrowDown']) this.moveCamera('down', this.keySpeed, double, frameScale)
      if (this.keysPressed['ArrowRight']) this.moveCamera('right', this.keySpeed, double, frameScale)
    }
  }

  onTouchStart(evt: TouchEvent): void {
    if (this.isInteractionBlocked()) return
    this.ignoreMouseEventsUntil = performance.now() + COMPATIBILITY_MOUSE_EVENT_DELAY

    const touch = evt.touches[0]
    if (evt.touches.length >= 2) {
      if (this.mouseRectangle) {
        this.selectionManager.handleMouseUp()
      } else {
        this.pointerStart = null
      }
      this.touchInteraction = {
        mode: 'pan',
        startX: touch.pageX,
        startY: touch.pageY,
        lastX: touch.pageX,
        lastY: touch.pageY,
        moved: false,
      }
      this.touchPanActive = true
      this.mouseDrag = false
      this.mouseTouch = { x: touch.pageX, y: touch.pageY }
    } else {
      this.mouse.x = touch.pageX
      this.mouse.y = touch.pageY
      if (!this.isMouseInApp(touch)) return

      this.mouseDrag = false
      this.touchInteraction = {
        mode: this.mouseBuilding || this.rallyPointController.active || !IS_MOBILE ? 'tap' : 'select',
        startX: touch.pageX,
        startY: touch.pageY,
        lastX: touch.pageX,
        lastY: touch.pageY,
        moved: false,
      }

      if (this.mouseBuilding || this.rallyPointController.active) {
        this.pointerStart = null
        this.mouseBuilding ? this.buildingPlacer.handleMouseMove() : this.rallyPointController.handleMouseMove()
        return
      }

      if (!IS_MOBILE) {
        this.onMouseDown(touch)
        return
      }
      this.pointerStart = { x: this.mouse.x, y: this.mouse.y }
    }
  }

  onTouchMove(evt: TouchEvent): void {
    if (this.isInteractionBlocked()) return

    const touch = evt.touches[0]
    if (this.touchPanActive) {
      this.mouse.x = touch.pageX
      this.mouse.y = touch.pageY

      if (this.mouseTouch) {
        const speedX = Math.abs(this.mouse.x - this.mouseTouch.x) * 2
        const speedY = Math.abs(this.mouse.y - this.mouseTouch.y) * 2
        if (this.mouse.x > this.mouseTouch.x) this.moveCamera('left', speedX, false)
        if (this.mouse.y > this.mouseTouch.y) this.moveCamera('up', speedY, false)
        if (this.mouse.y < this.mouseTouch.y) this.moveCamera('down', speedY, false)
        if (this.mouse.x < this.mouseTouch.x) this.moveCamera('right', speedX, false)
      }
      this.mouseTouch = { x: this.mouse.x, y: this.mouse.y }
      return
    }

    this.mouse.x = touch.pageX
    this.mouse.y = touch.pageY

    if (this.mouseBuilding || this.rallyPointController.active) {
      const interaction = this.touchInteraction
      const hasMoved =
        interaction &&
        pointsDistance(this.mouse.x, this.mouse.y, interaction.startX, interaction.startY) > TOUCH_DRAG_THRESHOLD
      if (hasMoved) {
        this.mouseDrag = true
        interaction.moved = true
      }
      this.mouseBuilding ? this.buildingPlacer.handleMouseMove() : this.rallyPointController.handleMouseMove()
      return
    }

    if (!this.touchInteraction) {
      this.onMouseMove(touch)
      return
    }

    const movedEnough =
      pointsDistance(this.mouse.x, this.mouse.y, this.touchInteraction.startX, this.touchInteraction.startY) >
      TOUCH_DRAG_THRESHOLD

    if (this.touchInteraction.mode === 'select') {
      if (movedEnough) {
        this.touchInteraction.moved = true
      }
      this.onMouseMove(touch)
    } else if (movedEnough) {
      this.touchInteraction.moved = true
      this.mouseDrag = true
      const speedX = Math.abs(this.mouse.x - this.touchInteraction.lastX) * 2
      const speedY = Math.abs(this.mouse.y - this.touchInteraction.lastY) * 2
      if (this.mouse.x > this.touchInteraction.lastX) this.moveCamera('left', speedX, false)
      if (this.mouse.y > this.touchInteraction.lastY) this.moveCamera('up', speedY, false)
      if (this.mouse.y < this.touchInteraction.lastY) this.moveCamera('down', speedY, false)
      if (this.mouse.x < this.touchInteraction.lastX) this.moveCamera('right', speedX, false)
    }

    this.touchInteraction.lastX = this.mouse.x
    this.touchInteraction.lastY = this.mouse.y
  }

  onTouchEnd(evt: TouchEvent): void {
    this.ignoreMouseEventsUntil = performance.now() + COMPATIBILITY_MOUSE_EVENT_DELAY
    const touch = evt.changedTouches[0]
    if (this.touchPanActive || this.touchInteraction?.mode === 'pan') {
      this.pointerStart = null
      this.mouseDrag = true
      if (evt.touches.length) {
        const remainingTouch = evt.touches[0]
        this.mouseTouch = { x: remainingTouch.pageX, y: remainingTouch.pageY }
        this.touchInteraction = {
          mode: 'pan',
          startX: remainingTouch.pageX,
          startY: remainingTouch.pageY,
          lastX: remainingTouch.pageX,
          lastY: remainingTouch.pageY,
          moved: true,
        }
        return
      }
      this.touchPanActive = false
      this.touchInteraction = null
      this.mouseTouch = null
      this.mouseDrag = false
      return
    }

    if (this.isInteractionBlocked()) {
      this.cancelActiveInteraction()
      return
    }

    if (evt.changedTouches.length === 1) {
      const mode = this.touchInteraction?.mode
      const moved = this.touchInteraction?.moved

      if (this.mouseBuilding || this.rallyPointController.active) {
        if (!moved) {
          this.onMouseUp(touch)
        }
      } else if (mode === 'select') {
        this.onMouseUp(touch)
      } else if (!moved) {
        this.onMouseUp(touch)
      } else {
        this.pointerStart = null
      }
    }
    this.touchInteraction = null
    this.mouseTouch = null
    this.mouseDrag = false
  }

  onMouseDown(evt: PointerPageEvent): void {
    if (this.shouldIgnoreCompatibilityMouseEvent(evt)) return
    if (this.isInteractionBlocked()) return

    this.mouse.x = evt.pageX
    this.mouse.y = evt.pageY
    if (!this.isMouseInApp(evt)) return

    if (this.isArpgActive() && evt.button === 0) {
      evt.preventDefault?.()
      this.heroController.handlePrimaryPointerDown()
      this.pointerStart = null
      this.mouse.prevent = true
      return
    }

    this.pointerStart = { x: this.mouse.x, y: this.mouse.y }
  }

  onMouseMove(evt: PointerPageEvent): void {
    if (this.shouldIgnoreCompatibilityMouseEvent(evt)) return
    this.mouse.x = evt.pageX
    this.mouse.y = evt.pageY

    if (this.isInteractionBlocked()) return

    if (this.mouseBuilding || this.rallyPointController.active) {
      this.mouseBuilding ? this.buildingPlacer.handleMouseMove() : this.rallyPointController.handleMouseMove()
      return
    }
    this.selectionManager.handleMouseMove()
  }

  onMouseUp(evt: PointerPageEvent): void {
    if (this.shouldIgnoreCompatibilityMouseEvent(evt)) return
    this.heroController.handlePointerUp()
    if (this.isInteractionBlocked()) {
      this.cancelActiveInteraction()
      return
    }

    const {
      context: { map, player },
    } = this
    this.mouse.x = evt.pageX
    this.mouse.y = evt.pageY
    this.pointerStart = null
    clearTimeout(this.mouseHoldTimeout)
    if (!this.isMouseInApp(evt)) {
      this.mouse.prevent = false
      this.cancelMouseRectangle()
      return
    }
    if (this.mouse.prevent || this.mouseDrag) {
      this.mouse.prevent = false
      return
    }
    if (!this.rallyPointController.active) {
      player?.selectedBuilding && player.unselectAll()
    }

    if (this.mouseRectangle) {
      this.selectionManager.handleMouseUp()
      return
    }

    if (this.isMouseInApp(evt)) {
      const pointer = this.screenToLocal(this.mouse.x, this.mouse.y)
      const pos = isometricToCartesian(pointer.x - map.x, pointer.y - map.y)
      const i = Math.min(Math.max(pos[0], 0), map.size)
      const j = Math.min(Math.max(pos[1], 0), map.size)
      if (map.grid[i] && map.grid[i][j]) {
        const cell = map.grid[i][j]
        if (this.mouseBuilding) {
          this.buildingPlacer.handleMouseUp(cell)
        } else if (this.rallyPointController.active) {
          this.rallyPointController.handleMouseUp(cell)
        } else if (hasRtsCommandableUnits(player?.selectedUnits)) {
          if ((cell.solid || cell.has) && cell.visible) return
          this.selectionManager.handleClick(cell)
        }
      }
    }
  }

  sendUnits(cell: RuntimeCell): void {
    if (this.isInteractionBlocked()) return
    return this.selectionManager.sendUnits(cell)
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

  isMouseInApp(evt: PointerPageEvent): boolean {
    if (this.isInteractionBlocked()) return false

    const target = evt.target instanceof Element ? evt.target : evt.nativeEvent?.target
    if (target instanceof Element) {
      return !target.tagName || Boolean(target.closest('#game'))
    }

    const clientX = evt.clientX ?? evt.nativeEvent?.clientX
    const clientY = evt.clientY ?? evt.nativeEvent?.clientY
    if (typeof clientX === 'number' && typeof clientY === 'number') {
      const rect = this.context.gamebox.getBoundingClientRect()
      return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
    }

    return false
  }

  shouldIgnoreCompatibilityMouseEvent(evt: PointerPageEvent): boolean {
    return Boolean(evt?.type?.startsWith('mouse') && performance.now() < this.ignoreMouseEventsUntil)
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
    if (evt.target instanceof Element && evt.target.closest('button, .topbar-options-menu')) {
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
    this.keyPressedCount = 0
    this.keySpeed = 0
    this.heroController.stopKeyboardMove()
  }

  isArpgActive(): boolean {
    return this.heroController.isActive()
  }

  setEquippedTool(tool: HeroTool | null): void {
    this.heroController.setEquippedTool(tool)
  }

  cancelMouseRectangle(): void {
    if (!this.mouseRectangle) return
    this.mouseRectangle.graph.destroy(true)
    this.mouseRectangle = null
  }

  cancelActiveInteraction(): void {
    this.stopKeyboardMove()
    this.stopMouseCameraMove()
    this.cancelMouseRectangle()
    this.pointerStart = null
    this.mouseTouch = null
    this.mouseDrag = false
    this.touchInteraction = null
    this.touchPanActive = false
    this.heroController.cancelActiveInteraction()
    this.mouse.prevent = false
    this.rallyPointController.cancel()
  }

  consumeUnitDoubleClick(unit: RuntimeEntity): boolean {
    if (this.lastClickedUnit !== unit) return false
    if (this.unitClickTimeout != null) clearTimeout(this.unitClickTimeout)
    this.lastClickedUnit = null
    this.doubleClicked = true
    setTimeout(() => {
      this.doubleClicked = false
    })
    return true
  }

  registerUnitClick(unit: RuntimeEntity): void {
    if (this.unitClickTimeout != null) clearTimeout(this.unitClickTimeout)
    this.lastClickedUnit = unit
    this.unitClickTimeout = setTimeout(() => {
      if (this.lastClickedUnit === unit) {
        this.lastClickedUnit = null
      }
    }, 600)
  }

  instanceInCamera(instance: { x: number; y: number }): boolean {
    return this.cameraController.instanceInCamera(instance)
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
