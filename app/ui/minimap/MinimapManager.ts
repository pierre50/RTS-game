import { BUILDING_TYPES,CELL_HEIGHT,CELL_WIDTH } from '../../constants'
import {
canvasDrawDiamond,
canvasDrawRectangle,
canvasDrawStrokeRectangle,
playerCanSeeInstance,
throttle,
throttleByKey,
} from '../../lib'
import { instanceIsInPlayerSight } from '../../lib/grid/visibility'
import { getEntitySpaceId } from '../../lib/mapSpaces'
import { usesPersonalVision } from '../../lib/units/playerVisionAccess'
import type { MinimapHostLike } from '../../types/context'
import type { ResourceEntity,RuntimeEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import type { PlayerLike } from '../../types/player'
import { resourceColor,terrainColor } from './MinimapColors'
import { isMinimapUnitMarker,isResourceEntity } from './MinimapEntityKinds'
import { getMinimapElement,MINIMAP_RESOLUTION_SCALE,MinimapGeometry,type MinimapTransform } from './MinimapGeometry'
import { drawMinimapQuestMarkers } from './MinimapQuestMarkers'
import { getMinimapUnitAvatar } from './MinimapUnitAvatar'
import { withMinimapPlayerVision } from './MinimapVisibility'

// Canvases default to the HTML intrinsic 300x150 raster; the world->pixel math below
// (miniMapAlpha, the /234 reference in getMinimapFactor) is tuned to fill that box
// edge-to-edge. MINIMAP_RESOLUTION_SCALE renders at a multiple of that same reference
// size so the diamond still fills the canvas exactly, just at a crisper resolution
// once CSS stretches it to the (now larger) on-screen minimap box.

const MINIMAP_CAVE_COLOR = '#a89f91'





export class MinimapManager {
  private readonly geometry: MinimapGeometry
  menu: MinimapHostLike
  miniMapAlpha: number
  updatePlayerMiniMap: (owner: PlayerLike) => void
  updateResourcesMiniMap: () => void
  updateCameraMiniMap: () => void
  private active: boolean
  private initialized: boolean
  private layoutKey: string | null
  private unitAvatarCache: WeakMap<RuntimeEntity, HTMLCanvasElement>

  constructor(menu: MinimapHostLike) {
    this.menu = menu
    this.miniMapAlpha = 1.284 * MINIMAP_RESOLUTION_SCALE
    this.geometry = new MinimapGeometry(menu, () => this.miniMapAlpha)
    this.active = false
    this.initialized = false
    this.layoutKey = null
    this.unitAvatarCache = new WeakMap()

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

  private shouldDrawTerrainCell(cell: RuntimeCell): boolean {
    const space = this.geometry.getMinimapSpace()
    if (space.kind !== 'interior') return true
    return !cell.terrainHidden && cell.category !== 'Water'
  }

  private drawTerrainCell(context: CanvasRenderingContext2D, cell: RuntimeCell, transform: MinimapTransform): void {
    const point = this.geometry.cellToMinimapPoint(cell, transform)
    canvasDrawDiamond(
      context,
      point.x,
      transform.layout !== 'iso-diamond' ? point.y - CELL_HEIGHT / transform.factor / 2 : point.y,
      CELL_WIDTH / transform.factor + 1,
      CELL_HEIGHT / transform.factor + 1,
      terrainColor(cell)
    )
  }

  private clearCanvas(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, transform: MinimapTransform): void {
    context.clearRect(-transform.translate, 0, canvas.width, canvas.height)
  }

  private getUnitAvatar(unit: RuntimeEntity): HTMLCanvasElement | null {
    return getMinimapUnitAvatar(this.menu, this.unitAvatarCache, unit)
  }

  private drawUnitAvatarMarker(
    context: CanvasRenderingContext2D,
    unit: RuntimeEntity,
    x: number,
    y: number,
    squareSize: number,
    fallbackColor: string
  ): void {
    const avatar = this.getUnitAvatar(unit)
    if (!avatar) {
      canvasDrawRectangle(context, x - squareSize / 2, y - squareSize / 2, squareSize, squareSize, fallbackColor)
      return
    }

    const size = this.geometry.getUnitAvatarSize(squareSize)
    context.imageSmoothingEnabled = false
    context.drawImage(avatar, x - size / 2, y - size / 2, size, size)
  }

  private withMinimapViewSpace<T>(player: PlayerLike | null | undefined, callback: () => T): T {
    const space = this.geometry.getMinimapSpace()
    return withMinimapPlayerVision(player, space.id, callback)
  }

  private isInMinimapSpace(instance: RuntimeEntity | null | undefined): instance is RuntimeEntity {
    if (!instance) return false
    return getEntitySpaceId(instance) === this.geometry.getMinimapSpace().id
  }

  private clearPlayerLayers(): void {
    const layers = this.menu.playersMinimap
    layers.forEach(({ canvas }) => canvas.remove?.())
    layers.length = 0
  }

  getMinimapFactor(): number {
    return this.geometry.getMinimapFactor()
  }

  getMinimapParams(): { factor: number; translate: number } {
    return this.geometry.getMinimapParams()
  }

  getMinimapWorldPoint(
    clientX: number,
    clientY: number,
    rect: { height: number; left: number; top: number; width: number }
  ): {
    x: number
    y: number
  } {
    return this.geometry.getMinimapWorldPoint(clientX, clientY, rect)
  }

  initMiniMap(): void {
    if (!this.canDraw()) return
    const nextLayoutKey = this.geometry.getMinimapLayoutKey()
    if (this.initialized && this.layoutKey === nextLayoutKey) return
    if (this.initialized && this.layoutKey !== nextLayoutKey) this.clearPlayerLayers()

    const { menu } = this
    const transform = this.geometry.getMinimapTransform()
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
    const grid = this.geometry.getMinimapGrid()
    const size = this.geometry.getMinimapSize()
    const canvas = menu.terrainMinimap!
    const context = canvas.getContext('2d')!
    const transform = this.geometry.getMinimapTransform()

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
    const grid = this.geometry.getMinimapGrid()
    const size = this.geometry.getMinimapSize()
    const canvas = menu.terrainMinimap!
    const context = canvas.getContext('2d')!
    const transform = this.geometry.getMinimapTransform()

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
    const transform = this.geometry.getMinimapTransform()
    const cell = this.geometry.getMinimapGrid()[i]?.[j]
    if (!cell) return
    if (!this.shouldDrawTerrainCell(cell)) return

    const { map, player } = menu.context
    if (!map.revealEverything && !this.withMinimapViewSpace(player, () => player?.views?.isViewed(i, j))) return

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
    const transform = this.geometry.getMinimapTransform()
    const squareSize = this.geometry.getMarkerSquareSize(transform)
    const position = this.geometry.instanceToMinimapPoint(resource, transform)
    if (!position) return

    canvasDrawRectangle(
      context,
      position.x - squareSize / 2,
      position.y - squareSize / 2,
      squareSize,
      squareSize,
      resourceColor(resource)
    )
  }

  updateResourcesMiniMapEvt(): void {
    if (!this.canDraw()) return
    this.initMiniMap()
    const { menu } = this
    const { map, player } = menu.context
    const canvas = menu.resourcesMinimap!
    const context = canvas.getContext('2d')!
    const transform = this.geometry.getMinimapTransform()
    const squareSize = this.geometry.getMarkerSquareSize(transform)

    this.clearCanvas(context, canvas, transform)
    if (!map.showResources) return

    map.resources.forEach(resource => {
      if (!this.isInMinimapSpace(resource)) return
      if (
        resource.color &&
        (this.withMinimapViewSpace(player, () => Boolean(player?.views?.isViewed(resource.i, resource.j))) ||
          map.revealEverything)
      ) {
        const position = this.geometry.instanceToMinimapPoint(resource, transform)
        if (!position) return

        canvasDrawRectangle(
          context,
          position.x - squareSize / 2,
          position.y - squareSize / 2,
          squareSize,
          squareSize,
          resourceColor(resource)
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
    const transform = this.geometry.getMinimapTransform()
    const { factor } = transform
    const { visibleLeft, visibleTop, visibleWidth, visibleHeight } = controls.getViewportMetrics()

    this.clearCanvas(context, canvas, transform)
    canvasDrawStrokeRectangle(
      context,
      this.geometry.toMinimapX(visibleLeft - transform.originX, transform),
      this.geometry.toMinimapY(visibleTop - transform.originY, transform),
      visibleWidth / factor,
      visibleHeight / factor,
      'white'
    )
    drawMinimapQuestMarkers(context, menu, this.geometry, transform)
  }

  updatePlayerMiniMapEvt(owner: PlayerLike): void {
    if (!this.canDraw()) return
    this.initMiniMap()
    if (!owner) return

    const { menu } = this
    const { map, player } = menu.context
    const transform = this.geometry.getMinimapTransform()
    const { translate } = transform
    const squareSize = this.geometry.getMarkerSquareSize(transform)
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

    const personalVision = usesPersonalVision(menu.context)
    const isVisible = (instance: RuntimeEntity) =>
      map.revealEverything ||
      this.withMinimapViewSpace(player, () =>
        personalVision ? instanceIsInPlayerSight(instance, player) : playerCanSeeInstance(instance, player)
      )

    owner.buildings.forEach(building => {
      if (!this.isInMinimapSpace(building)) return
      if (!isVisible(building)) return
      const position = this.geometry.instanceToMinimapPoint(building, transform)
      if (!position) return
      const { size = 0, selected } = building
      const finalSize = this.geometry.getBuildingMarkerSize(size, squareSize)
      canvasDrawRectangle(
        context,
        position.x - finalSize / 2,
        position.y - finalSize / 2,
        finalSize,
        finalSize,
        selected ? 'white' : building.type === BUILDING_TYPES.cave ? MINIMAP_CAVE_COLOR : color
      )
    })
    if (!shouldDrawOwnerUnits) return

    owner.units.forEach(unit => {
      if (!isMinimapUnitMarker(unit)) return
      if (!this.isInMinimapSpace(unit)) return
      const position = this.geometry.instanceToMinimapPoint(unit, transform)
      if (!position) return
      const { selected } = unit
      this.drawUnitAvatarMarker(context, unit, position.x, position.y, squareSize, selected ? 'white' : color)
    })
  }
}
