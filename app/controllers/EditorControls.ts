import { Container } from 'pixi.js'
import { isometricToCartesian } from '../lib'
import { CameraController } from './CameraController'
import { EditorEntityPreview, type EditorPreviewControls } from './EditorEntityPreview'
import type { SelectionRectangle } from '../types/context'
import type { RuntimeCell, RuntimeMap } from '../types/map'
import type { PlaceableBuildingConfig } from '../types/entities'
import type { PlayerLike } from '../types/player'
import type { Bounds } from '../types/geometry'

type TickerLike = { elapsedMS?: number; deltaTime: number }
type ViewportMetrics = {
  zoom: number
  offsetX: number
  offsetY: number
  visibleLeft: number
  visibleTop: number
  visibleWidth: number
  visibleHeight: number
}
type EditorControlsContext = {
  app: {
    screen: { width: number; height: number }
    ticker: {
      add(callback: (ticker: TickerLike) => void): void
      remove(callback: (ticker: TickerLike) => void): void
    }
  }
  gamebox: HTMLElement
  map: RuntimeMap
  player?: Pick<PlayerLike, 'unselectAll'> | null
  hud: {
    updateStatus(cell: RuntimeCell | null): void
  }
  editorState: {
    brushType: string
    brushSize: number
    mapPaint: string
    elevationLevel: number
  }
  editor: {
    cancelWallDraft?: () => boolean
    updateWallDraft?: (cell: RuntimeCell | null) => void
    handleWallMapClick?: (cell: RuntimeCell) => boolean
    canSelectEntities(): boolean
    handleUnitsModeMapClick(cell: RuntimeCell): void
    canPaintTerrain(): boolean
    beginTerrainStroke?: () => void
    finishTerrainStroke?: () => void
    applyBrush(cell: RuntimeCell): void
    hasWallDraft?: () => boolean
    _canWallUseCell(cell: RuntimeCell, owner: PlayerLike | null): boolean
  }
}
type AudibleEntity = {
  x?: number
  y?: number
  owner?: { isPlayed?: boolean; owner?: { isPlayed?: boolean }; visible?: boolean }
  target?: { visible?: boolean }
  visible?: boolean
}
type CameraPoint = { x: number; y: number }

const ARROW_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp'])
const KEYBOARD_CAMERA_INITIAL_SPEED = 7
const KEYBOARD_CAMERA_MAX_SPEED = 14
const KEYBOARD_CAMERA_ACCELERATION = 0.24
const MAX_CAMERA_FRAME_SCALE = 3
const TARGET_FRAME_MS = 1000 / 60

export class EditorControls extends Container {
  context: EditorControlsContext
  cameraController: CameraController
  mouse: { x: number; y: number; prevent: boolean }
  mouseBuilding: PlaceableBuildingConfig | null
  mouseRectangle: SelectionRectangle | false
  clicked: boolean
  doubleClicked: boolean
  double: CameraPoint | null
  keysPressed: Record<string, boolean>
  keyPressedCount: number
  keySpeed: number
  pointerDown: boolean
  lastPaintSignature: string | null
  hoveredCell: RuntimeCell | null
  entityPreview: EditorEntityPreview
  _onDocMouseMove: (evt: MouseEvent) => void
  _onDocMouseOut: () => void
  _onKeyDown: (evt: KeyboardEvent) => void
  _onKeyUp: (evt: KeyboardEvent) => void
  _onMouseMove: (evt: MouseEvent) => void
  _onMouseDown: (evt: MouseEvent) => void
  _onMouseUp: () => void
  _onTick: (ticker: TickerLike) => void

  constructor(context: EditorControlsContext) {
    super()
    this.context = context
    this.cameraController = new CameraController(context)
    this.mouse = { x: 0, y: 0, prevent: false }
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
    this.entityPreview = new EditorEntityPreview(this as EditorPreviewControls)

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

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    document.removeEventListener('mousemove', this._onDocMouseMove)
    document.removeEventListener('mouseout', this._onDocMouseOut)
    document.removeEventListener('keydown', this._onKeyDown)
    document.removeEventListener('keyup', this._onKeyUp)
    this.context.gamebox.removeEventListener('mousemove', this._onMouseMove)
    this.context.gamebox.removeEventListener('mousedown', this._onMouseDown)
    document.removeEventListener('mouseup', this._onMouseUp)
    this.context.app.ticker.remove(this._onTick)
    this.stopMouseCameraMove()
    super.destroy(options ?? undefined)
  }

