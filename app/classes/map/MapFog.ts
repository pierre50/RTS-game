import { Container, Sprite, RenderTexture, Matrix } from 'pixi.js'
import type { ContainerChild, PointData, Texture } from 'pixi.js'
import { CELL_WIDTH, CELL_HEIGHT, CELL_DEPTH, FAMILY_TYPES, LABEL_TYPES } from '../../constants'
import { getTerrainSetZIndex } from '../../lib'
import type { RuntimeEntity } from '../../types/entities'
import type { Bounds, Viewport } from '../../types/geometry'
import type * as MapTypes from '../../types/map'
import type { PlayerLike } from '../../types/player'
import { _DW, _DH } from '../cell/CellFog'
import { Cell } from '../cell'
import { RuntimeCell, type RuntimeCellContext, type RuntimeCellSource } from '../cell/RuntimeCell'
import { getGaiaAnimals } from '../../lib'
import { ViewportFogRenderer } from './ViewportFogRenderer'

type PixiRendererLike = {
  gl?: { getParameter(parameter: number): number; MAX_TEXTURE_SIZE: number } | null
  render(options: { container: Container; target: RenderTexture; transform?: Matrix; clear?: boolean }): void
}

type TickerCallback = () => void

type FogPerformanceMonitor = {
  measure?<T>(name: string, callback: () => T): T
  record?(name: string, value: number): void
}

type FogMapContext = {
  app?: {
    renderer?: PixiRendererLike
    ticker: {
      add(callback: TickerCallback): void
      remove(callback: TickerCallback): void
    }
  }
  controls?: object | null
  editor?: object | null
  map?: object | null
  performance?: FogPerformanceMonitor | null
  player?: PlayerLike | null
  players?: PlayerLike[]
}

type FogCameraController = {
  getViewportRect(): Viewport
  visibleCells?: { clear(): void }
}

function getFogCameraController(controls: FogMapContext['controls']): FogCameraController | null {
  if (!controls || typeof controls !== 'object') return null
  const cameraController = (controls as { cameraController?: FogCameraController }).cameraController
  if (!cameraController || typeof cameraController !== 'object') return null
  if (typeof (cameraController as FogCameraController).getViewportRect !== 'function') return null
  return cameraController as FogCameraController
}

type TerrainAppearance = {
  waterBorder?: { resourceName: string; index: number } | null
  relief?: { index: number; elevation: number } | null
  patchBorders?: Iterable<string> | null
  patchBorderGroundType?: 'Desert' | 'Dirt' | 'Snow' | null
}

type TerrainDecoration = {
  texture: Texture
  label?: string
  position: PointData
  anchor: PointData
  zIndex: number
}

type FogGridCell = MapTypes.RuntimeCell & {
  context?: RuntimeCellContext
  family?: string
  isGenerationCell?: boolean
  terrainTextureName?: string
  terrainSet?: ContainerChild | null
  _terrainAppearance?: TerrainAppearance
  _hasFog?: boolean
  getChildByLabel?(label: string): ContainerChild | null
  removeChild?(child: ContainerChild): ContainerChild | void
  addChild?(child: ContainerChild): ContainerChild
  getTerrainDecorations?(): TerrainDecoration[]
  setWaterBorder?(resourceName: string, index: number): void
  setReliefBorder?(index: number, elevation: number): void
  setPatchBorder?(direction: string, groundType?: 'Desert' | 'Dirt' | 'Snow'): void
}

type FogContainerCell = FogGridCell & ContainerChild

type RelinkableInstance = RuntimeEntity & {
  currentCell?: FogGridCell | null
  dest?: FogGridCell | RuntimeEntity | null
  previousDest?: FogGridCell | RuntimeEntity | null
  path?: FogGridCell[]
}

type FogMapBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
  totalW: number
  totalH: number
}

