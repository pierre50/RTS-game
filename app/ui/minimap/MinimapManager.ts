import { CELL_HEIGHT, CELL_WIDTH } from '../../constants'
import { canvasDrawDiamond, throttle } from '../../lib'
import { getInteriorExitCell } from '../../lib/buildings/interiorExits'
import { getActiveMapSpace } from '../../lib/mapSpaces'
import type { MinimapHostLike } from '../../types/context'
import type { ResourceEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import type { PlayerLike } from '../../types/player'
import { MinimapBuildingKnowledge } from './MinimapBuildingKnowledge'
import { drawMinimapRoads } from './MinimapRoads'
import { drawMinimapQuestMarkers } from './MinimapQuestMarkers'
import { MinimapNaturalResources } from './MinimapNaturalResources'
import { terrainColor } from './MinimapColors'
import { drawMinimapEntities } from './MinimapEntityLayer'
import { isMinimapMarkerHidden } from './MinimapFilters'
import { getMinimapElement, MINIMAP_RESOLUTION_SCALE, MinimapGeometry, type MinimapTransform } from './MinimapGeometry'
import { drawMinimapMarker } from './MinimapMarkers'
import {
  minimapSampleIntersectsViewport,
  minimapTerrainSampling,
  terrainSampleKey,
  type MinimapDisplaySize,
} from './MinimapTerrainSampling'
import { withMinimapPlayerVision } from './MinimapVisibility'
import { getMinimapPlaceScale, getMinimapZoom } from './MinimapZoom'

// Canvases default to the HTML intrinsic 300x150 raster; the world->pixel math below
// (miniMapAlpha, the /234 reference in getMinimapFactor) is tuned to fill that box
// edge-to-edge. MINIMAP_RESOLUTION_SCALE renders at a multiple of that same reference
// size so the diamond still fills the canvas exactly, just at a crisper resolution
// once CSS stretches it to the (now larger) on-screen minimap box.

const MAX_REMEMBERED_TERRAIN_SAMPLES = 131072

export class MinimapManager {
  private readonly buildingKnowledge = new MinimapBuildingKnowledge()
  private readonly naturalResources = new MinimapNaturalResources()
  private readonly geometry: MinimapGeometry
  menu: MinimapHostLike
  miniMapAlpha: number
  updatePlayerMiniMap: (owner?: PlayerLike) => void
  updateResourcesMiniMap: () => void
  updateCameraMiniMap: () => void
  private displaySize?: MinimapDisplaySize
  private resizeObserver?: ResizeObserver
  private active: boolean
  private initialized: boolean
  private layoutKey: string | null
  private readonly paintedTerrainSamples = new Set<string>()
  private readonly exploredSamples = new WeakMap<RuntimeCell[][], Map<string, { i: number; j: number }>>()

  constructor(menu: MinimapHostLike) {
    this.menu = menu
    this.miniMapAlpha = 1.284 * MINIMAP_RESOLUTION_SCALE
    this.geometry = new MinimapGeometry(menu, () => this.miniMapAlpha)
    this.active = false
    this.initialized = false
    this.layoutKey = null

    // Entity notifications refresh only the lightweight marker overlay while open.
    this.updatePlayerMiniMap = throttle(() => this.updatePlayerMiniMapEvt(), 100)
    this.updateResourcesMiniMap = () => {}
    this.updateCameraMiniMap = throttle(this.updateCameraMiniMapEvt.bind(this), 100)
  }

  activate(): void {
    this.geometry.resetZoomAnchor()
    this.active = true
    this.initMiniMap()
    this.redrawMiniMap()
    if (!this.resizeObserver && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        const rect = getMinimapElement(this.menu).getBoundingClientRect()
        if (rect.width !== this.displaySize?.width || rect.height !== this.displaySize?.height) this.refreshMiniMap()
      })
      this.resizeObserver.observe(getMinimapElement(this.menu))
    }
  }

  deactivate(): void {
    this.active = false
    this.resizeObserver?.disconnect()
    this.resizeObserver = undefined
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
    const { map } = this.menu.context
    if (map.revealEverything || map.revealTerrain) {
      this.revealTerrainMinimap()
    } else {
      this.rebuildTerrainMiniMapFromViews()
    }
    this.updateCameraMiniMapEvt()
  }

  private shouldDrawTerrainCell(cell: RuntimeCell): boolean {
    const space = this.geometry.getMinimapSpace()
    if (space.kind !== 'interior') return true
    return !cell.terrainHidden && cell.category !== 'Water'
  }

  private drawTerrainCell(
    context: CanvasRenderingContext2D,
    cell: RuntimeCell,
    transform: MinimapTransform,
    step = 1
  ): void {
    const point = this.geometry.cellToMinimapPoint(cell, transform)
    if (step > 1) {
      const di = Math.floor(cell.i / step) * step + (step - 1) / 2 - cell.i
      const dj = Math.floor(cell.j / step) * step + (step - 1) / 2 - cell.j
      point.x += ((di - dj) * CELL_WIDTH) / 2 / transform.factor
      point.y += ((di + dj) * CELL_HEIGHT) / 2 / transform.factor
    }
    this.paintedTerrainSamples.add(terrainSampleKey(cell.i, cell.j, step))
    const color = terrainColor(cell)
    canvasDrawDiamond(
      context,
      point.x,
      transform.layout !== 'iso-diamond' ? point.y - CELL_HEIGHT / transform.factor / 2 : point.y,
      (CELL_WIDTH * step) / transform.factor + 1,
      (CELL_HEIGHT * step) / transform.factor + 1,
      color
    )
  }

  private clearCanvas(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, transform: MinimapTransform): void {
    context.clearRect(-transform.translate, 0, canvas.width, canvas.height)
  }

  private withMinimapViewSpace<T>(player: PlayerLike | null | undefined, callback: () => T): T {
    const space = this.geometry.getMinimapSpace()
    return withMinimapPlayerVision(player, space.id, callback)
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
    this.clearPlayerLayers()
    this.paintedTerrainSamples.clear()

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
      const halfW = (N * CELL_WIDTH) / 2 / (factor * getMinimapZoom(menu.context))
      const halfH = (N * CELL_HEIGHT) / 2 / (factor * getMinimapZoom(menu.context))

      const px = (v: number) => `${((v / canvasW) * 100).toFixed(2)}%`
      const py = (v: number) => `${((v / canvasH) * 100).toFixed(2)}%`

      minimapElement.style.clipPath = `polygon(${px(centerX)} 0%, ${px(centerX + halfW)} ${py(halfH)}, ${px(centerX)} ${py(halfH * 2)}, ${px(centerX - halfW)} ${py(halfH)})`
    }
    this.initialized = true
    this.layoutKey = nextLayoutKey
  }

  private sampleMemory(grid: RuntimeCell[][]): Map<string, { i: number; j: number }> {
    let memory = this.exploredSamples.get(grid)
    if (!memory) {
      memory = new Map()
      this.exploredSamples.set(grid, memory)
    }
    return memory
  }

  revealTerrainMinimap(): void {
    this.rebuildTerrain(true)
  }

  rebuildTerrainMiniMapFromViews(): void {
    this.rebuildTerrain(false)
  }

  private rebuildTerrain(reveal: boolean): void {
    if (!this.canDraw()) return
    const rect = getMinimapElement(this.menu).getBoundingClientRect?.()
    this.displaySize = rect
      ? {
          width: rect.width,
          height: rect.height,
          pixelRatio: typeof window === 'undefined' ? 1 : window.devicePixelRatio,
        }
      : undefined
    this.initMiniMap()
    const grid = this.geometry.getMinimapGrid()
    const size = this.geometry.getMinimapSize()
    const canvas = this.menu.terrainMinimap!
    const context = canvas.getContext('2d')!
    const transform = this.geometry.getMinimapTransform()
    const plan = minimapTerrainSampling(transform, this.displaySize)
    const { step } = plan
    const memory = this.sampleMemory(grid)
    const player = this.menu.context.player
    const representatives = new Map<string, { i: number; j: number }>()
    this.clearCanvas(context, canvas, transform)
    this.paintedTerrainSamples.clear()
    this.withMinimapViewSpace(player, () => {
      for (const sample of memory.values()) {
        if (sample.i < plan.minI || sample.i > plan.maxI || sample.j < plan.minJ || sample.j > plan.maxJ) continue
        if (!reveal && !player?.views?.isViewed(sample.i, sample.j)) continue
        representatives.set(terrainSampleKey(sample.i, sample.j, step), sample)
      }
      for (let i = plan.minI; i <= plan.maxI; i += step) {
        for (let j = plan.minJ; j <= plan.maxJ; j += step) {
          if (!minimapSampleIntersectsViewport(i, j, step, transform)) continue
          const key = terrainSampleKey(i, j, step)
          // Remember discoveries between refreshes, even if a narrow explored path
          // falls between the overview's regular samples. Never retain cell objects.
          const sample = !reveal && representatives.get(key)
          const si = sample ? sample.i : Math.min(size, i + Math.floor(step / 2))
          const sj = sample ? sample.j : Math.min(size, j + Math.floor(step / 2))
          if (!reveal && !player?.views?.isViewed(si, sj)) continue
          const cell = grid[si]?.[sj]
          if (!cell || !this.shouldDrawTerrainCell(cell)) continue
          this.drawTerrainCell(context, cell, transform, step)
        }
      }
    })
  }

  updateTerrainMiniMap(i: number, j: number): void {
    if (!this.canDraw()) return
    this.initMiniMap()
    const { map, player } = this.menu.context
    if (
      !map.revealEverything &&
      !map.revealTerrain &&
      !this.withMinimapViewSpace(player, () => player?.views?.isViewed(i, j))
    )
      return
    const grid = this.geometry.getMinimapGrid()
    const cell = grid[i]?.[j]
    if (!cell || !this.shouldDrawTerrainCell(cell)) return
    this.updatePlayerMiniMap()
    const transform = this.geometry.getMinimapTransform()
    const plan = minimapTerrainSampling(transform, this.displaySize)
    const { step } = plan
    const key = terrainSampleKey(i, j, step)
    const memory = this.sampleMemory(grid)
    const previous = memory.get(key)
    // One representative per overview sample: movement does not repaint the
    // same subpixel terrain thousands of times.
    const sample = previous ?? { i, j }
    if (previous && this.paintedTerrainSamples.has(key)) return
    if (memory.size >= MAX_REMEMBERED_TERRAIN_SAMPLES && !memory.has(key)) {
      const oldest = memory.keys().next().value
      if (oldest !== undefined) memory.delete(oldest)
    }
    memory.set(key, sample)
    if (i < plan.minI || i > plan.maxI || j < plan.minJ || j > plan.maxJ) return
    const sampleCell = grid[sample.i]?.[sample.j]
    if (sampleCell) this.drawTerrainCell(this.menu.terrainMinimap!.getContext('2d')!, sampleCell, transform, step)
  }

  updateResourceMiniMap(_resource: ResourceEntity): void {}

  updateResourcesMiniMapEvt(): void {}

  updateCameraMiniMapEvt(): void {
    if (!this.canDraw()) return
    this.initMiniMap()
    const { menu } = this
    const canvas = menu.cameraMinimap!
    const context = canvas.getContext('2d')!
    const transform = this.geometry.getMinimapTransform()
    this.clearCanvas(context, canvas, transform)
    const viewport = menu.context.controls.getViewportMetrics?.()
    if (viewport && viewport.visibleWidth > 0 && viewport.visibleHeight > 0) {
      const x = this.geometry.toMinimapX(viewport.visibleLeft - transform.originX, transform)
      const y = this.geometry.toMinimapY(viewport.visibleTop - transform.originY, transform)
      context.save()
      context.fillStyle = 'rgba(0, 0, 0, 0.35)'
      context.fillRect(-transform.translate, 0, canvas.width, canvas.height)
      context.clearRect(x, y, viewport.visibleWidth / transform.factor, viewport.visibleHeight / transform.factor)
      context.restore()
    }
    this.updatePlayerMiniMapEvt()
  }

  updatePlayerMiniMapEvt(_owner?: PlayerLike): void {
    const { player: observer, players: owners, map: world } = this.menu.context
    if (world.ready === false) return // Do not erase observations while saved entities are still being restored.
    const activeSpace = getActiveMapSpace(world)
    if (!observer || !activeSpace) return
    const knownBuildings = world.revealEverything ? [] : this.buildingKnowledge.update(observer, owners, activeSpace)
    if (!this.canDraw()) return
    this.initMiniMap()
    const { map, player } = this.menu.context
    const canvas = this.menu.resourcesMinimap!
    const context = canvas.getContext('2d')!
    const transform = this.geometry.getMinimapTransform()
    const space = this.geometry.getMinimapSpace()
    this.clearCanvas(context, canvas, transform)
    const redraw = () => this.updatePlayerMiniMap()
    const exitCell = getInteriorExitCell(map)
    if (exitCell && !isMinimapMarkerHidden(this.menu.context, 'exit')) {
      drawMinimapMarker(
        context,
        'exit',
        this.geometry.cellToMinimapPoint(exitCell, transform),
        '#27865c',
        redraw,
        false,
        getMinimapPlaceScale(this.menu.context)
      )
    }
    this.withMinimapViewSpace(player, () => {
      drawMinimapRoads(this.menu, this.geometry, transform, space.id, context)
      this.naturalResources.draw(this.menu, this.geometry, transform, space.id, context)
      drawMinimapEntities(this.menu, this.geometry, knownBuildings, transform, space, context, redraw)
    })
    drawMinimapQuestMarkers(this.menu, this.geometry, transform, context)
  }
}
