import { CELL_HEIGHT, CELL_WIDTH } from '../../constants'
import type { LocalMapLayout } from '../../lib/localMapLayout'
import { getLocalMapBounds } from '../../lib/localMapLayout'
import { getActiveMapSpace } from '../../lib/mapSpaces'
import type { MinimapHostLike } from '../../types/context'
import type { RuntimeEntity } from '../../types/entities'
import type { RuntimeCell, RuntimeMapSpace } from '../../types/map'

type MinimapBounds = {
  maxI: number
  maxJ: number
  minI: number
  minJ: number
}
export type MinimapTransform = {
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
export function getMinimapElement(menu: MinimapHostLike): HTMLDivElement {
  const element = menu.minimapMap
  if (!element) throw new Error('Minimap host is missing a minimap element')
  return element
}
const MINIMAP_BASE_WIDTH = 300
const MINIMAP_BASE_HEIGHT = 150
const MINIMAP_SQUARE_BASE_SIZE = 300
export const MINIMAP_RESOLUTION_SCALE = 4
const MINIMAP_LOCAL_EDGE_CROP_FALLBACK_X = 12
const MINIMAP_LOCAL_EDGE_CROP_FALLBACK_Y = 14
const MINIMAP_UNIT_AVATAR_DISPLAY_SIZE = 6 * MINIMAP_RESOLUTION_SCALE
export class MinimapGeometry {
  constructor(
    private readonly menu: MinimapHostLike,
    private readonly getAlpha: () => number
  ) {}
  getMinimapSpace(): RuntimeMapSpace {
    const space = getActiveMapSpace(this.menu.context.map)
    if (!space) throw new Error('Minimap requires an active map space')
    return space
  }

  getMinimapLayoutKey(): string {
    return this.getMinimapTransform().layoutKey
  }

  getMinimapGrid(): RuntimeCell[][] {
    return this.getMinimapSpace().grid
  }

  getMinimapSize(): number {
    return this.getMinimapSpace().size
  }

  shouldUseSquareGridLayout(): boolean {
    return Boolean(this.getMinimapLocalLayout())
  }

  getMinimapLocalLayout(): LocalMapLayout | undefined {
    const space = this.getMinimapSpace()
    return space.kind === 'interior'
      ? space.localGridLayout
      : (space.localGridLayout ?? this.menu.context.map.localGridLayout)
  }

  getLocalVisualCropPx(transform: MinimapTransform): { x: number; y: number } {
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

  getMinimapBounds(): MinimapBounds {
    const space = this.getMinimapSpace()
    return { minI: 0, minJ: 0, maxI: space.size, maxJ: space.size }
  }

  getMinimapTransform(): MinimapTransform {
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
    const factor = inputFactor / this.getAlpha()
    const translate = (CELL_WIDTH / 2 + (size * CELL_WIDTH) / 2) / 2 / factor
    const offsetX = ((bounds.minI - bounds.minJ) * CELL_WIDTH) / 2
    const offsetY = ((bounds.minI + bounds.minJ) * CELL_HEIGHT) / 2
    const origin = space.origin ?? { x: 0, y: 0 }
    const padding = 6 * MINIMAP_RESOLUTION_SCALE

    const localLayout = this.getMinimapLocalLayout()
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

  toMinimapX(x: number, transform: MinimapTransform): number {
    return (x - transform.offsetX) / transform.factor + transform.translate
  }

  toMinimapY(y: number, transform: MinimapTransform): number {
    return (y - transform.offsetY) / transform.factor
  }

  cellToMinimapPoint(cell: RuntimeCell, transform: MinimapTransform): { x: number; y: number } {
    return { x: this.toMinimapX(cell.x, transform), y: this.toMinimapY(cell.y, transform) }
  }

  instanceToMinimapPoint(instance: RuntimeEntity, transform: MinimapTransform): { x: number; y: number } | null {
    const position = getMinimapDrawPosition(instance)
    if (!position) return null
    return { x: this.toMinimapX(position.x, transform), y: this.toMinimapY(position.y, transform) }
  }

  getMarkerSquareSize(transform: MinimapTransform): number {
    const baseSize = 2 * MINIMAP_RESOLUTION_SCALE
    if (this.getMinimapSpace().kind !== 'interior') return baseSize
    const visibleCellHeight = CELL_HEIGHT / transform.factor
    return Math.max(baseSize, Math.min(visibleCellHeight * 0.45, 10 * MINIMAP_RESOLUTION_SCALE))
  }

  getBuildingMarkerSize(size: number, squareSize: number): number {
    if (this.getMinimapSpace().kind !== 'interior') return squareSize + size * MINIMAP_RESOLUTION_SCALE
    return squareSize + size * squareSize * 0.35
  }

  getUnitAvatarSize(squareSize: number): number {
    return Math.max(squareSize, MINIMAP_UNIT_AVATAR_DISPLAY_SIZE)
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
      const bounds = transform.worldBounds
      if (!bounds) throw new Error('Rectangular minimap requires world bounds')
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
}