  get camera(): { x: number; y: number } {
    return this.cameraController.camera
  }

  getViewportMetrics(): ViewportMetrics {
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
      x: rect.left + (x * zoom + offsetX) / scaleX,
      y: rect.top + (y * zoom + offsetY) / scaleY,
    }
  }

  isInteractionBlocked(): boolean {
    return false
  }

  isMouseInApp(evt: MouseEvent): boolean {
    const rect = this.context.gamebox.getBoundingClientRect()
    return (
      evt.clientX >= rect.left && evt.clientX <= rect.right && evt.clientY >= rect.top && evt.clientY <= rect.bottom
    )
  }

  getCellFromPointer(evt: MouseEvent): RuntimeCell | null {
    if (!this.isMouseInApp(evt)) return null

    const {
      context: { map },
    } = this
    const pos = this.screenToLocal(evt.clientX, evt.clientY)
    const [i, j] = isometricToCartesian(pos.x - map.x, pos.y - map.y)

    if (i < 0 || j < 0 || i > map.size || j > map.size) return null
    return map.grid[i]?.[j] || null
  }

  moveCameraWithMouse(evt: MouseEvent): void {
    this.cameraController.moveWithMouse({ pageX: evt.clientX, pageY: evt.clientY })
  }

  stopMouseCameraMove(): void {
    this.cameraController.stopMouseMove()
  }

  instanceInCamera(instance: CameraPoint, bounds?: Bounds): boolean {
    return this.cameraController.instanceInCamera(instance, bounds)
  }

  instanceIsAudible(instance: AudibleEntity): boolean {
    const {
      context: { map },
    } = this

    if (
      typeof instance.x === 'number' &&
      typeof instance.y === 'number' &&
      !this.instanceInCamera({ x: instance.x, y: instance.y })
    )
      return false
    if (map.revealEverything) return true
    if (instance.owner?.isPlayed || instance.owner?.owner?.isPlayed) return true

    return Boolean(instance.visible || instance.owner?.visible || instance.target?.visible)
  }

  moveCamera(dir: string, speed: number, isSpeedDivided: boolean, deltaScale = 1): void {
    this.cameraController.move(dir, speed, isSpeedDivided, deltaScale)
    this._refreshHover()
  }

  setCamera(x: number, y: number, direct?: boolean): void {
    this.cameraController.set(x, y, direct)
    this._refreshHover()
  }

  updateVisibleCells(): void {
    this.cameraController.updateVisibleCells()
  }

  onKeyDown(evt: KeyboardEvent): void {
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

  onKeyUp(evt: KeyboardEvent): void {
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

  onTick(ticker: TickerLike): void {
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

  onMouseMove(evt: MouseEvent): void {
    const cell = this.getCellFromPointer(evt)
    this.hoveredCell = cell
    this.context.hud.updateStatus(cell)
    this.context.editor.updateWallDraft?.(cell)
    this.entityPreview.update(cell)
    if (!this.pointerDown || !cell || !this.context.editor.canPaintTerrain()) return
    this.paint(cell)
  }

  onMouseDown(evt: MouseEvent): void {
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

  onMouseUp(): void {
    this.pointerDown = false
    this.lastPaintSignature = null
    this.mouse.prevent = false
    this.context.editor.finishTerrainStroke?.()
  }

  paint(cell: RuntimeCell): void {
    const { brushType, brushSize, mapPaint, elevationLevel } = this.context.editorState
    const signature = `${brushType}:${brushSize}:${mapPaint}:${elevationLevel}:${cell.i}:${cell.j}`
    if (signature === this.lastPaintSignature) return
    this.lastPaintSignature = signature
    this.context.editor.applyBrush(cell)
    this.context.hud.updateStatus(cell)
  }

  _refreshHover(): void {
    if (!this.hoveredCell) return
    this.context.hud.updateStatus(this.hoveredCell)
    this.entityPreview.update(this.hoveredCell)
  }

  removeMouseBuilding(): void {
    this.mouseBuilding = null
  }

  setMouseBuilding(building: PlaceableBuildingConfig): void {
    this.mouseBuilding = building
  }

  getCellOnCamera(callback: (cell: RuntimeCell) => void): void {
    if (typeof callback !== 'function') return
    for (let i = 0; i <= this.context.map.size; i++) {
      for (let j = 0; j <= this.context.map.size; j++) {
        const cell = this.context.map.grid[i]?.[j]
        if (cell) callback(cell)
      }
    }
  }
}
