import {
  throttle,
  throttleByKey,
  canvasDrawDiamond,
  canvasDrawRectangle,
  canvasDrawStrokeRectangle,
  playerCanSeeInstance,
} from '../../lib'
import { getActiveMapSpace, getEntitySpaceId } from '../../lib/mapSpaces'
import { getLocalMapBounds } from '../../lib/localMapLayout'
import { CELL_WIDTH, CELL_HEIGHT, FAMILY_TYPES } from '../../constants'
import type { MinimapHostLike } from '../../types/context'
import type { PlayerLike } from '../../types/player'
import type { ResourceEntity, RuntimeEntity } from '../../types/entities'
import type { RuntimeCell, RuntimeMapSpace } from '../../types/map'

type MinimapBounds = {
  maxI: number
  maxJ: number
  minI: number
  minJ: number
}

type MinimapTransform = {
  canvasHeight: number
  canvasWidth: number
  factor: number
  inputFactor: number
  layout: 'iso-diamond' | 'world-rectangle'
  worldBounds?: ReturnType<typeof getLocalMapBounds>
  layoutKey: string
  offsetX: number
  offsetY: number
  originX: number
  originY: number
  size: number
  translate: number
}

// Canvases default to the HTML intrinsic 300x150 raster; the world->pixel math below
// (miniMapAlpha, the /234 reference in getMinimapFactor) is tuned to fill that box
// edge-to-edge. MINIMAP_RESOLUTION_SCALE renders at a multiple of that same reference
// size so the diamond still fills the canvas exactly, just at a crisper resolution
// once CSS stretches it to the (now larger) on-screen minimap box.
const MINIMAP_BASE_WIDTH = 300
const MINIMAP_BASE_HEIGHT = 150
const MINIMAP_SQUARE_BASE_SIZE = 300
const MINIMAP_RESOLUTION_SCALE = 4
const MINIMAP_LOCAL_EDGE_CROP_FALLBACK_X = 12
const MINIMAP_LOCAL_EDGE_CROP_FALLBACK_Y = 14

function terrainColor(value: string | number | undefined): string {
  return typeof value === 'string' ? value : ''
}

function isResourceEntity(instance: RuntimeEntity | null | undefined): instance is ResourceEntity {
  return instance?.family === FAMILY_TYPES.resource
}

function isMinimapUnitMarker(instance: RuntimeEntity | null | undefined): boolean {
  return Boolean(instance && instance.family !== FAMILY_TYPES.animal)
}

function getMinimapElement(menu: MinimapHostLike): HTMLDivElement {
  const element = menu.minimapMap
  if (!element) throw new Error('Minimap host is missing a minimap element')
  return element
}

function getMinimapDrawPosition(instance: RuntimeEntity): { x: number; y: number } | null {
  const pixiInstance = instance as RuntimeEntity & {
    destroyed?: boolean
    position?: { x?: number; y?: number } | null
  }
  if (instance.isDead || instance.isDestroyed || pixiInstance.destroyed || !pixiInstance.position) return null

  let x: number | undefined
  let y: number | undefined
  try {
    x = pixiInstance.position.x
    y = pixiInstance.position.y
  } catch {
    return null
  }

  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return { x: x as number, y: y as number }
}

export class MinimapManager {
  menu: MinimapHostLike
  miniMapAlpha: number
  updatePlayerMiniMap: (owner: PlayerLike) => void
  updateResourcesMiniMap: () => void
  updateCameraMiniMap: () => void
  private active: boolean
  private initialized: boolean
  private layoutKey: string | null

  constructor(menu: MinimapHostLike) {
    this.menu = menu
    this.miniMapAlpha = 1.284 * MINIMAP_RESOLUTION_SCALE
    this.active = false
    this.initialized = false
    this.layoutKey = null

    this.updatePlayerMiniMap = throttleByKey(
      this.updatePlayerMiniMapEvt.bind(this),
      500,
      (owner: PlayerLike) => owner?.label ?? owner
    )
    this.updateResourcesMiniMap = throttle(this.updateResourcesMiniMapEvt.bind(this), 500)
    this.updateCameraMiniMap = throttle(this.updateCameraMiniMapEvt.bind(this), 100)
  }

