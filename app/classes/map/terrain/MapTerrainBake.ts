import { getTerrainMapBounds, getTerrainCellBounds } from './TerrainBakeBounds'
import type { RoadLayer } from '../../../lib/terrain/roadLayer'
import { createRoadTerrainSprite } from './RoadTerrainSprite'
import { materializedResources } from '../../resources/CompactResourceSet'
import { getPackedCellStore } from '../../cell/PackedCellRegistry'
import { beginLoadTrace, traceLoad } from '../../../lib/loadDiagnostics'
import { Container, Sprite, RenderTexture, Matrix } from 'pixi.js'
import type { ContainerChild, PointData, Texture } from 'pixi.js'
import { CELL_WIDTH, CELL_HEIGHT, FAMILY_TYPES, LABEL_TYPES } from '../../../constants'
import { getTerrainSetZIndex } from '../../../lib'
import type { RuntimeEntity } from '../../../types/entities'
import type { Bounds, Viewport } from '../../../types/geometry'
import type * as MapTypes from '../../../types/map'
import type { PlayerLike } from '../../../types/player'
import { TerrainBakeCell } from '../../cell/TerrainBakeCell'
import { RuntimeCell, type RuntimeCellContext, type RuntimeCellSource } from '../../cell/RuntimeCell'
import { getGaiaAnimals } from '../../../lib'
import { TerrainTextureCache } from './TerrainTextureCache'
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
  getTerrainDecorations?(): (TerrainDecoration & ContainerChild)[]
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

type TerrainMapBounds = ReturnType<typeof getTerrainMapBounds>

