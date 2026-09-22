import { pointInRectangle, updateInstanceRenderVisibility } from '../lib'
import type { RenderableInstance } from '../lib/grid/visibility'
import { rectangleIntersectsViewport } from '../lib/graphics/chunkCulling'
import { getActiveMapSpace, OUTSIDE_SPACE_ID } from '../lib/mapSpaces'
import { getLocalMapBounds } from '../lib/localMapLayout'
import { CELL_HEIGHT, CELL_WIDTH } from '../constants'
import { getCameraZoom } from '../lib/audio/settings'
import type { RuntimeCell, RuntimeMap } from '../types/map'
import type { Bounds, Viewport } from '../types/geometry'
import type { VisionGridLike } from '../types/player'
import {
  getCameraMoveDelta,
  getMouseCameraDirections,
  type CameraDirection,
  type CameraPoint,
} from './camera/CameraMovement'
import {
  collectCameraCells,
  collectCameraRenderCandidates,
  exploreCameraCells,
  type CameraVisibleCellsStats,
} from './camera/CameraVisibleCells'

// Generous halo around the viewport used to decide which cells are worth tracking for camera
// culling. Must comfortably exceed the largest building sprite's extent beyond its footprint tile
// (biggest observed sprite is ~220x170px) so an entity's bounding box is always re-checked against
// the true viewport before it visually enters or leaves the screen.
const CAMERA_CULL_MARGIN = CELL_WIDTH * 4
const CAMERA_VISIBLE_CELLS_SNAP = CELL_WIDTH / 2