type FogRuntimeMap = {
  size: number
  grid: FogGridCell[][]
  context: FogMapContext
  gaia?: Pick<PlayerLike, 'units'> | null
  resources: Iterable<RuntimeEntity>
  terrainBackfill?: Container | null
  revealEverything?: boolean
  revealTerrain?: boolean
  fogMemoryLayer?: Container | null
  fogLayer?: Container | null
  _fogQueue?: Map<FogGridCell, string>
  _pendingFogChunkUpdates?: Map<FogGridCell, string>
  _fogInitComplete?: boolean
  _fogChunks?: Array<{ cells?: FogGridCell[]; bounds?: Bounds }>
  _fogTickerCb?: TickerCallback | null
  _fogScratchEraseContainer?: Container | null
  terrainChunkManager?: { initialize(viewport?: Viewport): void }
  addChild<T extends ContainerChild>(child: T): T
  registerRenderChunk(displayObjects: ContainerChild | ContainerChild[], bounds: Bounds): object
}

type BackfillSpriteSource = ContainerChild & {
  texture: Texture
  anchor: Sprite['anchor']
  roundPixels: boolean
}

function isBackfillSpriteSource(source: ContainerChild): source is BackfillSpriteSource {
  return 'texture' in source && 'anchor' in source && 'roundPixels' in source
}

function isFogContainerCell(cell: FogGridCell): cell is FogContainerCell {
  return 'parent' in cell && 'destroy' in cell
}

function isRuntimeCellSource(cell: FogGridCell): cell is FogGridCell & RuntimeCellSource {
  return Boolean(cell.context?.map)
}

const FOG_VIEWPORT_UPDATE_MARGIN = CELL_WIDTH * 3

export class MapFog {
  map: FogRuntimeMap
  viewportRenderer: ViewportFogRenderer

  constructor(map: FogRuntimeMap) {
    this.map = map
    this.viewportRenderer = new ViewportFogRenderer(map)
  }

