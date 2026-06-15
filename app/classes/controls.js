import { Container, Graphics } from 'pixi.js'
import { isometricToCartesian, pointsDistance } from '../lib'
import { CameraController } from '../controllers/CameraController'
import { BuildingPlacer } from '../controllers/BuildingPlacer'
import { SelectionManager } from '../controllers/SelectionManager'
import { RallyPointController } from '../controllers/RallyPointController'
import { getCameraZoom } from '../lib/settings'
import { IS_MOBILE, TOUCH_DRAG_THRESHOLD } from '../constants'

const ARROW_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp'])
const KEYBOARD_CAMERA_INITIAL_SPEED = 7
const KEYBOARD_CAMERA_MAX_SPEED = 14
const KEYBOARD_CAMERA_ACCELERATION = 0.24
const MAX_CAMERA_FRAME_SCALE = 3
const TARGET_FRAME_MS = 1000 / 60
const COMPATIBILITY_MOUSE_EVENT_DELAY = 800

export default class Controls extends Container {
  constructor(context) {
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

    this.mouseHoldTimeout
    this.keysPressed = {}
    this.keyPressedCount = 0
    this.keySpeed = 0
    this.eventMode = 'auto'
    this.allowMove = false
    this.allowClick = false
    this.mouseRectangle
    this.mouseTouch
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

    this._onDocMouseMove = evt => this.moveCameraWithMouse(evt)
    this._onDocMouseOut = () => this.stopMouseCameraMove()
    this._onKeyDown = evt => this.onKeyDown(evt)
    this._onKeyUp = evt => this.onKeyUp(evt)
    this._onTouchStart = evt => this.onTouchStart(evt)
    this._onTouchEnd = evt => this.onTouchEnd(evt)
    this._onTouchMove = evt => this.onTouchMove(evt)
    this._onMouseMove = evt => this.onMouseMove(evt)
    this._onMouseDown = evt => this.onMouseDown(evt)
    this._onMouseUp = evt => this.onMouseUp(evt)
    this._onTouchCancel = () => this.cancelActiveInteraction()
    this._onWindowBlur = () => this.cancelActiveInteraction()
    this._onTick = ticker => this.onTick(ticker)

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
    document.addEventListener('mouseup', this._onMouseUp)
    window.addEventListener('blur', this._onWindowBlur)
    context.app.ticker.add(this._onTick)
  }

  destroy(options) {
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
    document.removeEventListener('mouseup', this._onMouseUp)
    window.removeEventListener('blur', this._onWindowBlur)
    this.context.app.ticker.remove(this._onTick)
    clearTimeout(this.unitClickTimeout)
    this.cancelActiveInteraction()
    super.destroy(options)
  }

  get camera() {
    return this.cameraController.camera
  }

