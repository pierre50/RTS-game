import { Container, Sprite, RenderTexture, Matrix } from 'pixi.js'
import type { ContainerChild, PointData, Texture } from 'pixi.js'
import { CELL_WIDTH, CELL_HEIGHT, CELL_DEPTH, FAMILY_TYPES, LABEL_TYPES } from '../../../constants'
import { getTerrainSetZIndex } from '../../../lib'
import type { RuntimeEntity } from '../../../types/entities'
import type { Bounds, Viewport } from '../../../types/geometry'
import type * as MapTypes from '../../../types/map'
import type { PlayerLike } from '../../../types/player'
import { TerrainBakeCell } from '../../cell/TerrainBakeCell'
import { RuntimeCell, type RuntimeCellContext, type RuntimeCellSource } from '../../cell/RuntimeCell'
import { getGaiaAnimals } from '../../../lib'
import { getTerrainBakeChunkRects } from '../../../lib/graphics/terrainBakeChunks'

type PixiRendererLike = {
  gl?: { getParameter(parameter: number): number; MAX_TEXTURE_SIZE: number } | null
  render(options: { container: Container; target: RenderTexture; transform?: Matrix; clear?: boolean }): void
}

type TerrainPerformanceMonitor = {
  measure?<T>(name: string, callback: () => T): T
  record?(name: string, value: number): void
}

type TerrainMapContext = {
  app?: {
    renderer?: PixiRendererLike
  }
  controls?: object | null
  editor?: object | null
  map?: object | null
  performance?: TerrainPerformanceMonitor | null
  player?: PlayerLike | null
  players?: PlayerLike[]
}

type TerrainCameraController = {
  getViewportRect(): Viewport
  visibleCells?: { clear(): void }
}

function getTerrainCameraController(controls: TerrainMapContext['controls']): TerrainCameraController | null {
  if (!controls || typeof controls !== 'object') return null
  const cameraController = (controls as { cameraController?: TerrainCameraController }).cameraController
  if (!cameraController || typeof cameraController !== 'object') return null
  if (typeof (cameraController as TerrainCameraController).getViewportRect !== 'function') return null
  return cameraController as TerrainCameraController
}

type TerrainAppearance = {
  waterBorder?: { resourceName: string; index: number } | null
  relief?: { index: number; elevation: number } | null
  patchBorders?: Iterable<string> | null
  patchBorderGroundType?: 'Desert' | 'DarkForest' | 'Dirt' | 'Jungle' | 'Snow' | null
}

type TerrainDecoration = {
  texture: Texture
  label?: string
  position: PointData
  anchor: PointData
  zIndex: number
}

type TerrainGridCell = MapTypes.RuntimeCell & {
  context?: RuntimeCellContext
  family?: string
  isGenerationCell?: boolean
  terrainTextureName?: string
  terrainSet?: ContainerChild | null
  _terrainAppearance?: TerrainAppearance
  getChildByLabel?(label: string): ContainerChild | null
  removeChild?(child: ContainerChild): ContainerChild | void
  addChild?(child: ContainerChild): ContainerChild
  getTerrainDecorations?(): TerrainDecoration[]
  getTerrainBakeChildren?(): ContainerChild[]
  setWaterBorder?(resourceName: string, index: number): void
  setReliefBorder?(index: number, elevation: number): void
  setPatchBorder?(direction: string, groundType?: 'Desert' | 'DarkForest' | 'Dirt' | 'Jungle' | 'Snow'): void
}

type TerrainContainerCell = TerrainGridCell & ContainerChild

type RelinkableInstance = RuntimeEntity & {
  currentCell?: TerrainGridCell | null
  dest?: TerrainGridCell | RuntimeEntity | null
  previousDest?: TerrainGridCell | RuntimeEntity | null
  path?: TerrainGridCell[]
}

type TerrainMapBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
  totalW: number
  totalH: number
}

type TerrainRuntimeMap = {
  size: number
  grid: TerrainGridCell[][]
  context: TerrainMapContext
  gaia?: Pick<PlayerLike, 'units'> | null
  resources: Iterable<RuntimeEntity>
  terrainBackfill?: Container | null
  revealEverything?: boolean
  revealTerrain?: boolean
  terrainChunkManager?: { initialize(viewport?: Viewport): void }
  addChild<T extends ContainerChild>(child: T): T
  registerRenderChunk(displayObjects: ContainerChild | ContainerChild[], bounds: Bounds): object
}

type BackfillSpriteSource = ContainerChild & {
  texture: Texture
  anchor: Sprite['anchor']
  roundPixels: boolean
}

type TerrainBakeContainers = {
  terrainContainer: Container
  backfillContainer: Container
  backfillSprites: Sprite[]
  terrainSets: ContainerChild[]
}