type TerrainRuntimeMap = {
  roads?: RoadLayer
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
  textureCache: TerrainTextureCache | null = null
  private decorations = new WeakMap<TerrainGridCell, TerrainDecoration[]>()
  private roadConnections = new Map<number, number>()
  private sourcePadding = 256
  private minYOffset = 0
  private maxYOffset = 0

  constructor(map: TerrainRuntimeMap) {
    this.map = map
  }

  destroy(): void {
    this.textureCache?.destroy()
    this.textureCache = null
    this.decorations = new WeakMap()
  }

  updateViewport(viewport: Viewport): void {
    if (!this.textureCache) return
    const startedAt = performance.now()
    this.textureCache.update(viewport)
    this.map.context.performance?.record?.('terrainTextures.update', performance.now() - startedAt)
  }

  private initializeStreaming(renderer: PixiRendererLike): void {
    this.textureCache?.destroy()
    this.sourcePadding = 256
    this.minYOffset = 0
    this.maxYOffset = 0
    const replacements = new Map<TerrainGridCell, RuntimeCell>()
    const packed = getPackedCellStore(this.map.grid)
    if (packed) {
      packed.markVisible()
      const bounds = packed.elevationBounds()
      this.minYOffset = bounds.min
      this.maxYOffset = bounds.max
    }
    const rows = packed ? [packed.changedCells(this.map.grid)] : this.map.grid
    for (const row of rows) {
      for (const source of row) {
        if (!source) continue
        source.visible = true
        const offset = source.y - ((source.i + source.j) * CELL_HEIGHT) / 2
        this.minYOffset = Math.min(this.minYOffset, offset)
        this.maxYOffset = Math.max(this.maxYOffset, offset)
        const set = source.getChildByLabel?.(LABEL_TYPES.set)
        if (set) {
          source.removeChild?.(set)
          set.x += source.x
          set.y += source.y
          set.zIndex = getTerrainSetZIndex(source)
          source.terrainSet = set
          this.map.addChild(set)
        }
        const floors =
          source.getTerrainDecorations?.() ??
          (isTerrainContainerCell(source)
            ? (source.children.filter(
                child => child.label === LABEL_TYPES.floor && isBackfillSpriteSource(child)
              ) as (ContainerChild & TerrainDecoration)[])
            : [])
        const descriptors = floors.length
          ? floors.map(decoration => ({
              texture: decoration.texture,
              label: decoration.label,
              position: { x: decoration.position.x, y: decoration.position.y },
              anchor: { x: decoration.anchor.x, y: decoration.anchor.y },
              zIndex: decoration.zIndex,
            }))
          : (this.decorations.get(source) ?? [])
        this.sourcePadding = Math.max(this.sourcePadding, Math.abs(source._terrainAppearance?.relief?.elevation ?? 0))
        for (const decoration of descriptors) {
          this.sourcePadding = Math.max(
            this.sourcePadding,
            Math.abs(decoration.position.x) + decoration.texture.width,
            Math.abs(decoration.position.y) + decoration.texture.height
          )
        }
        let logical = source
        if (isTerrainContainerCell(source) && isRuntimeCellSource(source)) {
          const runtime = new RuntimeCell(source)
          logical = runtime
          replacements.set(source, runtime)
          this.map.grid[source.i][source.j] = logical
          source.destroy({ children: true, texture: false, textureSource: false })
        } else {
          for (const decoration of floors) {
            source.removeChild?.(decoration)
            decoration.destroy({ texture: false, textureSource: false })
          }
        }
        if (descriptors.length) this.decorations.set(logical, descriptors)
      }
    }
    if (replacements.size) this._relinkCompactedCells(replacements)
    if (this.map.terrainBackfill) this.map.terrainBackfill.visible = false
    const bounds = this._getTerrainMapBounds()
    const padding = this.sourcePadding
    this.textureCache = new TerrainTextureCache(
      {
        minX: bounds.minX - padding,
        minY: bounds.minY - padding,
        width: bounds.totalW + padding * 2,
        height: bounds.totalH + padding * 2,
      },
      (tile, resolution) => this.bakeStreamingTile(renderer, tile, resolution)
    )
    const camera = getTerrainCameraController(this.map.context.controls)
    camera?.visibleCells?.clear()
    const viewport = camera?.getViewportRect()
    if (viewport) this.updateViewport(viewport)
    this.map.terrainChunkManager?.initialize(viewport)
  }

  private bakeStreamingTile(
    renderer: PixiRendererLike,
    bounds: Bounds,
    resolution: number
  ): { renderable: boolean; destroy(): void } {
    const trace = beginLoadTrace('terrain.bakeTile', { x: bounds.minX, y: bounds.minY, resolution })
    const containers = this._createTerrainBakeContainers()
    const visuals: TerrainBakeCell[] = []
    let texture: RenderTexture | null = null
    try {
      // Invert the projected rectangle, including elevation and sprite overhang.
      const p = this.sourcePadding
      const left = (bounds.minX - p) / (CELL_WIDTH / 2)
      const right = (bounds.minX + bounds.width + p) / (CELL_WIDTH / 2)
      const top = (bounds.minY - p - this.maxYOffset) / (CELL_HEIGHT / 2)
      const bottom = (bounds.minY + bounds.height + p - this.minYOffset) / (CELL_HEIGHT / 2)
      const firstI = Math.max(0, Math.floor((top + left) / 2))
      const lastI = Math.min(this.map.size, Math.ceil((bottom + right) / 2))
      const firstJ = Math.max(0, Math.floor((top - right) / 2))
      const lastJ = Math.min(this.map.size, Math.ceil((bottom - left) / 2))
      for (let i = firstI; i <= lastI; i++) {
        for (let j = firstJ; j <= lastJ; j++) {
          const source = this.map.grid[i]?.[j]
          if (
            !source ||
            source.x < bounds.minX - p ||
            source.x > bounds.minX + bounds.width + p ||
            source.y < bounds.minY - p ||
            source.y > bounds.minY + bounds.height + p
          )
            continue
          // Temporary visuals must never mutate occupancy or the logical appearance.
          const appearance = source._terrainAppearance ?? {}
          const visualSource = {
            i: source.i,
            j: source.j,
            x: source.x,
            y: source.y,
            z: source.z,
            type: source.type,
            category: source.category,
            color: source.color,
            assets: source.assets,
            terrainTextureName: source.terrainTextureName,
            solid: source.solid,
            visible: source.visible,
            inclined: source.inclined,
            border: source.border,
            waterBorder: source.waterBorder,
            terrainHidden: source.terrainHidden,
            updateVisible: () => {},
            place: () => {},
            has: null,
            corpses: new Set<RuntimeEntity>(),
            _terrainAppearance: {
              ...appearance,
              patchBorders: new Set(appearance.patchBorders ?? []),
              relief: appearance.relief ?? null,
              waterBorder: appearance.waterBorder ?? null,
            },
          }
          const visual = new TerrainBakeCell(
            visualSource,
            this.map.context as ConstructorParameters<typeof TerrainBakeCell>[1]
          )
          visuals.push(visual)
          if (appearance.waterBorder)
            visual.setWaterBorder(appearance.waterBorder.resourceName, appearance.waterBorder.index)
          if (appearance.relief) visual.setReliefBorder(appearance.relief.index, appearance.relief.elevation)
          for (const direction of appearance.patchBorders ?? [])
            visual.setPatchBorder(direction, appearance.patchBorderGroundType ?? undefined)
          for (const decoration of this.decorations.get(source) ?? []) {
            const sprite = new Sprite(decoration.texture)
            sprite.position.copyFrom(decoration.position)
            sprite.anchor.copyFrom(decoration.anchor)
            sprite.zIndex = decoration.zIndex
            visual.addChild(sprite)
          }
          this.addRoad(visual, source)
          containers.terrainContainer.addChild(...visual.getTerrainBakeChildren())
        }
      }
      this._copyTerrainBackfill(containers, bounds)
      texture = RenderTexture.create({ width: bounds.width, height: bounds.height, resolution })
      renderer.render({
        container: containers.terrainContainer,
        target: texture,
        transform: new Matrix().translate(-bounds.minX, -bounds.minY),
        clear: true,
      })
      const sprite = new Sprite(texture)
      sprite.position.set(bounds.minX, bounds.minY)
      sprite.zIndex = -1
      sprite.eventMode = 'none'
      sprite.label = 'streamedTerrainTexture'
      this.map.addChild(sprite)
      // Sprite.destroy defaults to keeping its texture; this cache owns both.
      const ownedTexture = texture
      trace.end({
        visualCells: visuals.length,
        textureMiB: (bounds.width * bounds.height * resolution ** 2 * 4) / 1048576,
      })
      return {
        get renderable() {
          return sprite.renderable
        },
        set renderable(value: boolean) {
          sprite.renderable = value
        },
        destroy() {
          sprite.destroy()
          ownedTexture.destroy(true)
        },
      }
    } catch (error) {
      texture?.destroy(true)
      trace.fail(error)
      throw error
    } finally {
      for (const visual of visuals) visual.destroy({ children: true, texture: false, textureSource: false })
      containers.terrainContainer.destroy({ children: true, texture: false, textureSource: false })
    }
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

  _copyTerrainBackfill({ backfillContainer, backfillSprites }: TerrainBakeContainers, bounds?: Bounds): void {
    const backfillStartedAt = performance.now()
    for (const source of this.map.terrainBackfill?.children || []) {
      if (!isBackfillSpriteSource(source)) continue
      if (
        bounds &&
        (source.x + source.texture.width < bounds.minX ||
          source.x - source.texture.width > bounds.minX + bounds.width ||
          source.y + source.texture.height < bounds.minY ||
          source.y - source.texture.height > bounds.minY + bounds.height)
      )
        continue
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
        this.addRoad(cell, cell)
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
      ...materializedResources(this.map.resources),
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

  private addRoad(visual: TerrainGridCell, source: TerrainGridCell): void {
    const connections = this.roadConnections.get(source.i * (this.map.size + 1) + source.j)
    if (!connections || source.category === 'Water' || source.terrainHidden) return
    const sprite = (visual as TerrainGridCell & { sprite?: Sprite | null }).sprite
    if (!sprite) return
    const frame = source._terrainAppearance?.relief?.index ?? 0
    visual.addChild?.(createRoadTerrainSprite(connections, frame, sprite.texture.height))
  }

  bakeTerrainToChunks(): void {
    this.roadConnections = new Map(this.map.roads?.cells ?? [])
    const streamingRenderer = this.map.context.app?.renderer
    if (!this.map.context.editor && streamingRenderer) {
      const startedAt = performance.now()
      traceLoad('terrain.initializeStreaming', () => this.initializeStreaming(streamingRenderer))
      this.map.context.performance?.record?.('terrainBake', performance.now() - startedAt)
      return
    }
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
      ...materializedResources(this.map.resources),
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

  _getTerrainMapBounds() {
    return getTerrainMapBounds(this.map)
  }

  _getTerrainCellBounds(cell: Pick<TerrainGridCell, 'x' | 'y'>) {
    return getTerrainCellBounds(cell)
  }
}
