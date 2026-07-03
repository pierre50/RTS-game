import {
  throttle,
  throttleByKey,
  canvasDrawDiamond,
  canvasDrawRectangle,
  canvasDrawStrokeRectangle,
  playerCanSeeInstance,
} from '../lib'
import { CELL_WIDTH, CELL_HEIGHT, FAMILY_TYPES } from '../constants'

type AnyRecord = Record<string, any>

export class MinimapManager {
  menu: AnyRecord
  miniMapAlpha: number
  updatePlayerMiniMap: (owner: AnyRecord) => void
  updateResourcesMiniMap: (...args: any[]) => void
  updateCameraMiniMap: (...args: any[]) => void

  constructor(menu: AnyRecord) {
    this.menu = menu
    this.miniMapAlpha = 1.284

    this.updatePlayerMiniMap = throttleByKey(
      this.updatePlayerMiniMapEvt.bind(this),
      500,
      (owner: AnyRecord) => owner?.label ?? owner
    )
    this.updateResourcesMiniMap = throttle(this.updateResourcesMiniMapEvt.bind(this), 500)
    this.updateCameraMiniMap = throttle(this.updateCameraMiniMapEvt.bind(this), 100)
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
    const { menu } = this
    const { map } = menu.context
    const { factor, translate } = this.getMinimapParams()

    for (const canvas of [menu.terrainMinimap, menu.cameraMinimap, menu.resourcesMinimap]) {
      canvas.getContext('2d').translate(translate, 0)
    }

    const N = map.size
    const canvasW = menu.terrainMinimap.width
    const canvasH = menu.terrainMinimap.height
    const centerX = 2 * translate
    const halfW = (N * CELL_WIDTH) / 2 / factor
    const halfH = (N * CELL_HEIGHT) / 2 / factor

    const px = (v: number) => `${((v / canvasW) * 100).toFixed(2)}%`
    const py = (v: number) => `${((v / canvasH) * 100).toFixed(2)}%`

    menu.bottombarMap.style.clipPath = `polygon(${px(centerX)} 0%, ${px(centerX + halfW)} ${py(halfH)}, ${px(centerX)} ${py(halfH * 2)}, ${px(centerX - halfW)} ${py(halfH)})`

    if (map.revealEverything || map.revealTerrain) {
      this.revealTerrainMinimap()
    }
  }

  revealTerrainMinimap(): void {
    const { menu } = this
    const { map } = menu.context
    const canvas = menu.terrainMinimap
    const context = canvas.getContext('2d')
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
          cell.color
        )
      }
    }
  }

  rebuildTerrainMiniMapFromViews(): void {
    const { menu } = this
    const { map, player } = menu.context
    const canvas = menu.terrainMinimap
    const context = canvas.getContext('2d')
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
          cell.color
        )
      }
    }
  }

  updateTerrainMiniMap(i: number, j: number): void {
    const { menu } = this
    const { map } = menu.context
    const canvas = menu.terrainMinimap
    const context = canvas.getContext('2d')
    const { factor, translate } = this.getMinimapParams()
    const cell = map.grid[i][j]

    canvasDrawDiamond(
      context,
      cell.x / factor + translate,
      cell.y / factor,
      CELL_WIDTH / factor + 1,
      CELL_HEIGHT / factor + 1,
      cell.color
    )
    if (cell.has && cell.has.family === FAMILY_TYPES.resource) {
      this.updateResourceMiniMap(cell.has)
    }
  }

  updateResourceMiniMap(resource: AnyRecord): void {
    const { menu } = this
    const { map } = menu.context
    if (!map.showResources) return

    const context = menu.resourcesMinimap.getContext('2d')
    const { factor, translate } = this.getMinimapParams()
    const squareSize = 4
    canvasDrawRectangle(
      context,
      resource.x / factor - squareSize / 2 + translate,
      resource.y / factor - squareSize / 2,
      squareSize,
      squareSize,
      resource.color
    )
  }

  updateResourcesMiniMapEvt(): void {
    const { menu } = this
    const { map, player } = menu.context
    const canvas = menu.resourcesMinimap
    const context = canvas.getContext('2d')
    const { factor, translate } = this.getMinimapParams()
    const squareSize = 4

    context.clearRect(-translate, 0, canvas.width, canvas.height)
    if (!map.showResources) return

    map.resources.forEach((resource: AnyRecord) => {
      if (resource.color && (player?.views?.isViewed(resource.i, resource.j) || map.revealEverything)) {
        canvasDrawRectangle(
          context,
          resource.x / factor - squareSize / 2 + translate,
          resource.y / factor - squareSize / 2,
          squareSize,
          squareSize,
          resource.color
        )
      }
    })
  }

  updateCameraMiniMapEvt(): void {
    const { menu } = this
    const { controls } = menu.context
    const canvas = menu.cameraMinimap
    const context = canvas.getContext('2d')
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

  updatePlayerMiniMapEvt(owner: AnyRecord): void {
    if (!owner) return

    const { menu } = this
    const { map, player } = menu.context
    const squareSize = 4
    const { factor, translate } = this.getMinimapParams()
    const color = owner.colorHex
    const id = `minimap-${owner.label}`

    let canvas: any, context: any
    const existing = menu.playersMinimap.find((p: AnyRecord) => p.id === id)
    if (existing) {
      canvas = existing.canvas
      context = existing.context
    } else {
      canvas = document.createElement('canvas')
      context = canvas.getContext('2d')
      context.translate(translate, 0)
      menu.playersMinimap.push({ id, canvas, context })
      menu.bottombarMap.appendChild(canvas)
    }

    context.clearRect(-translate, 0, canvas.width, canvas.height)

    const isVisible = (instance: AnyRecord) => map.revealEverything || playerCanSeeInstance(instance as any, player)

    owner.buildings.forEach((building: AnyRecord) => {
      if (!isVisible(building)) return
      const { x, y, size, selected } = building
      const finalSize = squareSize + size
      canvasDrawRectangle(
        context,
        x / factor - finalSize / 2 + translate,
        y / factor - finalSize / 2,
        finalSize,
        finalSize,
        selected ? 'white' : color
      )
    })
    owner.units.forEach((unit: AnyRecord) => {
      if (!isVisible(unit)) return
      const { x, y, selected } = unit
      canvasDrawRectangle(
        context,
        x / factor - squareSize / 2 + translate,
        y / factor - squareSize / 2,
        squareSize,
        squareSize,
        selected ? 'white' : color
      )
    })
  }
}