  activate(): void {
    this.active = true
    this.initMiniMap()
    this.redrawMiniMap()
  }

  deactivate(): void {
    this.active = false
    this.initialized = false
    this.layoutKey = null
  }

  isActive(): boolean {
    return this.active
  }

  private canDraw(): boolean {
    if (!this.active) return false
    this.menu.ensureMinimapCanvases?.()
    return Boolean(this.menu.terrainMinimap && this.menu.resourcesMinimap && this.menu.cameraMinimap)
  }

  refreshMiniMap(): void {
    this.redrawMiniMap()
  }

  private redrawMiniMap(): void {
    if (!this.canDraw()) return
    this.initMiniMap()
    const { map, player, players } = this.menu.context
    if (map.revealEverything || map.revealTerrain) {
      this.revealTerrainMinimap()
    } else {
      this.rebuildTerrainMiniMapFromViews()
    }
    this.updateResourcesMiniMapEvt()
    if (map.revealEverything) {
      players.forEach(owner => this.updatePlayerMiniMapEvt(owner))
    } else if (player) {
      this.updatePlayerMiniMapEvt(player)
    }
    this.updateCameraMiniMapEvt()
  }

  private getMinimapSpace(): RuntimeMapSpace {
    return getActiveMapSpace(this.menu.context.map)!
  }

  private getMinimapLayoutKey(): string {
    return this.getMinimapTransform().layoutKey
  }

  private getMinimapGrid(): RuntimeCell[][] {
    return this.getMinimapSpace().grid
  }

  private getMinimapSize(): number {
    return this.getMinimapSpace().size
  }

  private shouldUseSquareGridLayout(): boolean {
    return this.getMinimapSpace().kind !== 'interior' && Boolean(this.menu.context.map.localGridLayout)
  }

  private getLocalVisualCropPx(transform: MinimapTransform): { x: number; y: number } {
    if (transform.layout !== 'world-rectangle') return { x: 0, y: 0 }
    const styles = typeof getComputedStyle === 'function' ? getComputedStyle(getMinimapElement(this.menu)) : null
    const cropX = Number.parseFloat(styles?.getPropertyValue('--minimap-local-edge-crop-x') ?? '')
    const cropY = Number.parseFloat(styles?.getPropertyValue('--minimap-local-edge-crop-y') ?? '')
    if (Number.isFinite(cropX) || Number.isFinite(cropY)) {
      return {
        x: Number.isFinite(cropX) ? Math.max(0, cropX) : MINIMAP_LOCAL_EDGE_CROP_FALLBACK_X,
        y: Number.isFinite(cropY) ? Math.max(0, cropY) : MINIMAP_LOCAL_EDGE_CROP_FALLBACK_Y,
      }
    }
    const value =
      typeof getComputedStyle === 'function'
        ? getComputedStyle(getMinimapElement(this.menu)).getPropertyValue('--minimap-local-edge-crop')
        : ''
    const crop = Number.parseFloat(value)
    return Number.isFinite(crop)
      ? { x: Math.max(0, crop), y: Math.max(0, crop) }
      : { x: MINIMAP_LOCAL_EDGE_CROP_FALLBACK_X, y: MINIMAP_LOCAL_EDGE_CROP_FALLBACK_Y }
  }

  private shouldDrawTerrainCell(cell: RuntimeCell): boolean {
    const space = this.getMinimapSpace()
    if (space.kind !== 'interior') return true
    return !cell.terrainHidden && cell.category !== 'Water'
  }

  private getMinimapBounds(): MinimapBounds {
    const space = this.getMinimapSpace()
    return { minI: 0, minJ: 0, maxI: space.size, maxJ: space.size }
  }