  bakeTerrainToChunks(): void {
    if (this.map.grid[0]?.[0]?.isGenerationCell) {
      this._materializeGenerationCells()
    }

    const renderer = this.map.context.app?.renderer
    if (!renderer) return
    const bakeStartedAt = performance.now()

    const { minX, minY, totalW, totalH } = this._getFogMapBounds()

    const gl = renderer.gl
    const maxTex = gl ? Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), 4096) : 4096
    const chunksX = Math.ceil(totalW / maxTex)
    const chunksY = Math.ceil(totalH / maxTex)
    const chunkW = totalW / chunksX
    const chunkH = totalH / chunksY

    const visibleStartedAt = performance.now()
    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        this.map.grid[i][j].visible = true
      }
    }
    this.map.context.performance?.record?.('terrainBake.markVisible', performance.now() - visibleStartedAt)

    const terrainContainer = new Container()
    terrainContainer.sortableChildren = true
    const backfillContainer = new Container()
    backfillContainer.label = 'terrainBackfillBake'
    backfillContainer.zIndex = -2
    backfillContainer.sortableChildren = true
    terrainContainer.addChild(backfillContainer)
    const backfillSprites: Sprite[] = []
    const terrainSets: ContainerChild[] = []
    const backfillStartedAt = performance.now()
    for (const source of this.map.terrainBackfill?.children || []) {
      if (!isBackfillSpriteSource(source)) continue
      const sprite = new Sprite(source.texture)
      sprite.position.copyFrom(source.position)
      sprite.anchor.copyFrom(source.anchor)
      sprite.roundPixels = source.roundPixels
      sprite.zIndex = source.zIndex
      sprite.eventMode = 'none'
      backfillContainer.addChild(sprite)
      backfillSprites.push(sprite)
    }
    this.map.context.performance?.record?.('terrainBake.backfill', performance.now() - backfillStartedAt)

    const collectStartedAt = performance.now()
    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        const set = cell.getChildByLabel?.(LABEL_TYPES.set)
        if (set) {
          cell.removeChild?.(set)
          set.x += cell.x
          set.y += cell.y
          set.zIndex = getTerrainSetZIndex(cell)
          cell.terrainSet = set
          terrainSets.push(set)
        }
        if (isFogContainerCell(cell)) terrainContainer.addChild(cell)
      }
    }
    this.map.context.performance?.record?.('terrainBake.collectCells', performance.now() - collectStartedAt)

    const renderStartedAt = performance.now()
    for (let cx = 0; cx < chunksX; cx++) {
      for (let cy = 0; cy < chunksY; cy++) {
        const cMinX = minX + cx * chunkW
        const cMinY = minY + cy * chunkH
        const cW = Math.ceil(cx === chunksX - 1 ? totalW - cx * chunkW : chunkW)
        const cH = Math.ceil(cy === chunksY - 1 ? totalH - cy * chunkH : chunkH)

        const rt = RenderTexture.create({ width: cW, height: cH })
        const transform = new Matrix().translate(-cMinX, -cMinY)
        renderer.render({ container: terrainContainer, target: rt, transform, clear: true })

        const sprite = new Sprite(rt)
        sprite.x = cMinX
        sprite.y = cMinY
        sprite.zIndex = -1
        sprite.eventMode = 'none'
        sprite.label = 'terrainChunk'
        sprite.roundPixels = true
        this.map.addChild(sprite)
        this.map.registerRenderChunk(sprite, {
          minX: cMinX,
          minY: cMinY,
          width: cW,
          height: cH,
        })
      }
    }
    this.map.context.performance?.record?.('terrainBake.renderTextures', performance.now() - renderStartedAt)

    const cleanupStartedAt = performance.now()
    for (const sprite of backfillSprites) sprite.destroy()
    backfillContainer.destroy()
    if (this.map.terrainBackfill) this.map.terrainBackfill.visible = false
    terrainSets.forEach(set => this.map.addChild(set))
    this.map.context.performance?.record?.('terrainBake.cleanup', performance.now() - cleanupStartedAt)

    if (!this.map.context.editor) {
      const compactStartedAt = performance.now()
      const replacements = new globalThis.Map<FogGridCell, RuntimeCell>()
      const runtimeCellsStartedAt = performance.now()
      for (let i = 0; i <= this.map.size; i++) {
        for (let j = 0; j <= this.map.size; j++) {
          const cell = this.map.grid[i][j]
          if (!isRuntimeCellSource(cell)) continue
          const runtimeCell = new RuntimeCell(cell)
          replacements.set(cell, runtimeCell)
          this.map.grid[i][j] = runtimeCell
        }
      }
      this.map.context.performance?.record?.('cellCompaction.runtimeCells', performance.now() - runtimeCellsStartedAt)

      const destroyStartedAt = performance.now()
      terrainContainer.destroy({ children: true, texture: false, textureSource: false })
      this.map.context.performance?.record?.(
        'cellCompaction.destroyTerrainContainer',
        performance.now() - destroyStartedAt
      )

      const instances = [
        ...getGaiaAnimals(this.map.gaia),
        ...(this.map.context.players ?? []).flatMap(owner => [...owner.units, ...owner.buildings, ...owner.corpses]),
        ...this.map.resources,
      ] as RelinkableInstance[]
      const replaceCell = (cell: FogGridCell): FogGridCell => replacements.get(cell) || cell
      const relinkStartedAt = performance.now()
      for (const instance of instances) {
        if (instance.currentCell) instance.currentCell = replaceCell(instance.currentCell)
        if (instance.dest?.family === FAMILY_TYPES.cell) instance.dest = replaceCell(instance.dest as FogGridCell)
        if (instance.previousDest?.family === FAMILY_TYPES.cell)
          instance.previousDest = replaceCell(instance.previousDest as FogGridCell)
        if (instance.path?.length) instance.path = instance.path.map(replaceCell)
      }
      this.map.context.performance?.record?.('cellCompaction.instanceRelinks', performance.now() - relinkStartedAt)

      const indexStartedAt = performance.now()
      getFogCameraController(this.map.context.controls)?.visibleCells?.clear()
      this._indexFogChunkCells()
      this.map.context.performance?.record?.('cellCompaction.reindexFog', performance.now() - indexStartedAt)
      this.map.context.performance?.record?.('cellCompaction', performance.now() - compactStartedAt)
      this.map.terrainChunkManager?.initialize(getFogCameraController(this.map.context.controls)?.getViewportRect())
    }

    const { player } = this.map.context
    if (!player) return
    const updateViewedStartedAt = performance.now()
    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        if (player.views.isViewed(i, j)) {
          cell.updateVisible()
        }
      }
    }
    this.map.context.performance?.record?.('terrainBake.updateViewedCells', performance.now() - updateViewedStartedAt)

    this.map.context.performance?.record?.('terrainBake', performance.now() - bakeStartedAt)
  }

  _materializeGenerationCells(): void {
    const startedAt = performance.now()
    const cellsStartedAt = performance.now()
    const replacements = new globalThis.Map<FogGridCell, Cell>()
    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const source = this.map.grid[i][j]
        if (!source?.isGenerationCell) continue
        const cell = new Cell(
          {
            i: source.i,
            j: source.j,
            z: source.z,
            type: source.type,
            textureName: source.terrainTextureName,
            fogSprites: source.fogSprites,
            skipFog: true,
          },
          this.map.context as ConstructorParameters<typeof Cell>[1]
        )
        cell.solid = source.solid
        cell.visible = source.visible
        cell.inclined = source.inclined ?? false
        cell.border = source.border ?? false
        cell.waterBorder = source.waterBorder ?? false
        cell.viewed = source.viewed ?? false
        cell.viewBy = source.viewBy
        cell.has = source.has
        cell.corpses = source.corpses
        cell._hasFog = source._hasFog ?? false

        replacements.set(source, cell)
        this.map.grid[i][j] = cell
      }
    }
    this.map.context.performance?.record?.('generationCellMaterialization.cells', performance.now() - cellsStartedAt)

    const appearanceStartedAt = performance.now()
    for (const [source, cell] of replacements) {
      const appearance = source._terrainAppearance ?? {}
      if (appearance.waterBorder) cell.setWaterBorder(appearance.waterBorder.resourceName, appearance.waterBorder.index)
      if (appearance.relief) cell.setReliefBorder(appearance.relief.index, appearance.relief.elevation)
      for (const direction of appearance.patchBorders ?? []) {
        cell.setPatchBorder(direction, appearance.patchBorderGroundType ?? undefined)
      }
    }
    this.map.context.performance?.record?.(
      'generationCellMaterialization.appearance',
      performance.now() - appearanceStartedAt
    )

    const decorationsStartedAt = performance.now()
    for (const [source, cell] of replacements) {
      for (const decoration of source.getTerrainDecorations?.() ?? []) {
        const sprite = new Sprite(decoration.texture)
        if (decoration.label !== undefined) sprite.label = decoration.label
        sprite.position.copyFrom(decoration.position)
        sprite.anchor.copyFrom(decoration.anchor)
        sprite.roundPixels = true
        sprite.eventMode = 'none'
        sprite.zIndex = decoration.zIndex
        cell.addChild(sprite)
      }
    }
    this.map.context.performance?.record?.(
      'generationCellMaterialization.decorations',
      performance.now() - decorationsStartedAt
    )

    const relinkStartedAt = performance.now()
    const replaceCell = (cell: FogGridCell): FogGridCell => replacements.get(cell) || cell
    const instances = [
      ...getGaiaAnimals(this.map.gaia),
      ...(this.map.context.players ?? []).flatMap(owner => [...owner.units, ...owner.buildings, ...owner.corpses]),
      ...this.map.resources,
    ] as RelinkableInstance[]
    for (const instance of instances) {
      if (instance.currentCell) instance.currentCell = replaceCell(instance.currentCell)
      if (instance.dest?.family === FAMILY_TYPES.cell) instance.dest = replaceCell(instance.dest as FogGridCell)
      if (instance.previousDest?.family === FAMILY_TYPES.cell)
        instance.previousDest = replaceCell(instance.previousDest as FogGridCell)
      if (instance.path?.length) instance.path = instance.path.map(replaceCell)
    }
    this.map.context.performance?.record?.(
      'generationCellMaterialization.instanceRelinks',
      performance.now() - relinkStartedAt
    )
    this.map.context.performance?.record?.('generationCellMaterialization', performance.now() - startedAt)
  }

  _initFogChunks(): void {
    this.destroyFogResources()
    this.map._fogQueue = new globalThis.Map()
    this.map._pendingFogChunkUpdates = new globalThis.Map()
    this.map._fogInitComplete = false
    this.map._fogChunks = []
    this.viewportRenderer.initialize()

    this.map._fogTickerCb = () => {
      if (this.map.context.map !== this.map) {
        this.map.context.app?.ticker.remove(this.map._fogTickerCb!)
        return
      }
      const flush = () => this._flushFogQueue()
      this.map.context.performance?.measure?.('fog.flushQueue', flush) ?? flush()
    }
    this.map.context.app?.ticker.add(this.map._fogTickerCb)
  }

  _getFogMapBounds(): FogMapBounds {
    if (!this.map.grid.length) {
      const margin = CELL_WIDTH + CELL_DEPTH * 4
      const minX = -this.map.size * (CELL_WIDTH / 2) - margin
      const minY = -margin
      const maxX = this.map.size * (CELL_WIDTH / 2) + margin
      const maxY = this.map.size * CELL_HEIGHT + margin
      return { minX, minY, maxX, maxY, totalW: maxX - minX, totalH: maxY - minY }
    }

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i]?.[j]
        if (!cell) continue
        const bounds = this._getFogCellBounds(cell)
        minX = Math.min(minX, bounds.minX)
        minY = Math.min(minY, bounds.minY)
        maxX = Math.max(maxX, bounds.maxX)
        maxY = Math.max(maxY, bounds.maxY)
      }
    }

    const margin = CELL_DEPTH
    minX -= margin
    minY -= margin
    maxX += margin
    maxY += margin
    return { minX, minY, maxX, maxY, totalW: maxX - minX, totalH: maxY - minY }
  }

  _getFogCellBounds(cell: Pick<FogGridCell, 'x' | 'y'>): Omit<FogMapBounds, 'totalW' | 'totalH'> {
    const hw = _DW / 2
    const hh = _DH / 2
    return {
      minX: cell.x - hw,
      minY: cell.y - hh,
      maxX: cell.x + hw,
      maxY: cell.y + hh,
    }
  }

  _indexFogChunkCells(): void {
    this.viewportRenderer.invalidate()
  }

  _flushFogQueue(): void {
    const fogQueue = this.map._fogQueue
    if (!fogQueue || fogQueue.size === 0) {
      this.map._pendingFogChunkUpdates?.clear()
      return
    }

    const viewport = getFogCameraController(this.map.context.controls)?.getViewportRect()
    const updateViewportFog = this._fogQueueTouchesViewport(fogQueue, viewport)
    fogQueue.clear()
    this.map._pendingFogChunkUpdates?.clear()

    if (updateViewportFog) {
      this.viewportRenderer.invalidate()
      this.viewportRenderer.update(viewport)
    }
  }

  _fogQueueTouchesViewport(fogQueue: Map<FogGridCell, string>, viewport?: Viewport | null): boolean {
    if (!viewport) return false
    const left = viewport.visibleLeft - FOG_VIEWPORT_UPDATE_MARGIN
    const top = viewport.visibleTop - FOG_VIEWPORT_UPDATE_MARGIN
    const right = viewport.visibleLeft + viewport.visibleWidth + FOG_VIEWPORT_UPDATE_MARGIN
    const bottom = viewport.visibleTop + viewport.visibleHeight + FOG_VIEWPORT_UPDATE_MARGIN

    for (const cell of fogQueue.keys()) {
      if (!cell) continue
      const bounds = this._getFogCellBounds(cell)
      if (bounds.maxX >= left && bounds.minX <= right && bounds.maxY >= top && bounds.minY <= bottom) {
        return true
      }
    }
    return false
  }

  destroyFogResources(): void {
    if (this.map._fogTickerCb) {
      this.map.context.app?.ticker.remove(this.map._fogTickerCb)
      this.map._fogTickerCb = null
    }
    this.map._fogChunks = []
    this.map._fogScratchEraseContainer?.destroy({ children: true })
    this.map._fogScratchEraseContainer = null
    this.viewportRenderer.destroy()
  }
}
