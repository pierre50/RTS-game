import {
  throttle,
  throttleByKey,
  canvasDrawDiamond,
  canvasDrawRectangle,
  canvasDrawStrokeRectangle,
  playerCanSeeInstance,
} from '../../lib'
import { isOutsideSpaceId } from '../../lib/mapSpaces'
import { CELL_WIDTH, CELL_HEIGHT, FAMILY_TYPES } from '../../constants'
import type { MinimapHostLike } from '../../types/context'
import type { PlayerLike } from '../../types/player'
import type { ResourceEntity, RuntimeEntity } from '../../types/entities'

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

function isOutsideMinimapEntity(instance: RuntimeEntity | null | undefined): instance is RuntimeEntity {
  return Boolean(instance && isOutsideSpaceId(instance.spaceId))
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

  constructor(menu: MinimapHostLike) {
    this.menu = menu
    this.miniMapAlpha = 1.284 * MINIMAP_RESOLUTION_SCALE
    this.active = false
    this.initialized = false

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
  }

  isActive(): boolean {
    return this.active
  }

  private canDraw(): boolean {
    if (!this.active) return false
    this.menu.ensureMinimapCanvases?.()
    return Boolean(this.menu.terrainMinimap && this.menu.resourcesMinimap && this.menu.cameraMinimap)
  }

  private redrawMiniMap(): void {
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

  getMinimapFactor(): number {
    const { map } = this.menu.context
    return ((CELL_WIDTH / 2 + (map.size * CELL_WIDTH) / 2) / 234) * 2
  }

  getMinimapParams(): { factor: number; translate: number } {
    const factor = this.getMinimapFactor() / this.miniMapAlpha
    const translate = (CELL_WIDTH / 2 + (this.menu.context.map.size * CELL_WIDTH) / 2) / 2 / factor
    return { factor, translate }
  }

  initMiniMap(): void {
    if (!this.canDraw()) return
    if (this.initialized) return

    const { menu } = this
    const { map } = menu.context
    const { factor, translate } = this.getMinimapParams()

    for (const canvas of [menu.terrainMinimap!, menu.cameraMinimap!, menu.resourcesMinimap!]) {
      canvas.width = MINIMAP_BASE_WIDTH * MINIMAP_RESOLUTION_SCALE
      canvas.height = MINIMAP_BASE_HEIGHT * MINIMAP_RESOLUTION_SCALE
      canvas.getContext('2d')!.translate(translate, 0)
    }

    const N = map.size
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
  }

  revealTerrainMinimap(): void {
    if (!this.canDraw()) return
    const { menu } = this
    const { map } = menu.context
    const canvas = menu.terrainMinimap!
    const context = canvas.getContext('2d')!
    const { factor, translate } = this.getMinimapParams()

    context.clearRect(-translate, 0, canvas.width, canvas.height)
    for (let i = 0; i <= map.size; i++) {
      for (let j = 0; j <= map.size; j++) {
        const cell = map.grid[i][j]
        canvasDrawDiamond(
          context,
          cell.x / factor + translate,
          cell.y / factor,
          CELL_WIDTH / factor + 1,
          CELL_HEIGHT / factor + 1,
          terrainColor(cell.color)
        )
      }
    }
  }

  rebuildTerrainMiniMapFromViews(): void {
    if (!this.canDraw()) return
    const { menu } = this
    const { map, player } = menu.context
    const canvas = menu.terrainMinimap!
    const context = canvas.getContext('2d')!
    const { factor, translate } = this.getMinimapParams()

    context.clearRect(-translate, 0, canvas.width, canvas.height)
    if (!player?.views) return

    for (let i = 0; i <= map.size; i++) {
      for (let j = 0; j <= map.size; j++) {
        if (!player.views.isViewed(i, j)) continue
        const cell = map.grid[i][j]
        canvasDrawDiamond(
          context,
          cell.x / factor + translate,
          cell.y / factor,
          CELL_WIDTH / factor + 1,
          CELL_HEIGHT / factor + 1,
          terrainColor(cell.color)
        )
      }
    }
  }

  updateTerrainMiniMap(i: number, j: number): void {
    if (!this.canDraw()) return
    const { menu } = this
    const { map } = menu.context
    const canvas = menu.terrainMinimap!
    const context = canvas.getContext('2d')!
    const { factor, translate } = this.getMinimapParams()
    const cell = map.grid[i][j]

    canvasDrawDiamond(
      context,
      cell.x / factor + translate,
      cell.y / factor,
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
    const { menu } = this
    const { map } = menu.context
    if (!isOutsideMinimapEntity(resource)) return
    if (!map.showResources) return

    const context = menu.resourcesMinimap!.getContext('2d')!
    const { factor, translate } = this.getMinimapParams()
    const squareSize = 2 * MINIMAP_RESOLUTION_SCALE
    const position = getMinimapDrawPosition(resource)
    if (!position) return

    canvasDrawRectangle(
      context,
      position.x / factor - squareSize / 2 + translate,
      position.y / factor - squareSize / 2,
      squareSize,
      squareSize,
      resource.color ?? ''
    )
  }

  updateResourcesMiniMapEvt(): void {
    if (!this.canDraw()) return
    const { menu } = this
    const { map, player } = menu.context
    const canvas = menu.resourcesMinimap!
    const context = canvas.getContext('2d')!
    const { factor, translate } = this.getMinimapParams()
    const squareSize = 2 * MINIMAP_RESOLUTION_SCALE

    context.clearRect(-translate, 0, canvas.width, canvas.height)
    if (!map.showResources) return

    map.resources.forEach(resource => {
      if (!isOutsideMinimapEntity(resource)) return
      if (resource.color && (player?.views?.isViewed(resource.i, resource.j) || map.revealEverything)) {
        const position = getMinimapDrawPosition(resource)
        if (!position) return

        canvasDrawRectangle(
          context,
          position.x / factor - squareSize / 2 + translate,
          position.y / factor - squareSize / 2,
          squareSize,
          squareSize,
          resource.color
        )
      }
    })
  }

  updateCameraMiniMapEvt(): void {
    if (!this.canDraw()) return
    const { menu } = this
    const { controls } = menu.context
    const canvas = menu.cameraMinimap!
    const context = canvas.getContext('2d')!
    const { factor, translate } = this.getMinimapParams()
    const { visibleLeft, visibleTop, visibleWidth, visibleHeight } = controls.getViewportMetrics()

    context.clearRect(-translate, 0, canvas.width, canvas.height)
    canvasDrawStrokeRectangle(
      context,
      visibleLeft / factor + translate,
      visibleTop / factor,
      visibleWidth / factor,
      visibleHeight / factor,
      'white'
    )
  }

  updatePlayerMiniMapEvt(owner: PlayerLike): void {
    if (!this.canDraw()) return
    if (!owner) return

    const { menu } = this
    const { map, player } = menu.context
    const squareSize = 2 * MINIMAP_RESOLUTION_SCALE
    const { factor, translate } = this.getMinimapParams()
    const color = owner.colorHex
    const id = `minimap-${owner.label}`
    const shouldDrawOwner = map.revealEverything || owner.label === player?.label

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

    const isVisible = (instance: RuntimeEntity) => map.revealEverything || playerCanSeeInstance(instance, player)

    owner.buildings.forEach(building => {
      if (!isOutsideMinimapEntity(building)) return
      if (!isVisible(building)) return
      const position = getMinimapDrawPosition(building)
      if (!position) return
      const { size = 0, selected } = building
      const finalSize = squareSize + size * MINIMAP_RESOLUTION_SCALE
      canvasDrawRectangle(
        context,
        position.x / factor - finalSize / 2 + translate,
        position.y / factor - finalSize / 2,
        finalSize,
        finalSize,
        selected ? 'white' : color
      )
    })
    owner.units.forEach(unit => {
      if (!isMinimapUnitMarker(unit)) return
      if (!isOutsideMinimapEntity(unit)) return
      if (!isVisible(unit)) return
      const position = getMinimapDrawPosition(unit)
      if (!position) return
      const { selected } = unit
      canvasDrawRectangle(
        context,
        position.x / factor - squareSize / 2 + translate,
        position.y / factor - squareSize / 2,
        squareSize,
        squareSize,
        selected ? 'white' : color
      )
    })
  }
}
