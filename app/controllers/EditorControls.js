import { Container } from 'pixi.js'
import { isometricToCartesian } from '../lib'
import { CameraController } from './CameraController'
import { getCameraZoom } from '../lib/settings'
import { EditorEntityPreview } from './EditorEntityPreview'

const ARROW_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp'])
const KEYBOARD_CAMERA_INITIAL_SPEED = 7
const KEYBOARD_CAMERA_MAX_SPEED = 14
const KEYBOARD_CAMERA_ACCELERATION = 0.24
const MAX_CAMERA_FRAME_SCALE = 3
const TARGET_FRAME_MS = 1000 / 60

export class EditorControls extends Container {
  constructor(context) {
    super()
    this.context = context
    this.cameraController = new CameraController(context)
    this.mouse = { prevent: false }
    this.mouseBuilding = null
    this.mouseRectangle = false
    this.clicked = false
    this.doubleClicked = false
    this.double = null
    this.keysPressed = {}
    this.keyPressedCount = 0
    this.keySpeed = 0
    this.pointerDown = false
    this.lastPaintSignature = null
    this.hoveredCell = null
    this.entityPreview = new EditorEntityPreview(this)

    this._onDocMouseMove = evt => this.moveCameraWithMouse(evt)
    this._onDocMouseOut = () => this.stopMouseCameraMove()
    this._onKeyDown = evt => this.onKeyDown(evt)
    this._onKeyUp = evt => this.onKeyUp(evt)
    this._onMouseMove = evt => this.onMouseMove(evt)
    this._onMouseDown = evt => this.onMouseDown(evt)
    this._onMouseUp = () => this.onMouseUp()
    this._onTick = ticker => this.onTick(ticker)

    document.addEventListener('mousemove', this._onDocMouseMove)
    document.addEventListener('mouseout', this._onDocMouseOut)
    document.addEventListener('keydown', this._onKeyDown)
    document.addEventListener('keyup', this._onKeyUp)
    context.gamebox.addEventListener('mousemove', this._onMouseMove)
    context.gamebox.addEventListener('mousedown', this._onMouseDown)
    document.addEventListener('mouseup', this._onMouseUp)
    context.app.ticker.add(this._onTick)

    this.setCamera(Math.floor(context.map.size / 2), Math.floor(context.map.size / 2))
    this.updateVisibleCells()
  }