function isBackfillSpriteSource(source: ContainerChild): source is BackfillSpriteSource {
  return 'texture' in source && 'anchor' in source && 'roundPixels' in source
}

function isTerrainContainerCell(cell: TerrainGridCell): cell is TerrainContainerCell {
  return 'parent' in cell && 'destroy' in cell
}

function isRuntimeCellSource(cell: TerrainGridCell): cell is TerrainGridCell & RuntimeCellSource {
  return Boolean(cell.context?.map)
}

export class MapTerrainBake {
  map: TerrainRuntimeMap

  constructor(map: TerrainRuntimeMap) {
    this.map = map
  }

  _markTerrainCellsVisible(): void {
    const visibleStartedAt = performance.now()
    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        if (cell) cell.visible = true
      }
    }
    this.map.context.performance?.record?.('terrainBake.markVisible', performance.now() - visibleStartedAt)
  }

  _createTerrainBakeContainers(): TerrainBakeContainers {
    const terrainContainer = new Container()
    terrainContainer.sortableChildren = true
    const backfillContainer = new Container()
    backfillContainer.label = 'terrainBackfillBake'
    backfillContainer.zIndex = -2
    backfillContainer.sortableChildren = true
    terrainContainer.addChild(backfillContainer)
    return { terrainContainer, backfillContainer, backfillSprites: [], terrainSets: [] }
  }

  _copyTerrainBackfill({ backfillContainer, backfillSprites }: TerrainBakeContainers): void {
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
  }

  _collectTerrainBakeCells({ terrainContainer, terrainSets }: TerrainBakeContainers): void {
    const collectStartedAt = performance.now()
    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        if (!cell) continue
        const set = cell.getChildByLabel?.(LABEL_TYPES.set)
        if (set) {
          cell.removeChild?.(set)
          set.x += cell.x
          set.y += cell.y
          set.zIndex = getTerrainSetZIndex(cell)
          cell.terrainSet = set
          terrainSets.push(set)
        }
        const bakeChildren = cell.getTerrainBakeChildren?.()
        if (bakeChildren?.length) terrainContainer.addChild(...bakeChildren)
        else if (isTerrainContainerCell(cell)) terrainContainer.addChild(cell)
      }
    }
    this.map.context.performance?.record?.('terrainBake.collectCells', performance.now() - collectStartedAt)
  }

  _renderTerrainChunks(
    renderer: PixiRendererLike,
    terrainContainer: Container,
    bounds: Pick<TerrainMapBounds, 'minX' | 'minY' | 'totalW' | 'totalH'>,
    maxTex: number
  ): void {
    const chunks = getTerrainBakeChunkRects(
      { minX: bounds.minX, minY: bounds.minY, width: bounds.totalW, height: bounds.totalH },
      maxTex
    )
    const renderStartedAt = performance.now()

    for (const chunk of chunks) {
      const rt = RenderTexture.create({ width: chunk.width, height: chunk.height })
      const transform = new Matrix().translate(-chunk.minX, -chunk.minY)
      renderer.render({ container: terrainContainer, target: rt, transform, clear: true })

      const sprite = new Sprite(rt)
      sprite.x = chunk.minX
      sprite.y = chunk.minY
      sprite.zIndex = -1
      sprite.eventMode = 'none'
      sprite.label = 'terrainChunk'
      sprite.roundPixels = true
      this.map.addChild(sprite)
      this.map.registerRenderChunk(sprite, chunk)
    }
    this.map.context.performance?.record?.('terrainBake.renderTextures', performance.now() - renderStartedAt)
  }

  _cleanupTerrainBakeContainers({
    terrainContainer,
    backfillContainer,
    backfillSprites,
    terrainSets,
  }: TerrainBakeContainers): void {
    const cleanupStartedAt = performance.now()
    for (const sprite of backfillSprites) sprite.destroy()
    backfillContainer.destroy()
    if (this.map.terrainBackfill) this.map.terrainBackfill.visible = false
    terrainSets.forEach(set => this.map.addChild(set))
    this.map.context.performance?.record?.('terrainBake.cleanup', performance.now() - cleanupStartedAt)
    if (this.map.context.editor) return

    const compactStartedAt = performance.now()
    this._compactTerrainCells(terrainContainer)
    this.map.context.performance?.record?.('cellCompaction', performance.now() - compactStartedAt)
  }

  _compactTerrainCells(terrainContainer: Container): void {
    const replacements = new globalThis.Map<TerrainGridCell, RuntimeCell>()
    const runtimeCellsStartedAt = performance.now()
    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        if (!cell) continue
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

    this._relinkCompactedCells(replacements)
    getTerrainCameraController(this.map.context.controls)?.visibleCells?.clear()
    this.map.terrainChunkManager?.initialize(getTerrainCameraController(this.map.context.controls)?.getViewportRect())
  }

  _relinkCompactedCells(replacements: Map<TerrainGridCell, RuntimeCell>): void {
    const instances = [
      ...getGaiaAnimals(this.map.gaia),
      ...(this.map.context.players ?? []).flatMap(owner => [...owner.units, ...owner.buildings, ...owner.corpses]),
      ...this.map.resources,
    ] as RelinkableInstance[]
    const replaceCell = (cell: TerrainGridCell): TerrainGridCell => replacements.get(cell) || cell
    const relinkStartedAt = performance.now()
    for (const instance of instances) {
      if (instance.currentCell) instance.currentCell = replaceCell(instance.currentCell)
      if (instance.dest?.family === FAMILY_TYPES.cell) instance.dest = replaceCell(instance.dest as TerrainGridCell)
      if (instance.previousDest?.family === FAMILY_TYPES.cell)
        instance.previousDest = replaceCell(instance.previousDest as TerrainGridCell)
      if (instance.path?.length) instance.path = instance.path.map(replaceCell)
    }
    this.map.context.performance?.record?.('cellCompaction.instanceRelinks', performance.now() - relinkStartedAt)
  }

  bakeTerrainToChunks(): void {
    if (this.map.grid.some(row => row.some(cell => cell?.isGenerationCell))) {
      this._materializeGenerationCells()
    }

    const renderer = this.map.context.app?.renderer
    if (!renderer) return
    const bakeStartedAt = performance.now()
    const bounds = this._getTerrainMapBounds()
    const gl = renderer.gl
    const maxTex = gl ? Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), 4096) : 4096

    this._markTerrainCellsVisible()
    const containers = this._createTerrainBakeContainers()
    this._copyTerrainBackfill(containers)
    this._collectTerrainBakeCells(containers)
    this._renderTerrainChunks(renderer, containers.terrainContainer, bounds, maxTex)
    this._cleanupTerrainBakeContainers(containers)
    this.map.context.performance?.record?.('terrainBake', performance.now() - bakeStartedAt)
  }

  _materializeGenerationCells(): void {
    const startedAt = performance.now()
    const cellsStartedAt = performance.now()
    const replacements = new globalThis.Map<TerrainGridCell, TerrainBakeCell>()
    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const source = this.map.grid[i][j]
        if (!source?.isGenerationCell) continue
        const cell = new TerrainBakeCell(source, this.map.context as ConstructorParameters<typeof TerrainBakeCell>[1])
        cell.visible = source.visible

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
    const replaceCell = (cell: TerrainGridCell): TerrainGridCell => replacements.get(cell) || cell
    const instances = [
      ...getGaiaAnimals(this.map.gaia),
      ...(this.map.context.players ?? []).flatMap(owner => [...owner.units, ...owner.buildings, ...owner.corpses]),
      ...this.map.resources,
    ] as RelinkableInstance[]
    for (const instance of instances) {
      if (instance.currentCell) instance.currentCell = replaceCell(instance.currentCell)
      if (instance.dest?.family === FAMILY_TYPES.cell) instance.dest = replaceCell(instance.dest as TerrainGridCell)
      if (instance.previousDest?.family === FAMILY_TYPES.cell)
        instance.previousDest = replaceCell(instance.previousDest as TerrainGridCell)
      if (instance.path?.length) instance.path = instance.path.map(replaceCell)
    }
    this.map.context.performance?.record?.(
      'generationCellMaterialization.instanceRelinks',
      performance.now() - relinkStartedAt
    )
    this.map.context.performance?.record?.('generationCellMaterialization', performance.now() - startedAt)
  }

  _getTerrainMapBounds(): TerrainMapBounds {
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
        const bounds = this._getTerrainCellBounds(cell)
        minX = Math.min(minX, bounds.minX)
        minY = Math.min(minY, bounds.minY)
        maxX = Math.max(maxX, bounds.maxX)
        maxY = Math.max(maxY, bounds.maxY)
      }
    }

    if (!Number.isFinite(minX)) {
      return { minX: 0, minY: 0, maxX: 1, maxY: 1, totalW: 1, totalH: 1 }
    }
    const margin = CELL_DEPTH
    minX -= margin
    minY -= margin
    maxX += margin
    maxY += margin
    return { minX, minY, maxX, maxY, totalW: maxX - minX, totalH: maxY - minY }
  }

  _getTerrainCellBounds(cell: Pick<TerrainGridCell, 'x' | 'y'>): Omit<TerrainMapBounds, 'totalW' | 'totalH'> {
    const hw = CELL_WIDTH / 2
    const hh = CELL_HEIGHT / 2
    return {
      minX: cell.x - hw,
      minY: cell.y - hh,
      maxX: cell.x + hw,
      maxY: cell.y + hh,
    }
  }
}
