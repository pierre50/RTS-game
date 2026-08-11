import { Container, Graphics } from 'pixi.js'
import { isometricToCartesian, pointsDistance } from '../lib'
import { CameraController } from '../controllers/CameraController'
import { BuildingPlacer } from '../controllers/BuildingPlacer'
import { RallyPointController } from '../controllers/RallyPointController'
import { HeroController } from '../controllers/HeroController'
import { GamepadHeroInput } from '../controllers/GamepadHeroInput'
import { getCameraZoom, getControlActionForKeyboardEvent, type ControlBindingAction } from '../lib/settings'
import { setHeroGameCursorEnabled, setVirtualCursorVisible } from '../lib/heroCursor'
import { isHeroInteractionTargetReachable } from '../lib/heroActionRange'
import { FAMILY_TYPES, IS_MOBILE, TOUCH_DRAG_THRESHOLD } from '../constants'
import { findFacingEntity, type HeroEquippedItem } from '../lib/heroTools'
import { isTalkableNpc } from '../lib/npcInteraction'
import { pickForeignNpcChatterLine, pickNpcChatterLine } from '../lib/npcChatter'
import type { AudibleInstanceLike, ControlPointerEvent, ControlsLike, GameContextLike } from '../types/context'
import type { BuildingEntity, PlaceableBuildingConfig, RuntimeEntity, UnitEntity } from '../types/entities'
import type { RuntimeCell } from '../types/map'
import type { Bounds } from '../types/geometry'