  destroy(options) {
    document.removeEventListener('mousemove', this._onDocMouseMove)
    document.removeEventListener('mouseout', this._onDocMouseOut)
    document.removeEventListener('keydown', this._onKeyDown)
    document.removeEventListener('keyup', this._onKeyUp)
    this.context.gamebox.removeEventListener('mousemove', this._onMouseMove)
    this.context.gamebox.removeEventListener('mousedown', this._onMouseDown)
    document.removeEventListener('mouseup', this._onMouseUp)
    this.context.app.ticker.remove(this._onTick)
    this.stopMouseCameraMove()
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

  isMouseInApp(evt) {
    const rect = this.context.gamebox.getBoundingClientRect()
    return (
      evt.clientX >= rect.left && evt.clientX <= rect.right && evt.clientY >= rect.top && evt.clientY <= rect.bottom
    )
  }

  getCellFromPointer(evt) {
    if (!this.isMouseInApp(evt)) return null

    const {
      context: { map },
    } = this
    const pos = this.screenToLocal(evt.clientX, evt.clientY)
    const [i, j] = isometricToCartesian(pos.x - map.x, pos.y - map.y)

    if (i < 0 || j < 0 || i > map.size || j > map.size) return null
    return map.grid[i]?.[j] || null
  }

  moveCameraWithMouse(evt) {
    this.cameraController.moveWithMouse({ pageX: evt.clientX, pageY: evt.clientY })
  }

  stopMouseCameraMove() {
    this.cameraController.stopMouseMove()
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

  moveCamera(dir, speed, isSpeedDivided, deltaScale = 1) {
    this.cameraController.move(dir, speed, isSpeedDivided, deltaScale)
    this._refreshHover()
  }

  setCamera(x, y, direct) {
    this.cameraController.set(x, y, direct)
    this._refreshHover()
  }

  updateVisibleCells() {
    this.cameraController.updateVisibleCells()
  }

  onKeyDown(evt) {
    if (evt.key === 'Escape' && this.context.editor.cancelWallDraft?.()) {
      evt.preventDefault()
      return
    }
    if (!ARROW_KEYS.has(evt.key) || evt.repeat) return
    this.keysPressed[evt.key] = true
    this.keyPressedCount++
    if (this.keyPressedCount === 1) {
      this.keySpeed = KEYBOARD_CAMERA_INITIAL_SPEED
    }
  }

  onKeyUp(evt) {
    if (!ARROW_KEYS.has(evt.key)) return
    if (this.keysPressed[evt.key]) {
      delete this.keysPressed[evt.key]
      this.keyPressedCount--
    }
    if (this.keyPressedCount <= 0) {
      this.keyPressedCount = 0
      this.keySpeed = 0
    }
  }

  onTick(ticker) {
    const frameScale = Math.min(
      (ticker.elapsedMS ?? ticker.deltaTime * TARGET_FRAME_MS) / TARGET_FRAME_MS,
      MAX_CAMERA_FRAME_SCALE
    )
    this.cameraController.updateMouseMove(frameScale)
    if (this.keyPressedCount <= 0) return

    const double = this.keyPressedCount > 1
    if (this.keySpeed < KEYBOARD_CAMERA_MAX_SPEED) {
      this.keySpeed = Math.min(KEYBOARD_CAMERA_MAX_SPEED, this.keySpeed + frameScale * KEYBOARD_CAMERA_ACCELERATION)
    }
    if (this.keysPressed.ArrowLeft) this.moveCamera('left', this.keySpeed, double, frameScale)
    if (this.keysPressed.ArrowUp) this.moveCamera('up', this.keySpeed, double, frameScale)
    if (this.keysPressed.ArrowDown) this.moveCamera('down', this.keySpeed, double, frameScale)
    if (this.keysPressed.ArrowRight) this.moveCamera('right', this.keySpeed, double, frameScale)
  }

  onMouseMove(evt) {
    const cell = this.getCellFromPointer(evt)
    this.hoveredCell = cell
    this.context.hud.updateStatus(cell)
    this.context.editor.updateWallDraft?.(cell)
    this.entityPreview.update(cell)
    if (!this.pointerDown || !cell || !this.context.editor.canPaintTerrain()) return
    this.paint(cell)
  }

  onMouseDown(evt) {
    if (evt.button !== 0) return
    const cell = this.getCellFromPointer(evt)
    if (!cell) return
    if (this.context.editor.handleWallMapClick?.(cell)) return
    if (this.context.editor.canSelectEntities()) {
      if (!cell.has) {
        this.context.editor.handleUnitsModeMapClick(cell)
      }
      return
    }
    if (!this.context.editor.canPaintTerrain()) return
    if (cell.has) return
    this.context.player?.unselectAll?.()
    this.pointerDown = true
    this.context.editor.beginTerrainStroke?.()
    this.paint(cell)
  }

  onMouseUp() {
    this.pointerDown = false
    this.lastPaintSignature = null
    this.mouse.prevent = false
    this.context.editor.finishTerrainStroke?.()
  }

  paint(cell) {
    const { brushType, brushSize, mapPaint, elevationLevel } = this.context.editorState
    const signature = `${brushType}:${brushSize}:${mapPaint}:${elevationLevel}:${cell.i}:${cell.j}`
    if (signature === this.lastPaintSignature) return
    this.lastPaintSignature = signature
    this.context.editor.applyBrush(cell)
    this.context.hud.updateStatus(cell)
  }

  _refreshHover() {
    if (!this.hoveredCell) return
    this.context.hud.updateStatus(this.hoveredCell)
    this.entityPreview.update(this.hoveredCell)
  }

  removeMouseBuilding() {
    this.mouseBuilding = null
  }

  setMouseBuilding(building) {
    this.mouseBuilding = building
  }

  getCellOnCamera(callback) {
    if (typeof callback !== 'function') return
    for (let i = 0; i <= this.context.map.size; i++) {
      for (let j = 0; j <= this.context.map.size; j++) {
        const cell = this.context.map.grid[i]?.[j]
        if (cell) callback(cell)
      }
    }
  }
}