  private getMinimapTransform(): MinimapTransform {
    const space = this.getMinimapSpace()
    const bounds = this.getMinimapBounds()
    const size = Math.max(1, bounds.maxI - bounds.minI, bounds.maxJ - bounds.minJ)
    const layout = this.shouldUseSquareGridLayout() ? 'world-rectangle' : 'iso-diamond'
    const canvasWidth =
      layout === 'world-rectangle'
        ? MINIMAP_SQUARE_BASE_SIZE * MINIMAP_RESOLUTION_SCALE
        : MINIMAP_BASE_WIDTH * MINIMAP_RESOLUTION_SCALE
    const canvasHeight =
      layout === 'world-rectangle'
        ? MINIMAP_SQUARE_BASE_SIZE * MINIMAP_RESOLUTION_SCALE
        : MINIMAP_BASE_HEIGHT * MINIMAP_RESOLUTION_SCALE
    const inputFactor = ((CELL_WIDTH / 2 + (size * CELL_WIDTH) / 2) / 234) * 2
    const factor = inputFactor / this.miniMapAlpha
    const translate = (CELL_WIDTH / 2 + (size * CELL_WIDTH) / 2) / 2 / factor
    const offsetX = ((bounds.minI - bounds.minJ) * CELL_WIDTH) / 2
    const offsetY = ((bounds.minI + bounds.minJ) * CELL_HEIGHT) / 2
    const origin = space.origin ?? { x: 0, y: 0 }
    const padding = 6 * MINIMAP_RESOLUTION_SCALE

    const localLayout = space.kind !== 'interior' ? this.menu.context.map.localGridLayout : undefined
    if (localLayout) {
      const worldBounds = getLocalMapBounds(localLayout)
      const worldWidth = worldBounds.right - worldBounds.left
      const worldHeight = worldBounds.bottom - worldBounds.top
      const worldFactor = Math.max(worldWidth, worldHeight, 1) / (canvasWidth - padding * 2)
      const insetX = (canvasWidth - worldWidth / worldFactor) / 2
      const insetY = (canvasHeight - worldHeight / worldFactor) / 2
      return {
        canvasHeight,
        canvasWidth,
        factor: worldFactor,
        inputFactor: worldFactor,
        layout: 'world-rectangle',
        layoutKey: `${space.id}:world-rectangle:${localLayout.columns}:${localLayout.rows}:${origin.x}:${origin.y}`,
        offsetX: worldBounds.left - insetX * worldFactor,
        offsetY: worldBounds.top - insetY * worldFactor,
        originX: origin.x,
        originY: origin.y,
        size,
        translate: 0,
        worldBounds,
      }
    }

    return {
      canvasHeight,
      canvasWidth,
      factor,
      inputFactor,
      layout,
      layoutKey: `${space.id}:${layout}:${size}:${bounds.minI}:${bounds.minJ}:${bounds.maxI}:${bounds.maxJ}`,
      offsetX,
      offsetY,
      originX: origin.x,
      originY: origin.y,
      size,
      translate,
    }
  }

  private toMinimapX(x: number, transform: MinimapTransform): number {
    return (x - transform.offsetX) / transform.factor + transform.translate
  }

  private toMinimapY(y: number, transform: MinimapTransform): number {
    return (y - transform.offsetY) / transform.factor
  }

  private cellToMinimapPoint(cell: RuntimeCell, transform: MinimapTransform): { x: number; y: number } {
    return { x: this.toMinimapX(cell.x, transform), y: this.toMinimapY(cell.y, transform) }
  }

  private instanceToMinimapPoint(
    instance: RuntimeEntity,
    transform: MinimapTransform
  ): { x: number; y: number } | null {
    const position = getMinimapDrawPosition(instance)
    if (!position) return null
    return { x: this.toMinimapX(position.x, transform), y: this.toMinimapY(position.y, transform) }
  }

  private drawTerrainCell(context: CanvasRenderingContext2D, cell: RuntimeCell, transform: MinimapTransform): void {
    const point = this.cellToMinimapPoint(cell, transform)
    canvasDrawDiamond(
      context,
      point.x,
      transform.layout !== 'iso-diamond' ? point.y - CELL_HEIGHT / transform.factor / 2 : point.y,
      CELL_WIDTH / transform.factor + 1,
      CELL_HEIGHT / transform.factor + 1,
      terrainColor(cell.color)
    )
  }