type PointerPoint = { x: number; y: number }
type PointerPageEvent = ControlPointerEvent & {
  pageX: number
  pageY: number
  button?: number
  ctrlKey?: boolean
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
const CAMERA_ACTIONS = new Set<ControlBindingAction>(['cameraLeft', 'cameraRight', 'cameraDown', 'cameraUp'])
const KEYBOARD_CAMERA_INITIAL_SPEED = 7
const KEYBOARD_CAMERA_MAX_SPEED = 14
const KEYBOARD_CAMERA_ACCELERATION = 0.24
const MAX_CAMERA_FRAME_SCALE = 3
const TARGET_FRAME_MS = 1000 / 60
const COMPATIBILITY_MOUSE_EVENT_DELAY = 800

function isSecondaryPointerButton(evt: { button?: number; ctrlKey?: boolean }): boolean {
  return evt.button === 2 || (evt.button === 0 && evt.ctrlKey === true)
}

export default class Controls extends Container implements ControlsLike {
  context: GameContextLike
  mouse: { x: number; y: number; prevent: boolean }
  cameraController: CameraController
  mouseHoldTimeout: ReturnType<typeof setTimeout> | undefined
  keysPressed: Partial<Record<ControlBindingAction, boolean>>
  keyActionsByCode: Partial<Record<string, ControlBindingAction>>
  keyPressedCount: number
  keySpeed: number
  shiftKeyActive: boolean
  freeCameraActive: boolean
  heroController: HeroController
  gamepadInput: GamepadHeroInput
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
    this.shiftKeyActive = false
    this.freeCameraActive = false
    this.heroController = new HeroController(this)
    this.gamepadInput = new GamepadHeroInput(this)
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
        this.context.victory ||
        this.context.defeat
    )
  }

  isInGameMenuOpen(): boolean {
    const menu = this.context.menu
    return Boolean(
      this.context.devConsoleOpen ||
        this.context.paused ||
        this.context.victory ||
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
    if (this.buildingPlacer.cancelWallDraft()) {
      evt.preventDefault()
      return true
    }
    if (this.mouseBuilding) {
      evt.preventDefault()
      this.removeMouseBuilding()
      this.context.menu?.updateActionTarget?.()
      return true
    }
    if (this.rallyPointController.active) {
      evt.preventDefault()
      this.rallyPointController.cancel()
      return true
    }
    if (this.isHeroControlActive() && this.heroController.pendingGoToNpcs) {
      evt.preventDefault()
      this.heroController.cancelGoToPicking()
      return true
    }
    if (this.isHeroControlActive() && this.context.menu?.isInventoryOpen?.()) {
      evt.preventDefault()
      this.context.menu.closeInventory?.()
      return true
    }
    if (this.isHeroControlActive() && this.closeAnyHeroPanel()) {
      evt.preventDefault()
      return true
    }
    return false
  }

  onKeyDown(evt: KeyboardEvent): void {
    if (this.isEditableTarget(evt.target)) return
    if (evt.key === 'Alt' || evt.altKey) {
      this.stopKeyboardMove()
      return
    }
    if (evt.key === 'Escape' && this.handleEscapeKey(evt)) return
    const action = getControlActionForKeyboardEvent(evt)
    if (action === 'heroDirectionLock') {
      if (evt.code) this.keyActionsByCode[evt.code] = action
      this.shiftKeyActive = true
      evt.preventDefault()
      return
    }
    if (
      action === 'inventory' &&
      this.isHeroControlActive() &&
      this.context.menu?.isInventoryOpen?.()
    ) {
      evt.preventDefault()
      this.context.menu.closeInventory?.()
      return
    }
    if (this.isInteractionBlocked()) return
    const isCameraAction = Boolean(action && CAMERA_ACTIONS.has(action))
    if (evt.repeat && !isCameraAction) return

    if (action && isCameraAction) {
      if (evt.code) this.keyActionsByCode[evt.code] = action
      if (!evt.repeat) {
        this.keysPressed[action] = true
        this.keyPressedCount++
        if (this.keyPressedCount === 1) {
          this.keySpeed = KEYBOARD_CAMERA_INITIAL_SPEED
        }
      }
      return
    }

    if (action && this.heroController.handleKeyDown(action)) {
      if (evt.code) this.keyActionsByCode[evt.code] = action
      return
    }

    this.context.menu?.handleHotkey?.(evt.key.toLowerCase())
  }

  onKeyUp(evt: KeyboardEvent): void {
    if (this.isInteractionBlocked()) {
      this.stopKeyboardMove()
      return
    }

    if (evt.key === 'Alt') {
      this.stopKeyboardMove()
      return
    }

    const action = getControlActionForKeyboardEvent(evt) || (evt.code ? this.keyActionsByCode[evt.code] : null)
    if (evt.code) delete this.keyActionsByCode[evt.code]
    if (action === 'heroDirectionLock') {
      this.shiftKeyActive = false
      evt.preventDefault()
      return
    }
    if (action) this.heroController.handleKeyUp(action)

    if (!action || !CAMERA_ACTIONS.has(action)) return

    if (!evt.repeat && this.keysPressed[action]) {
      delete this.keysPressed[action]
      this.keyPressedCount--
    }
    if (this.keyPressedCount <= 0) {
      this.keyPressedCount = 0
      this.keySpeed = 0
    }
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
        this.cameraController.set(this.heroUnit!.x, this.heroUnit!.y)
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
    if (this.keyPressedCount <= 0) return
    const double = this.keyPressedCount > 1
    if (this.keySpeed < KEYBOARD_CAMERA_MAX_SPEED) {
      this.keySpeed = Math.min(KEYBOARD_CAMERA_MAX_SPEED, this.keySpeed + frameScale * KEYBOARD_CAMERA_ACCELERATION)
    }
    if (this.keysPressed.cameraLeft) this.moveCamera('left', this.keySpeed, double, frameScale)
    if (this.keysPressed.cameraUp) this.moveCamera('up', this.keySpeed, double, frameScale)
    if (this.keysPressed.cameraDown) this.moveCamera('down', this.keySpeed, double, frameScale)
    if (this.keysPressed.cameraRight) this.moveCamera('right', this.keySpeed, double, frameScale)
  }

  onTouchStart(evt: TouchEvent): void {
    if (this.isInteractionBlocked()) return
    this.ignoreMouseEventsUntil = performance.now() + COMPATIBILITY_MOUSE_EVENT_DELAY

    const touch = evt.touches[0]
    if (evt.touches.length >= 2) {
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
        this.mouseBuilding ? this.buildingPlacer.handleMouseMove() : this.rallyPointController.handleMouseMove()
        return
      }

      if (!IS_MOBILE) {
        this.onMouseDown(touch)
        return
      }
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
      }
    }
    this.touchInteraction = null
    this.mouseTouch = null
    this.mouseDrag = false
  }

  onMouseDown(evt: PointerPageEvent): void {
    if (this.shouldIgnoreCompatibilityMouseEvent(evt)) return
    if (this.isInteractionBlocked()) return
    if (evt.altKey) this.stopKeyboardMove()

    this.mouse.x = evt.pageX
    this.mouse.y = evt.pageY
    setVirtualCursorVisible(false)
    if (!this.isMouseInApp(evt)) return

    if (this.mouseBuilding || this.rallyPointController.active) {
      this.mouse.prevent = false
      this.mouseBuilding ? this.buildingPlacer.handleMouseMove() : this.rallyPointController.handleMouseMove()
      return
    }

    if (this.isHeroControlActive() && isSecondaryPointerButton(evt)) {
      evt.preventDefault?.()
      this.heroController.handleSecondaryPointerDown()
      this.mouse.prevent = true
      return
    }

    if (this.isHeroControlActive() && evt.button === 0) {
      evt.preventDefault?.()
      this.heroController.handlePrimaryPointerDown()
      this.mouse.prevent = true
      return
    }
  }

  onMouseMove(evt: PointerPageEvent): void {
    if (this.shouldIgnoreCompatibilityMouseEvent(evt)) return
    this.mouse.x = evt.pageX
    this.mouse.y = evt.pageY
    setVirtualCursorVisible(false)

    if (this.isInteractionBlocked()) return

    if (this.mouseBuilding || this.rallyPointController.active) {
      this.mouseBuilding ? this.buildingPlacer.handleMouseMove() : this.rallyPointController.handleMouseMove()
      return
    }
  }

  onWheel(evt: WheelEvent): void {
    if (this.isEditableTarget(evt.target)) return
    if (this.isInteractionBlocked() || !this.isHeroControlActive() || this.isInGameMenuOpen()) return

    this.mouse.x = evt.pageX
    this.mouse.y = evt.pageY
    setVirtualCursorVisible(false)
    if (!this.isMouseInApp(evt)) return

    const delta = evt.deltaY || evt.deltaX
    if (delta === 0) return

    if (this.heroController.cycleTool(delta > 0 ? 1 : -1)) {
      evt.preventDefault()
      evt.stopPropagation()
    }
  }

  onContextMenu(evt: MouseEvent): void {
    const shouldSuppress =
      performance.now() < this.suppressContextMenuUntil ||
      (this.isHeroControlActive() && (this.isMouseInApp(evt) || Boolean(document.querySelector?.('.modal'))))
    if (!shouldSuppress) return
    evt.preventDefault()
    evt.stopPropagation()
    evt.stopImmediatePropagation?.()
  }

  onMouseUp(evt: PointerPageEvent): void {
    if (this.shouldIgnoreCompatibilityMouseEvent(evt)) return
    this.heroController.handlePointerUp(isSecondaryPointerButton(evt) ? 2 : (evt.button ?? 0))
    if (this.isInteractionBlocked()) {
      this.cancelActiveInteraction()
      return
    }

    const {
      context: { map, player },
    } = this
    this.mouse.x = evt.pageX
    this.mouse.y = evt.pageY
    setVirtualCursorVisible(false)
    clearTimeout(this.mouseHoldTimeout)
    if (!this.isMouseInApp(evt)) {
      this.mouse.prevent = false
      return
    }
    if (this.mouse.prevent || this.mouseDrag) {
      this.mouse.prevent = false
      return
    }
    if (!this.rallyPointController.active) {
      !this.isHeroControlActive() && player?.selectedBuilding && player.unselectAll()
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
        }
      }
    }
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

  // Whatever the hero is currently facing, not whatever the mouse happens to be over — matches
  // the direction-based resolution the "heroInteract" (E) key already uses.
  getFacingEntityTarget(): RuntimeEntity | null {
    const hero = this.heroUnit
    if (!hero) return null
    return findFacingEntity(hero, target => isHeroInteractionTargetReachable(hero, null, target))
  }

  // Closes whichever hero panel (npc orders / building menu / entity info) is currently open.
  // Shared by the Escape handler, the merged interact key, and the gamepad's dedicated inspect
  // button (which calls openHeroEntityInteraction directly, bypassing HeroController) so the
  // three entry points can't drift out of sync on which panels they know to close.
  closeAnyHeroPanel(): boolean {
    const menu = this.context.menu
    if (menu?.isNpcOrdersOpen?.()) {
      menu.closeNpcOrders?.()
      return true
    }
    if (menu?.isHeroBuildingMenuOpen?.()) {
      menu.closeHeroBuildingMenu?.()
      return true
    }
    if (menu?.isEntityInfoModalOpen?.()) {
      menu.closeEntityInfoModal?.()
      return true
    }
    return false
  }

  openHeroEntityInteraction(target: RuntimeEntity | null = this.getFacingEntityTarget()): boolean {
    if (!this.isHeroControlActive()) return false
    const menu = this.context.menu
    // Pressing the same key/button again closes whichever panel it opened.
    if (this.closeAnyHeroPanel()) return true
    if (!target) return false
    const hero = this.heroUnit
    if (target === hero) return false
    const player = this.context.player
    if (target.family === FAMILY_TYPES.building) {
      const building = target as BuildingEntity
      if (menu?.openHeroBuildingMenu?.(building)) {
        player?.unselectAll?.()
        building.select?.()
        player.selectedBuilding = building
        return true
      }
      // Own building out of range: same rule as left-click actions — no fallback window, just require contact.
      if (building.owner === player) return false
    }
    if (!hero || !isHeroInteractionTargetReachable(hero, null, target)) return false
    if (isTalkableNpc(hero, target)) {
      // No order is possible here (non-chief hero, or the ally isn't commandable right now) —
      // same orders panel as a single-target order, just with a chatter line and no buttons.
      const unit = target as UnitEntity
      const chatterLine = unit.owner === hero.owner ? pickNpcChatterLine() : pickForeignNpcChatterLine(unit)
      menu?.openNpcOrders?.([unit], { chatterLine, ordersEnabled: false })
      return true
    }
    return Boolean(menu?.openEntityInfoModal?.(target))
  }

  getGamepadMoveVector(): { dx: number; dy: number } {
    return this.gamepadInput.moveVector
  }

  isHeroDirectionLockActive(): boolean {
    return this.shiftKeyActive || this.gamepadInput.directionLockActive
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
      this.cameraController.set(this.heroUnit.x, this.heroUnit.y)
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
    this.mouseTouch = null
    this.mouseDrag = false
    this.touchInteraction = null
    this.touchPanActive = false
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
