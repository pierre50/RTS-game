import { pointInRectangle, pointIsBetweenTwoPoint, updateInstanceRenderVisibility } from '../lib'
import { rectangleIntersectsViewport } from '../lib/graphics/chunkCulling'
import { CELL_HEIGHT, CELL_WIDTH } from '../constants'
import { getCameraZoom } from '../lib/audio/settings'
import type { RuntimeCell, RuntimeMap } from '../types/map'
import type { Bounds, Viewport } from '../types/geometry'
import type { VisionGridLike } from '../types/player'

// Generous halo around the viewport used to decide which cells are worth tracking for camera
// culling. Must comfortably exceed the largest building sprite's extent beyond its footprint tile
// (biggest observed sprite is ~220x170px) so an entity's bounding box is always re-checked against
// the true viewport before it visually enters or leaves the screen.
const CAMERA_CULL_MARGIN = CELL_WIDTH * 4
const CAMERA_VISIBLE_CELLS_SNAP = CELL_WIDTH / 2

type Point = { x: number; y: number }
type CameraDirection = 'left' | 'right' | 'up' | 'down'
type CameraContext = {
  app: {
    screen: {
      width: number
      height: number
    }
  }
  map: RuntimeMap
  menu?: {
    updateCameraMiniMap?(): void
    isMiniMapActive?(): boolean
  } | null
  player?: {
    views?: VisionGridLike
    unselectAll?: () => void
  } | null
  performance?: {
    record(name: string, value: number): void
  } | null
}
type MouseMoveState = {
  dir: CameraDirection[]
  calcs: Record<CameraDirection, number>
}

export class CameraController {
  context: CameraContext
  camera: { x: number; y: number }
  visibleCells: Set<RuntimeCell>
  mouseMoveState: MouseMoveState | null
  _rafPending: boolean
  _nextVisibleCells?: Set<RuntimeCell>
  _lastVisibleCellsViewportKey: string | null

  constructor(context: CameraContext) {
    this.context = context
    this.camera = {
      x: 0,
      y: 0,
    }
    this.visibleCells = new Set()
    this.mouseMoveState = null
    this._rafPending = false
    this._lastVisibleCellsViewportKey = null
  }

  getCameraDiamondBounds(): { A: Point; B: Point; D: Point; C: Point } {
    const { map } = this.context
    return {
      A: { x: CELL_WIDTH / 2 - this.camera.x, y: -this.camera.y },
      B: {
        x: CELL_WIDTH / 2 - (map.size * CELL_WIDTH) / 2 - this.camera.x,
        y: (map.size * CELL_HEIGHT) / 2 - this.camera.y,
      },
      D: {
        x: CELL_WIDTH / 2 + (map.size * CELL_WIDTH) / 2 - this.camera.x,
        y: (map.size * CELL_HEIGHT) / 2 - this.camera.y,
      },
      C: { x: CELL_WIDTH / 2 - this.camera.x, y: map.size * CELL_HEIGHT - this.camera.y },
    }
  }

  getVisibleCellsViewportKey(viewport: Viewport): string {
    return [
      Math.floor(viewport.visibleLeft / CAMERA_VISIBLE_CELLS_SNAP),
      Math.floor(viewport.visibleTop / CAMERA_VISIBLE_CELLS_SNAP),
      Math.ceil(viewport.visibleWidth / CAMERA_VISIBLE_CELLS_SNAP),
      Math.ceil(viewport.visibleHeight / CAMERA_VISIBLE_CELLS_SNAP),
    ].join(':')
  }

  scheduleVisibleCellsUpdate(): void {
    const { map } = this.context
    if (!map?.grid?.length) return
    const viewport = this.getViewportRect()
    if (this.getVisibleCellsViewportKey(viewport) === this._lastVisibleCellsViewportKey) return
    if (this._rafPending) return
    this._rafPending = true
    requestAnimationFrame(() => {
      this._rafPending = false
      this.updateVisibleCells(false)
    })
  }

  applyCameraTransform(): void {
    this.context.map.setCoordinate(-this.camera.x, -this.camera.y)
  }