  private clearCanvas(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, transform: MinimapTransform): void {
    context.clearRect(-transform.translate, 0, canvas.width, canvas.height)
  }

  private getMarkerSquareSize(transform: MinimapTransform): number {
    const baseSize = 2 * MINIMAP_RESOLUTION_SCALE
    if (this.getMinimapSpace().kind !== 'interior') return baseSize
    const visibleCellHeight = CELL_HEIGHT / transform.factor
    return Math.max(baseSize, Math.min(visibleCellHeight * 0.45, 10 * MINIMAP_RESOLUTION_SCALE))
  }

  private getBuildingMarkerSize(size: number, squareSize: number): number {
    if (this.getMinimapSpace().kind !== 'interior') return squareSize + size * MINIMAP_RESOLUTION_SCALE
    return squareSize + size * squareSize * 0.35
  }

  private withMinimapViewSpace<T>(player: PlayerLike | null | undefined, callback: () => T): T {
    const space = this.getMinimapSpace()
    return player?.views?.withSpace?.(space.id, callback) ?? callback()
  }

  private isInMinimapSpace(instance: RuntimeEntity | null | undefined): instance is RuntimeEntity {
    if (!instance) return false
    return getEntitySpaceId(instance) === this.getMinimapSpace().id
  }

  private clearPlayerLayers(): void {
    const layers = this.menu.playersMinimap
    layers.forEach(({ canvas }) => canvas.remove?.())
    layers.length = 0
  }

  getMinimapFactor(): number {
    return this.getMinimapTransform().inputFactor
  }

  getMinimapParams(): { factor: number; translate: number } {
    const transform = this.getMinimapTransform()
    return { factor: transform.factor, translate: transform.translate }
  }

  getMinimapWorldPoint(
    clientX: number,
    clientY: number,
    rect: { height: number; left: number; top: number; width: number }
  ): {
    x: number
    y: number
  } {
    const transform = this.getMinimapTransform()
    if (transform.layout === 'world-rectangle') {
      const bounds = transform.worldBounds!
      const crop = this.getLocalVisualCropPx(transform)
      const x =
        ((clientX - rect.left + crop.x) / Math.max(1, rect.width + crop.x * 2)) *
          transform.canvasWidth *
          transform.factor +
        transform.offsetX
      const y =
        ((clientY - rect.top + crop.y) / Math.max(1, rect.height + crop.y * 2)) *
          transform.canvasHeight *
          transform.factor +
        transform.offsetY
      return {
        x: Math.min(Math.max(x, bounds.left), bounds.right) + transform.originX,
        y: Math.min(Math.max(y, bounds.top), bounds.bottom) + transform.originY,
      }
    }
    return {
      x: (clientX - rect.left - rect.width / 2) * transform.inputFactor + transform.offsetX + transform.originX,
      y: (clientY - rect.top - 3) * transform.inputFactor + transform.offsetY + transform.originY,
    }
  }

  initMiniMap(): void {
    if (!this.canDraw()) return
    const nextLayoutKey = this.getMinimapLayoutKey()
    if (this.initialized && this.layoutKey === nextLayoutKey) return
    if (this.initialized && this.layoutKey !== nextLayoutKey) this.clearPlayerLayers()

    const { menu } = this
    const transform = this.getMinimapTransform()
    const size = transform.size
    const { factor, translate } = transform

    for (const canvas of [menu.terrainMinimap!, menu.cameraMinimap!, menu.resourcesMinimap!]) {
      canvas.width = transform.canvasWidth
      canvas.height = transform.canvasHeight
      if (transform.layout === 'iso-diamond') canvas.getContext('2d')!.translate(translate, 0)
    }

    const minimapElement = getMinimapElement(menu)
    minimapElement.classList?.toggle('local-square', transform.layout !== 'iso-diamond')
    minimapElement.parentElement?.classList.toggle('local-square', transform.layout !== 'iso-diamond')
    if (transform.layout !== 'iso-diamond') {
      minimapElement.style.clipPath = ''
    } else {
      const N = size
      const canvasW = menu.terrainMinimap!.width
      const canvasH = menu.terrainMinimap!.height
      const centerX = 2 * translate
      const halfW = (N * CELL_WIDTH) / 2 / factor
      const halfH = (N * CELL_HEIGHT) / 2 / factor

      const px = (v: number) => `${((v / canvasW) * 100).toFixed(2)}%`
      const py = (v: number) => `${((v / canvasH) * 100).toFixed(2)}%`

      minimapElement.style.clipPath = `polygon(${px(centerX)} 0%, ${px(centerX + halfW)} ${py(halfH)}, ${px(centerX)} ${py(halfH * 2)}, ${px(centerX - halfW)} ${py(halfH)})`
    }
    this.initialized = true
    this.layoutKey = nextLayoutKey
  }

