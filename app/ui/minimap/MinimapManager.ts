import {
  throttle,
  throttleByKey,
  canvasDrawDiamond,
  canvasDrawRectangle,
  canvasDrawStrokeRectangle,
  playerCanSeeInstance,
} from '../../lib'
import { getActiveMapSpace, getEntitySpaceId } from '../../lib/mapSpaces'
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
  bounds: MinimapBounds
  factor: number
  inputFactor: number
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
const MINIMAP_RESOLUTION_SCALE = 4

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
    const inputFactor = ((CELL_WIDTH / 2 + (size * CELL_WIDTH) / 2) / 234) * 2
    const factor = inputFactor / this.miniMapAlpha
    const translate = (CELL_WIDTH / 2 + (size * CELL_WIDTH) / 2) / 2 / factor
    const offsetX = ((bounds.minI - bounds.minJ) * CELL_WIDTH) / 2
    const offsetY = ((bounds.minI + bounds.minJ) * CELL_HEIGHT) / 2
    const origin = space.origin ?? { x: 0, y: 0 }

    return {
      bounds,
      factor,
      inputFactor,
      layoutKey: `${space.id}:${size}:${bounds.minI}:${bounds.minJ}:${bounds.maxI}:${bounds.maxJ}`,
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

  getMinimapWorldPoint(clientX: number, clientY: number, rect: { left: number; top: number; width: number }): {
    x: number
    y: number
  } {
    const transform = this.getMinimapTransform()
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
      canvas.width = MINIMAP_BASE_WIDTH * MINIMAP_RESOLUTION_SCALE
      canvas.height = MINIMAP_BASE_HEIGHT * MINIMAP_RESOLUTION_SCALE
      canvas.getContext('2d')!.translate(translate, 0)
    }

    const N = size
    const canvasW = menu.terrainMinimap!.width
    const canvasH = menu.terrainMinimap!.height
    const centerX = 2 * translate
    const halfW = (N * CELL_WIDTH) / 2 / factor
    const halfH = (N * CELL_HEIGHT) / 2 / factor

    const px = (v: number) => `${((v / canvasW) * 100).toFixed(2)}%`
    const py = (v: number) => `${((v / canvasH) * 100).toFixed(2)}%`

    getMinimapElement(menu).style.clipPath =
      `polygon(${px(centerX)} 0%, ${px(centerX + halfW)} ${py(halfH)}, ${px(centerX)} ${py(halfH * 2)}, ${px(centerX - halfW)} ${py(halfH)})`
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
    const { factor, translate } = transform

    context.clearRect(-translate, 0, canvas.width, canvas.height)
    for (let i = 0; i <= size; i++) {
      for (let j = 0; j <= size; j++) {
        const cell = grid[i]?.[j]
        if (!cell) continue
        if (!this.shouldDrawTerrainCell(cell)) continue
        canvasDrawDiamond(
          context,
          this.toMinimapX(cell.x, transform),
          this.toMinimapY(cell.y, transform),
          CELL_WIDTH / factor + 1,
          CELL_HEIGHT / factor + 1,
          terrainColor(cell.color)
        )
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
    const { factor, translate } = transform

    context.clearRect(-translate, 0, canvas.width, canvas.height)
    if (!player?.views) return

    for (let i = 0; i <= size; i++) {
      for (let j = 0; j <= size; j++) {
        if (!this.withMinimapViewSpace(player, () => player.views.isViewed(i, j))) continue
        const cell = grid[i]?.[j]
        if (!cell) continue
        if (!this.shouldDrawTerrainCell(cell)) continue
        canvasDrawDiamond(
          context,
          this.toMinimapX(cell.x, transform),
          this.toMinimapY(cell.y, transform),
          CELL_WIDTH / factor + 1,
          CELL_HEIGHT / factor + 1,
          terrainColor(cell.color)
        )
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
    const { factor } = transform
    const cell = this.getMinimapGrid()[i]?.[j]
    if (!cell) return
    if (!this.shouldDrawTerrainCell(cell)) return

    canvasDrawDiamond(
      context,
      this.toMinimapX(cell.x, transform),
      this.toMinimapY(cell.y, transform),
      CELL_WIDTH / factor + 1,
      CELL_HEIGHT / factor + 1,
      terrainColor(cell.color)
    )
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
    const position = getMinimapDrawPosition(resource)
    if (!position) return

    canvasDrawRectangle(
      context,
      this.toMinimapX(position.x, transform) - squareSize / 2,
      this.toMinimapY(position.y, transform) - squareSize / 2,
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
    const { translate } = transform
    const squareSize = this.getMarkerSquareSize(transform)

    context.clearRect(-translate, 0, canvas.width, canvas.height)
    if (!map.showResources) return

    map.resources.forEach(resource => {
      if (!this.isInMinimapSpace(resource)) return
      if (
        resource.color &&
        (this.withMinimapViewSpace(player, () => Boolean(player?.views?.isViewed(resource.i, resource.j))) ||
          map.revealEverything)
      ) {
        const position = getMinimapDrawPosition(resource)
        if (!position) return

        canvasDrawRectangle(
          context,
          this.toMinimapX(position.x, transform) - squareSize / 2,
          this.toMinimapY(position.y, transform) - squareSize / 2,
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
    const { factor, translate } = transform
    const { visibleLeft, visibleTop, visibleWidth, visibleHeight } = controls.getViewportMetrics()

    context.clearRect(-translate, 0, canvas.width, canvas.height)
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
      canvas.width = MINIMAP_BASE_WIDTH * MINIMAP_RESOLUTION_SCALE
      canvas.height = MINIMAP_BASE_HEIGHT * MINIMAP_RESOLUTION_SCALE
      context = canvas.getContext('2d')!
      context.translate(translate, 0)
      menu.playersMinimap.push({ id, canvas, context })
      getMinimapElement(menu).appendChild(canvas)
    }

    context.clearRect(-translate, 0, canvas.width, canvas.height)
    if (!shouldDrawOwner) return

    const isVisible = (instance: RuntimeEntity) =>
      map.revealEverything || this.withMinimapViewSpace(player, () => playerCanSeeInstance(instance, player))

    owner.buildings.forEach(building => {
      if (!this.isInMinimapSpace(building)) return
      if (!isVisible(building)) return
      const position = getMinimapDrawPosition(building)
      if (!position) return
      const { size = 0, selected } = building
      const finalSize = this.getBuildingMarkerSize(size, squareSize)
      canvasDrawRectangle(
        context,
        this.toMinimapX(position.x, transform) - finalSize / 2,
        this.toMinimapY(position.y, transform) - finalSize / 2,
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
      const position = getMinimapDrawPosition(unit)
      if (!position) return
      const { selected } = unit
      canvasDrawRectangle(
        context,
        this.toMinimapX(position.x, transform) - squareSize / 2,
        this.toMinimapY(position.y, transform) - squareSize / 2,
        squareSize,
        squareSize,
        selected ? 'white' : color
      )
    })
  }
}