type Point = CameraPoint
type CameraContext = {
  app: {
    screen: {
      width: number
      height: number
    }
  }
  map: RuntimeMap
  editor?: object | null
  controls?: {
    freeCameraActive?: boolean
    heroUnit?: { spaceId?: string | null; isDead?: boolean; isDestroyed?: boolean } | null
  }
  menu?: {
    updateCameraMiniMap?(): void
    isMiniMapActive?(): boolean
  } | null
  player?: {
    views?: VisionGridLike
    cellViewed?: number
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
type CameraMapSpaceView = {
  grid: RuntimeMap['grid']
  id: string
  isOutside: boolean
  origin: Point
  size: number
}

export class CameraController {
  context: CameraContext
  camera: { x: number; y: number }
  visibleCells: Set<RuntimeCell>
  mouseMoveState: MouseMoveState | null
  _rafPending: boolean
  _lastVisibleCellsViewportKey: string | null
  _lastCameraCellCollectionKey: string | null
  private visibilityRefreshViewport: Viewport | null = null
  private renderCandidates = new Set<RenderableInstance>()
  private observedCandidates = new WeakSet<RenderableInstance>()
  visibleCellsStats: CameraVisibleCellsStats

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
    this._lastCameraCellCollectionKey = null
    this.visibleCellsStats = {
      candidates: 0,
      exited: 0,
      margin: CAMERA_CULL_MARGIN,
      samples: 0,
      stepX: CELL_WIDTH / 2,
      stepY: CELL_HEIGHT / 2,
      updated: 0,
    }
  }

  getActiveCameraSpace(): CameraMapSpaceView {
    const { map } = this.context
    const space = getActiveMapSpace(map)
    return {
      grid: space?.grid ?? map.grid,
      id: space?.id ?? OUTSIDE_SPACE_ID,
      isOutside: !space || space.id === OUTSIDE_SPACE_ID || space.container === map,
      origin: space?.origin ?? { x: 0, y: 0 },
      size: space?.size ?? map.size,
    }
  }

  getCameraDiamondBounds(): { A: Point; B: Point; D: Point; C: Point } {
    const { origin, size } = this.getActiveCameraSpace()
    return {
      A: { x: origin.x + CELL_WIDTH / 2 - this.camera.x, y: origin.y - this.camera.y },
      B: {
        x: origin.x + CELL_WIDTH / 2 - (size * CELL_WIDTH) / 2 - this.camera.x,
        y: origin.y + (size * CELL_HEIGHT) / 2 - this.camera.y,
      },
      D: {
        x: origin.x + CELL_WIDTH / 2 + (size * CELL_WIDTH) / 2 - this.camera.x,
        y: origin.y + (size * CELL_HEIGHT) / 2 - this.camera.y,
      },
      C: { x: origin.x + CELL_WIDTH / 2 - this.camera.x, y: origin.y + size * CELL_HEIGHT - this.camera.y },
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

  getVisibleCellsStateKey(viewport: Viewport): string {
    return [
      this.getActiveCameraSpace().id,
      this.canExploreCamera(),
      viewport.visibleLeft,
      viewport.visibleTop,
      viewport.visibleWidth,
      viewport.visibleHeight,
    ].join(':')
  }

  canExploreCamera(): boolean {
    const { controls, editor } = this.context
    const hero = controls?.heroUnit
    return Boolean(
      !editor &&
        !controls?.freeCameraActive &&
        hero &&
        !hero.isDead &&
        !hero.isDestroyed &&
        (hero.spaceId || OUTSIDE_SPACE_ID) === this.getActiveCameraSpace().id
    )
  }

  scheduleVisibleCellsUpdate(): void {
    if (!this.getActiveCameraSpace().grid?.length) return
    const viewport = this.getViewportRect()
    if (this.visibleCells.size && this.getVisibleCellsStateKey(viewport) === this._lastVisibleCellsViewportKey) return
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
    const bounds = this.getLocalCameraBounds()
    if (bounds) {
      return {
        x: Math.min(Math.max(x, bounds.left), bounds.right),
        y: Math.min(Math.max(y, bounds.top), bounds.bottom),
      }
    }
    const { origin, size } = this.getActiveCameraSpace()
    const localX = x - origin.x
    const localY = y - origin.y
    const gridX = (localX / (CELL_WIDTH / 2) + localY / (CELL_HEIGHT / 2)) / 2
    const gridY = (localY / (CELL_HEIGHT / 2) - localX / (CELL_WIDTH / 2)) / 2
    const clampedX = Math.min(Math.max(gridX, 0), size)
    const clampedY = Math.min(Math.max(gridY, 0), size)
    return {
      x: origin.x + ((clampedX - clampedY) * CELL_WIDTH) / 2,
      y: origin.y + ((clampedX + clampedY) * CELL_HEIGHT) / 2,
    }
  }

  clampCameraToMap(): void {
    const bounds = this.getLocalCameraBounds()
    if (bounds) {
      const viewport = this.getViewportRect()
      // When the viewport exceeds an axis, center that axis over the map.
      const clampAxis = (start: number, extent: number, min: number, max: number) =>
        extent >= max - min ? (min + max - extent) / 2 : Math.min(Math.max(start, min), max - extent)
      this.camera.x +=
        clampAxis(viewport.visibleLeft, viewport.visibleWidth, bounds.left, bounds.right) - viewport.visibleLeft
      this.camera.y +=
        clampAxis(viewport.visibleTop, viewport.visibleHeight, bounds.top, bounds.bottom) - viewport.visibleTop
      return
    }
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

  private getLocalCameraBounds(): ReturnType<typeof getLocalMapBounds> | null {
    const { map } = this.context
    const space = this.getActiveCameraSpace()
    if (!space.isOutside || !map.localGridLayout) return null
    const bounds = getLocalMapBounds(map.localGridLayout)
    return {
      left: bounds.left + space.origin.x,
      right: bounds.right + space.origin.x,
      top: bounds.top + space.origin.y,
      bottom: bounds.bottom + space.origin.y,
    }
  }

  move(
    dir: CameraDirection | string,
    moveSpeed: number,
    isSpeedDivided: boolean,
    deltaScale = 1,
    useEdgeSlide = true
  ): void {
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
    const cameraCenter = {
      x: app.screen.width / 2,
      y: app.screen.height / 2,
    }
    const prevX = this.camera.x
    const prevY = this.camera.y
    const delta = getCameraMoveDelta(
      dir,
      speed,
      useEdgeSlide,
      Boolean(this.getLocalCameraBounds()),
      this.getCameraDiamondBounds(),
      cameraCenter
    )
    this.camera.x += delta.x
    this.camera.y += delta.y

    if (this.camera.x === prevX && this.camera.y === prevY) return

    this.clampCameraToMap()
    if (menu?.isMiniMapActive?.() !== false) menu?.updateCameraMiniMap?.()
    this.applyCameraTransform()
    this.scheduleVisibleCellsUpdate()
  }

  moveWithMouse(evt: { pageX: number; pageY: number }): void {
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
    const dir = getMouseCameraDirections(mouse, { width: window.innerWidth, height: window.innerHeight }, moveDist)
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
    const viewport = this.visibilityRefreshViewport ?? this.getViewportRect()
    if (bounds) return rectangleIntersectsViewport(bounds, viewport)
    const { visibleLeft, visibleTop, visibleWidth, visibleHeight } = viewport
    return pointInRectangle(instance.x, instance.y, visibleLeft, visibleTop, visibleWidth, visibleHeight)
  }

  trackRenderCandidate(instance: RenderableInstance, bounds: Bounds | null): void {
    if (!bounds) {
      this.renderCandidates.delete(instance)
      return
    }
    const viewport = this.visibilityRefreshViewport ?? this.getViewportRect()
    if (rectangleIntersectsViewport(bounds, viewport, CAMERA_CULL_MARGIN)) {
      this.renderCandidates.add(instance)
      if (instance.once && !this.observedCandidates.has(instance)) {
        this.observedCandidates.add(instance)
        instance.once('destroyed', () => this.renderCandidates.delete(instance))
      }
    } else {
      this.renderCandidates.delete(instance)
    }
  }

  getCellOnCamera(callback: (cell: RuntimeCell) => void): void {
    const { grid, origin, size } = this.getActiveCameraSpace()

    const { visibleLeft, visibleTop, visibleWidth, visibleHeight } = this.getViewportRect()
    const cameraFloor = {
      x: Math.floor(visibleLeft - origin.x),
      y: Math.floor(visibleTop - origin.y),
    }
    const margin = CELL_WIDTH

    const stepX = CELL_WIDTH / 2
    const stepY = CELL_HEIGHT / 2
    const invCW = 1 / CELL_WIDTH
    const invCH = 1 / CELL_HEIGHT
    for (let i = cameraFloor.x - margin; i <= cameraFloor.x + visibleWidth + margin; i += stepX) {
      for (let j = cameraFloor.y - margin; j <= cameraFloor.y + visibleHeight + margin; j += stepY) {
        const x = Math.min(Math.max(Math.round(i * invCW + j * invCH), 0), size)
        const y = Math.min(Math.max(Math.round(j * invCH - i * invCW), 0), size)
        if (grid[x]?.[y]) callback(grid[x][y])
      }
    }
  }

  updateVisibleCells(force = false): void {
    const { map, player } = this.context
    const activeSpace = this.getActiveCameraSpace()
    if (!activeSpace.grid?.length) return
    const viewport = this.getViewportRect()
    const viewportKey = this.getVisibleCellsStateKey(viewport)
    if (!force && this.visibleCells.size && viewportKey === this._lastVisibleCellsViewportKey) {
      this.context.performance?.record('camera.visibleCellsSkip', 0)
      return
    }
    if (activeSpace.isOutside) map.updateRenderChunks?.(viewport)

    const startedAt = performance.now()
    // Share this snapshot only during the synchronous refresh. Individual entity
    // updates outside this batch must always use the current camera and zoom.
    const previousViewport = this.visibilityRefreshViewport
    this.visibilityRefreshViewport = viewport
    try {
      if (!player?.views) return
      const margin = CAMERA_CULL_MARGIN
      const collectionKey = `${activeSpace.id}:${this.getVisibleCellsViewportKey(viewport)}`
      const reuseCells = !force && collectionKey === this._lastCameraCellCollectionKey && this.visibleCells.size > 0
      const {
        cells: newVisible,
        samples,
        stepX,
        stepY,
      } = reuseCells
        ? { cells: this.visibleCells, samples: 0, stepX: CELL_WIDTH / 2, stepY: CELL_HEIGHT / 2 }
        : collectCameraCells(activeSpace, viewport, margin)
      if (this.canExploreCamera()) {
        const explore = () => exploreCameraCells(newVisible, activeSpace.origin, viewport, player.views!)
        const discovered = player.views.withSpace ? player.views.withSpace(activeSpace.id, explore) : explore()
        player.cellViewed = (player.cellViewed ?? 0) + discovered
      }
      let exited = 0
      let updated = 0
      if (!reuseCells) {
        for (const cell of this.visibleCells) {
          if (!newVisible.has(cell)) exited++
        }
        updated = collectCameraRenderCandidates(newVisible, this.renderCandidates)
      }
      // Include candidates from the previous view so departing objects are hidden.
      // Visibility updates also remove destroyed, distant and inactive-space objects.
      for (const instance of this.renderCandidates) updateInstanceRenderVisibility(instance)

      this.visibleCellsStats = {
        candidates: newVisible.size,
        exited,
        margin,
        samples,
        stepX,
        stepY,
        updated,
      }

      this.visibleCells = newVisible
      this._lastVisibleCellsViewportKey = viewportKey
      this._lastCameraCellCollectionKey = collectionKey
    } finally {
      this.visibilityRefreshViewport = previousViewport
      this.context.performance?.record('camera.visibleCells', performance.now() - startedAt)
    }
  }

  set(x: number, y: number, direct?: boolean, refreshVisibleCells = true): void {
    const {
      context: { app, menu },
    } = this
    const requestedCenter = direct ? { x: x + app.screen.width / 2, y: y + app.screen.height / 2 } : { x, y }
    const center = this.getLocalCameraBounds()
      ? requestedCenter
      : this.clampWorldPointToMap(requestedCenter.x, requestedCenter.y)
    const nextCamera = {
      x: center.x - app.screen.width / 2,
      y: center.y - app.screen.height / 2,
    }
    const previousCamera = this.camera
    this.camera = nextCamera
    if (this.getLocalCameraBounds()) this.clampCameraToMap()
    const moved = this.camera.x !== previousCamera.x || this.camera.y !== previousCamera.y
    if (!moved) {
      if (refreshVisibleCells) this.updateVisibleCells()
      else this.scheduleVisibleCellsUpdate()
      return
    }

    this.applyCameraTransform()
    if (menu?.isMiniMapActive?.() !== false) menu?.updateCameraMiniMap?.()
    if (refreshVisibleCells) {
      this.updateVisibleCells()
    } else {
      this.scheduleVisibleCellsUpdate()
    }
  }
}