  revealTerrainMinimap(): void {
    if (!this.canDraw()) return
    this.initMiniMap()
    const { menu } = this
    const grid = this.getMinimapGrid()
    const size = this.getMinimapSize()
    const canvas = menu.terrainMinimap!
    const context = canvas.getContext('2d')!
    const transform = this.getMinimapTransform()

    this.clearCanvas(context, canvas, transform)
    for (let i = 0; i <= size; i++) {
      for (let j = 0; j <= size; j++) {
        const cell = grid[i]?.[j]
        if (!cell) continue
        if (!this.shouldDrawTerrainCell(cell)) continue
        this.drawTerrainCell(context, cell, transform)
      }
    }
  }

  rebuildTerrainMiniMapFromViews(): void {
    if (!this.canDraw()) return
    this.initMiniMap()
    const { menu } = this
    const { player } = menu.context
    const grid = this.getMinimapGrid()
    const size = this.getMinimapSize()
    const canvas = menu.terrainMinimap!
    const context = canvas.getContext('2d')!
    const transform = this.getMinimapTransform()

    this.clearCanvas(context, canvas, transform)
    if (!player?.views) return

    for (let i = 0; i <= size; i++) {
      for (let j = 0; j <= size; j++) {
        if (!this.withMinimapViewSpace(player, () => player.views.isViewed(i, j))) continue
        const cell = grid[i]?.[j]
        if (!cell) continue
        if (!this.shouldDrawTerrainCell(cell)) continue
        this.drawTerrainCell(context, cell, transform)
      }
    }
  }

  updateTerrainMiniMap(i: number, j: number): void {
    if (!this.canDraw()) return
    this.initMiniMap()
    const { menu } = this
    const canvas = menu.terrainMinimap!
    const context = canvas.getContext('2d')!
    const transform = this.getMinimapTransform()
    const cell = this.getMinimapGrid()[i]?.[j]
    if (!cell) return
    if (!this.shouldDrawTerrainCell(cell)) return

    this.drawTerrainCell(context, cell, transform)
    if (isResourceEntity(cell.has)) {
      this.updateResourceMiniMap(cell.has)
    }
  }

  updateResourceMiniMap(resource: ResourceEntity): void {
    if (!this.canDraw()) return
    this.initMiniMap()
    const { menu } = this
    const { map } = menu.context
    if (!this.isInMinimapSpace(resource)) return
    if (!map.showResources) return

    const context = menu.resourcesMinimap!.getContext('2d')!
    const transform = this.getMinimapTransform()
    const squareSize = this.getMarkerSquareSize(transform)
    const position = this.instanceToMinimapPoint(resource, transform)
    if (!position) return

    canvasDrawRectangle(
      context,
      position.x - squareSize / 2,
      position.y - squareSize / 2,
      squareSize,
      squareSize,
      resource.color ?? ''
    )
  }