  getViewportMetrics() {
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

  screenToLocal(x, y) {
    const { zoom, offsetX, offsetY } = this.getViewportMetrics()
    return {
      x: (x - offsetX) / zoom,
      y: (y - offsetY) / zoom,
    }
  }

  localToScreen(x, y) {
    const { zoom, offsetX, offsetY } = this.getViewportMetrics()
    return {
      x: offsetX + x * zoom,
      y: offsetY + y * zoom,
    }
  }

  isInteractionBlocked() {
    return Boolean(this.context.devConsoleOpen || this.context.paused || this.context.victory || this.context.defeat)
  }

  isEditableTarget(target) {
    if (!target || typeof target.closest !== 'function') return false
    return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
  }

  onKeyDown(evt) {
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

    if (evt.key === 'Delete' || evt.keyCode === 8) {
      const {
        context: { player },
      } = this
      for (const unit of [...player.selectedUnits]) {
        unit.die()
      }
      if (player.selectedBuilding) {
        player.selectedBuilding.die()
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

    this.context.menu?.handleHotkey(evt.key.toLowerCase())
  }

  onKeyUp(evt) {
    if (this.isInteractionBlocked()) {
      this.stopKeyboardMove()
      return
    }

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

  onTick(ticker) {
    if (this.isInteractionBlocked()) {
      this.cancelActiveInteraction()
      return
    }

    const frameScale = Math.min(
      (ticker.elapsedMS ?? ticker.deltaTime * TARGET_FRAME_MS) / TARGET_FRAME_MS,
      MAX_CAMERA_FRAME_SCALE
    )
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

  onTouchStart(evt) {
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

  onTouchMove(evt) {
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
      const hasMoved =
        this.touchInteraction &&
        pointsDistance(this.mouse.x, this.mouse.y, this.touchInteraction.startX, this.touchInteraction.startY) >
          TOUCH_DRAG_THRESHOLD
      if (hasMoved) {
        this.mouseDrag = true
        this.touchInteraction.moved = true
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

  onTouchEnd(evt) {
    this.ignoreMouseEventsUntil = performance.now() + COMPATIBILITY_MOUSE_EVENT_DELAY
    const touch = evt.changedTouches[0]
    if (this.touchPanActive || this.touchInteraction?.mode === 'pan') {
      this.pointerStart = null
      this.mouseDrag = true
      if (evt.touches.length) {
        const remainingTouch = evt.touches[0]
        this.mouseTouch = { x: remainingTouch.pageX, y: remainingTouch.pageY }
        this.touchInteraction = { mode: 'pan', moved: true }
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
      } else if (mode === 'pan') {
        this.pointerStart = null
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

  onMouseDown(evt) {
    if (this.shouldIgnoreCompatibilityMouseEvent(evt)) return
    if (this.isInteractionBlocked()) return

    this.mouse.x = evt.pageX
    this.mouse.y = evt.pageY
    if (!this.isMouseInApp(evt)) return
    this.pointerStart = { x: this.mouse.x, y: this.mouse.y }
  }

  onMouseMove(evt) {
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

  onMouseUp(evt) {
    if (this.shouldIgnoreCompatibilityMouseEvent(evt)) return
    if (this.isInteractionBlocked()) {
      this.cancelActiveInteraction()
      return
    }

    const {
      context: { map, player },
    } = this
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
        } else if (player?.selectedUnits.length) {
          if ((cell.solid || cell.has) && cell.visible) return
          this.selectionManager.handleClick(cell)
        }
      }
    }
  }

  sendUnits(cell) {
    if (this.isInteractionBlocked()) return
    return this.selectionManager.sendUnits(cell)
  }

  getCellUnderCursor() {
    const {
      context: { map },
    } = this
    const pointer = this.screenToLocal(this.mouse.x, this.mouse.y)
    const pos = isometricToCartesian(pointer.x - map.x, pointer.y - map.y)
    const i = Math.min(Math.max(pos[0], 0), map.size)
    const j = Math.min(Math.max(pos[1], 0), map.size)
    return map.grid[i]?.[j] || null
  }

  isMouseInApp(evt) {
    return !this.isInteractionBlocked() && evt.target && (!evt.target.tagName || evt.target.closest('#game'))
  }

  shouldIgnoreCompatibilityMouseEvent(evt) {
    return evt?.type?.startsWith('mouse') && performance.now() < this.ignoreMouseEventsUntil
  }

  removeMouseBuilding() {
    return this.buildingPlacer.removeMouseBuilding()
  }

  setMouseBuilding(building) {
    return this.buildingPlacer.setMouseBuilding(building)
  }

  moveCamera(dir, moveSpeed, isSpeedDivided, deltaScale = 1) {
    if (this.isInteractionBlocked()) return
    this.cameraController.move(dir, moveSpeed, isSpeedDivided, deltaScale)
  }

  moveCameraWithMouse(evt) {
    if (this.isInteractionBlocked()) {
      this.stopMouseCameraMove()
      return
    }
    if (evt.target?.closest('button, .topbar-options-menu')) {
      this.cameraController.stopMouseMove()
      return
    }
    this.cameraController.moveWithMouse(evt)
  }

  stopMouseCameraMove() {
    this.cameraController.stopMouseMove()
  }

  stopKeyboardMove() {
    this.keysPressed = {}
    this.keyPressedCount = 0
    this.keySpeed = 0
  }

  cancelMouseRectangle() {
    if (!this.mouseRectangle) return
    this.mouseRectangle.graph.destroy(true)
    this.mouseRectangle = null
  }

  cancelActiveInteraction() {
    this.stopKeyboardMove()
    this.stopMouseCameraMove()
    this.cancelMouseRectangle()
    this.pointerStart = null
    this.mouseTouch = null
    this.mouseDrag = false
    this.touchInteraction = null
    this.touchPanActive = false
    this.mouse.prevent = false
    this.rallyPointController.cancel()
  }

  consumeUnitDoubleClick(unit) {
    if (this.lastClickedUnit !== unit) return false
    clearTimeout(this.unitClickTimeout)
    this.lastClickedUnit = null
    this.doubleClicked = true
    setTimeout(() => {
      this.doubleClicked = false
    })
    return true
  }

  registerUnitClick(unit) {
    clearTimeout(this.unitClickTimeout)
    this.lastClickedUnit = unit
    this.unitClickTimeout = setTimeout(() => {
      if (this.lastClickedUnit === unit) {
        this.lastClickedUnit = null
      }
    }, 600)
  }

  instanceInCamera(instance) {
    return this.cameraController.instanceInCamera(instance)
  }

  instanceIsAudible(instance) {
    const {
      context: { map },
    } = this

    if (!this.instanceInCamera(instance)) return false
    if (map.revealEverything) return true
    if (instance.owner?.isPlayed || instance.owner?.owner?.isPlayed) return true

    return Boolean(instance.visible || instance.owner?.visible || instance.target?.visible)
  }

  getCellOnCamera(callback) {
    this.cameraController.getCellOnCamera(callback)
  }

  updateVisibleCells() {
    this.cameraController.updateVisibleCells()
  }

  init() {
    const {
      context: { player, map },
    } = this

    if (player?.buildings?.length) {
      this.setCamera(player.buildings[0].x, player.buildings[0].y)
    } else if (player?.units?.length) {
      this.setCamera(player.units[0].x, player.units[0].y)
    } else {
      this.setCamera(map.size / 2, map.size / 2)
    }
  }

  setCamera(x, y, direct) {
    if (this.isInteractionBlocked()) return
    this.cameraController.set(x, y, direct)
  }
}