  getViewportRect(): Viewport & { zoom: number; offsetX: number; offsetY: number } {
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

  clampWorldPointToMap(x: number, y: number): { x: number; y: number } {
    const { map } = this.context
    const gridX = (x / (CELL_WIDTH / 2) + y / (CELL_HEIGHT / 2)) / 2
    const gridY = (y / (CELL_HEIGHT / 2) - x / (CELL_WIDTH / 2)) / 2
    const clampedX = Math.min(Math.max(gridX, 0), map.size)
    const clampedY = Math.min(Math.max(gridY, 0), map.size)
    return {
      x: ((clampedX - clampedY) * CELL_WIDTH) / 2,
      y: ((clampedX + clampedY) * CELL_HEIGHT) / 2,
    }
  }

  clampCameraToMap(): void {
    const {
      context: { app },
    } = this
    const center = this.clampWorldPointToMap(
      this.camera.x + app.screen.width / 2,
      this.camera.y + app.screen.height / 2
    )
    this.camera.x = center.x - app.screen.width / 2
    this.camera.y = center.y - app.screen.height / 2
  }

  move(dir: CameraDirection | string, moveSpeed: number, isSpeedDivided: boolean, deltaScale = 1): void {
    /**
     *  /A\
     * /   \
     *B     D
     * \   /
     *  \C/
     */

    const {
      context: { app, menu },
    } = this

    const dividedSpeed = isSpeedDivided ? 1.5 : 1
    const speed = ((moveSpeed || 20) / dividedSpeed) * deltaScale
    const { A, B, C, D } = this.getCameraDiamondBounds()
    const cameraCenter = {
      x: app.screen.width / 2,
      y: app.screen.height / 2,
    }
    const prevX = this.camera.x
    const prevY = this.camera.y

    if (dir === 'left') {
      if (cameraCenter.x - 100 > B.x && pointIsBetweenTwoPoint(A, B, cameraCenter, 50)) {
        this.camera.y += speed / (CELL_WIDTH / CELL_HEIGHT)
        this.camera.x -= speed
      } else if (cameraCenter.x - 100 > B.x && pointIsBetweenTwoPoint(B, C, cameraCenter, 50)) {
        this.camera.y -= speed / (CELL_WIDTH / CELL_HEIGHT)
        this.camera.x -= speed
      } else if (cameraCenter.x - 100 > B.x) {
        this.camera.x -= speed
      }
    } else if (dir === 'right') {
      if (cameraCenter.x + 100 < D.x && pointIsBetweenTwoPoint(A, D, cameraCenter, 50)) {
        this.camera.y += speed / (CELL_WIDTH / CELL_HEIGHT)
        this.camera.x += speed
      } else if (cameraCenter.x + 100 < D.x && pointIsBetweenTwoPoint(D, C, cameraCenter, 50)) {
        this.camera.y -= speed / (CELL_WIDTH / CELL_HEIGHT)
        this.camera.x += speed
      } else if (cameraCenter.x + 100 < D.x) {
        this.camera.x += speed
      }
    }
    if (dir === 'up') {
      if (cameraCenter.y - 50 > A.y && pointIsBetweenTwoPoint(A, B, cameraCenter, 50)) {
        this.camera.y -= speed / (CELL_WIDTH / CELL_HEIGHT)
        this.camera.x += speed
      } else if (cameraCenter.y - 50 > A.y && pointIsBetweenTwoPoint(A, D, cameraCenter, 50)) {
        this.camera.y -= speed / (CELL_WIDTH / CELL_HEIGHT)
        this.camera.x -= speed
      } else if (cameraCenter.y - 50 > A.y) {
        this.camera.y -= speed
      }
    } else if (dir === 'down') {
      if (cameraCenter.y + 50 < C.y && pointIsBetweenTwoPoint(D, C, cameraCenter, 50)) {
        this.camera.y += speed / (CELL_WIDTH / CELL_HEIGHT)
        this.camera.x -= speed
      } else if (cameraCenter.y + 50 < C.y && pointIsBetweenTwoPoint(B, C, cameraCenter, 50)) {
        this.camera.y += speed / (CELL_WIDTH / CELL_HEIGHT)
        this.camera.x += speed
      } else if (cameraCenter.y + 100 < C.y) {
        this.camera.y += speed
      }
    }

    if (this.camera.x === prevX && this.camera.y === prevY) return

    this.clampCameraToMap()
    if (menu?.isMiniMapActive?.() !== false) menu?.updateCameraMiniMap?.()
    this.applyCameraTransform()
    this.scheduleVisibleCellsUpdate()
  }

  moveWithMouse(evt: { pageX: number; pageY: number }): void {
    const dir: CameraDirection[] = []
    const mouse = {
      x: evt.pageX,
      y: evt.pageY,
    }
    const coef = 1
    const moveDist = 10

    const calcs = {
      left: (0 + moveDist - mouse.x) * coef,
      right: (mouse.x - (window.innerWidth - moveDist)) * coef,
      up: (0 + moveDist - mouse.y) * coef,
      down: (mouse.y - (window.innerHeight - moveDist)) * coef,
    }
    if (mouse.x >= 0 && mouse.x <= 0 + moveDist && mouse.y >= 0 && mouse.y <= window.innerHeight) {
      dir.push('left')
    } else if (
      mouse.x > window.innerWidth - moveDist &&
      mouse.x <= window.innerWidth &&
      mouse.y >= 0 &&
      mouse.y <= window.innerHeight
    ) {
      dir.push('right')
    }
    if (mouse.x >= 0 && mouse.x <= window.innerWidth && mouse.y >= 0 && mouse.y <= 0 + moveDist) {
      dir.push('up')
    } else if (
      mouse.x >= 0 &&
      mouse.x <= window.innerWidth &&
      mouse.y > window.innerHeight - moveDist &&
      mouse.y <= window.innerHeight
    ) {
      dir.push('down')
    }
    this.mouseMoveState = dir.length ? { dir, calcs } : null
  }

  stopMouseMove(): void {
    this.mouseMoveState = null
  }

  updateMouseMove(deltaScale = 1): void {
    if (!this.mouseMoveState) return
    this.mouseMoveState.dir.forEach(dir => {
      this.move(dir, this.mouseMoveState!.calcs[dir], false, deltaScale)
    })
  }

  instanceInCamera(instance: Point, bounds?: Bounds): boolean {
    const viewport = this.getViewportRect()
    if (bounds) return rectangleIntersectsViewport(bounds, viewport)
    const { visibleLeft, visibleTop, visibleWidth, visibleHeight } = viewport
    return pointInRectangle(instance.x, instance.y, visibleLeft, visibleTop, visibleWidth, visibleHeight)
  }

  getCellOnCamera(callback: (cell: RuntimeCell) => void): void {
    const {
      context: { map },
    } = this

    const { visibleLeft, visibleTop, visibleWidth, visibleHeight } = this.getViewportRect()
    const cameraFloor = {
      x: Math.floor(visibleLeft),
      y: Math.floor(visibleTop),
    }
    const margin = CELL_WIDTH

    const stepX = CELL_WIDTH / 2
    const stepY = CELL_HEIGHT / 2
    const invCW = 1 / CELL_WIDTH
    const invCH = 1 / CELL_HEIGHT
    for (let i = cameraFloor.x - margin; i <= cameraFloor.x + visibleWidth + margin; i += stepX) {
      for (let j = cameraFloor.y - margin; j <= cameraFloor.y + visibleHeight + margin; j += stepY) {
        const x = Math.min(Math.max(Math.round(i * invCW + j * invCH), 0), map.size)
        const y = Math.min(Math.max(Math.round(j * invCH - i * invCW), 0), map.size)
        if (map.grid[x]?.[y]) callback(map.grid[x][y])
      }
    }
  }

  updateVisibleCells(force = true): void {
    const { map, player } = this.context
    if (!map?.grid?.length) return
    const viewport = this.getViewportRect()
    const viewportKey = this.getVisibleCellsViewportKey(viewport)
    if (!force && viewportKey === this._lastVisibleCellsViewportKey) {
      this.context.performance?.record('camera.visibleCellsSkip', 0)
      return
    }
    this._lastVisibleCellsViewportKey = viewportKey
    map.updateRenderChunks?.(viewport)

    const startedAt = performance.now()
    try {
      if (!player?.views) return
      const newVisible = this._nextVisibleCells ?? new Set()
      newVisible.clear()
      const margin = CAMERA_CULL_MARGIN
      const { visibleLeft, visibleTop, visibleWidth, visibleHeight } = viewport

      const startX = Math.floor(visibleLeft - margin)
      const endX = Math.floor(visibleLeft + visibleWidth + margin)
      const startY = Math.floor(visibleTop - margin)
      const endY = Math.floor(visibleTop + visibleHeight + margin)

      const stepX = CELL_WIDTH / 2
      const stepY = CELL_HEIGHT / 2
      const invCW = 1 / CELL_WIDTH
      const invCH = 1 / CELL_HEIGHT
      for (let i = startX; i <= endX; i += stepX) {
        for (let j = startY; j <= endY; j += stepY) {
          const x = Math.min(Math.max(Math.round(i * invCW + j * invCH), 0), map.size)
          const y = Math.min(Math.max(Math.round(j * invCH - i * invCW), 0), map.size)
          const cell = map.grid[x]?.[y]
          if (cell) newVisible.add(cell)
        }
      }

      for (let cell of this.visibleCells) {
        if (!newVisible.has(cell)) {
          if (cell.has) updateInstanceRenderVisibility(cell.has)
          for (const corpse of cell.corpses) updateInstanceRenderVisibility(corpse)
        }
      }

      for (let cell of newVisible) {
        const hasCameraCulledContent = cell.has || cell.corpses?.size
        if (!this.visibleCells.has(cell) || hasCameraCulledContent) {
          cell.updateVisible()
        }
      }

      this._nextVisibleCells = this.visibleCells
      this.visibleCells = newVisible
    } finally {
      this.context.performance?.record('camera.visibleCells', performance.now() - startedAt)
    }
  }

  set(x: number, y: number, direct?: boolean, refreshVisibleCells = true): void {
    const {
      context: { app, menu },
    } = this
    const requestedCenter = direct ? { x: x + app.screen.width / 2, y: y + app.screen.height / 2 } : { x, y }
    const center = this.clampWorldPointToMap(requestedCenter.x, requestedCenter.y)
    const nextCamera = {
      x: center.x - app.screen.width / 2,
      y: center.y - app.screen.height / 2,
    }
    const moved = nextCamera.x !== this.camera.x || nextCamera.y !== this.camera.y
    if (!moved) return

    this.camera = nextCamera
    this.applyCameraTransform()
    if (menu?.isMiniMapActive?.() !== false) menu?.updateCameraMiniMap?.()
    if (refreshVisibleCells) {
      this.updateVisibleCells()
    } else {
      this.scheduleVisibleCellsUpdate()
    }
  }
}