  updateResourcesMiniMapEvt(): void {
    if (!this.canDraw()) return
    this.initMiniMap()
    const { menu } = this
    const { map, player } = menu.context
    const canvas = menu.resourcesMinimap!
    const context = canvas.getContext('2d')!
    const transform = this.getMinimapTransform()
    const squareSize = this.getMarkerSquareSize(transform)

    this.clearCanvas(context, canvas, transform)
    if (!map.showResources) return

    map.resources.forEach(resource => {
      if (!this.isInMinimapSpace(resource)) return
      if (
        resource.color &&
        (this.withMinimapViewSpace(player, () => Boolean(player?.views?.isViewed(resource.i, resource.j))) ||
          map.revealEverything)
      ) {
        const position = this.instanceToMinimapPoint(resource, transform)
        if (!position) return

        canvasDrawRectangle(
          context,
          position.x - squareSize / 2,
          position.y - squareSize / 2,
          squareSize,
          squareSize,
          resource.color
        )
      }
    })
  }

  updateCameraMiniMapEvt(): void {
    if (!this.canDraw()) return
    this.initMiniMap()
    const { menu } = this
    const { controls } = menu.context
    const canvas = menu.cameraMinimap!
    const context = canvas.getContext('2d')!
    const transform = this.getMinimapTransform()
    const { factor } = transform
    const { visibleLeft, visibleTop, visibleWidth, visibleHeight } = controls.getViewportMetrics()

    this.clearCanvas(context, canvas, transform)
    canvasDrawStrokeRectangle(
      context,
      this.toMinimapX(visibleLeft - transform.originX, transform),
      this.toMinimapY(visibleTop - transform.originY, transform),
      visibleWidth / factor,
      visibleHeight / factor,
      'white'
    )
  }

  updatePlayerMiniMapEvt(owner: PlayerLike): void {
    if (!this.canDraw()) return
    this.initMiniMap()
    if (!owner) return

    const { menu } = this
    const { map, player } = menu.context
    const transform = this.getMinimapTransform()
    const { translate } = transform
    const squareSize = this.getMarkerSquareSize(transform)
    const color = owner.colorHex
    const id = `minimap-${owner.label}`
    const shouldDrawOwner = map.revealEverything || owner.label === player?.label
    const shouldDrawOwnerUnits = owner.label === player?.label

    let canvas: HTMLCanvasElement
    let context: CanvasRenderingContext2D
    const existing = menu.playersMinimap.find(p => p.id === id)
    if (!shouldDrawOwner && !existing) return

    if (existing) {
      canvas = existing.canvas
      context = existing.context
    } else {
      canvas = document.createElement('canvas')
      canvas.width = transform.canvasWidth
      canvas.height = transform.canvasHeight
      context = canvas.getContext('2d')!
      if (transform.layout === 'iso-diamond') context.translate(translate, 0)
      menu.playersMinimap.push({ id, canvas, context })
      getMinimapElement(menu).appendChild(canvas)
    }

    this.clearCanvas(context, canvas, transform)
    if (!shouldDrawOwner) return

    const isVisible = (instance: RuntimeEntity) =>
      map.revealEverything || this.withMinimapViewSpace(player, () => playerCanSeeInstance(instance, player))

    owner.buildings.forEach(building => {
      if (!this.isInMinimapSpace(building)) return
      if (!isVisible(building)) return
      const position = this.instanceToMinimapPoint(building, transform)
      if (!position) return
      const { size = 0, selected } = building
      const finalSize = this.getBuildingMarkerSize(size, squareSize)
      canvasDrawRectangle(
        context,
        position.x - finalSize / 2,
        position.y - finalSize / 2,
        finalSize,
        finalSize,
        selected ? 'white' : color
      )
    })
    if (!shouldDrawOwnerUnits) return

    owner.units.forEach(unit => {
      if (!isMinimapUnitMarker(unit)) return
      if (!this.isInMinimapSpace(unit)) return
      if (!isVisible(unit)) return
      const position = this.instanceToMinimapPoint(unit, transform)
      if (!position) return
      const { selected } = unit
      canvasDrawRectangle(
        context,
        position.x - squareSize / 2,
        position.y - squareSize / 2,
        squareSize,
        squareSize,
        selected ? 'white' : color
      )
    })
  }
}
