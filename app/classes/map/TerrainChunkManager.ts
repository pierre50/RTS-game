import { Container, Sprite } from 'pixi.js'
import { CELL_DEPTH, CELL_HEIGHT, CELL_WIDTH, LABEL_TYPES } from '../../constants'
import { rectangleIntersectsViewport } from '../../lib/graphics/chunkCulling'
import { Cell } from '../cell'
import type { Bounds, Viewport } from '../../types/geometry'
import type { RuntimeCell } from '../../types/map'

const TERRAIN_CHUNK_SIZE = 32
const TERRAIN_CHUNK_CACHE_LIMIT = 20
const VIEWPORT_MARGIN = CELL_WIDTH * 4
type TerrainDecoration = {
  texture: ConstructorParameters<typeof Sprite>[0]
  label: string
  position: { x: number; y: number }
  anchor: { x: number; y: number }
  zIndex: number
}
type TerrainAppearance = {
  waterBorder?: { resourceName: string; index: number }
  relief?: { index: number; elevation: number }
  patchBorders?: string[]
  patchBorderGroundType?: 'Desert' | 'Dirt' | null
  deepWaterBorders?: string[]
}
export type TerrainSourceCell = RuntimeCell & {
  _terrainAppearance: TerrainAppearance
  getTerrainDecorations(): TerrainDecoration[]
  terrainSet?: TerrainDecoration | null
  terrainTextureName?: string
}
type TerrainChunk = {
  key: string
  startI: number
  startJ: number
  endI: number
  endJ: number
  bounds: Bounds
  mounted: boolean
  visualCells: Map<string, Cell> | null
  lastUsed: number
}
export type ChunkedTerrainMap = {
  context: object
  size: number
  grid: RuntimeCell[][]
  visibleRenderChunkCount?: number
  addChild(child: Container): Container
}

function terrainSource(cell: RuntimeCell): Partial<TerrainSourceCell> {
  return cell as Partial<TerrainSourceCell>
}

export class TerrainChunkManager {
  map: ChunkedTerrainMap
  chunks: Map<string, TerrainChunk>
  clock: number
  terrainLayer: Container | null

  constructor(map: ChunkedTerrainMap) {
    this.map = map
    this.chunks = new globalThis.Map()
    this.clock = 0
    this.terrainLayer = null
  }

  initialize(viewport?: Viewport): void {
    this.destroy()
    this.chunks = new globalThis.Map()
    this.clock = 0
    this.terrainLayer = new Container()
    this.terrainLayer.label = 'streamedTerrain'
    this.terrainLayer.eventMode = 'none'
    this.terrainLayer.sortableChildren = true
    this.terrainLayer.zIndex = -1
    this.map.addChild(this.terrainLayer)

    const chunkCount = Math.ceil((this.map.size + 1) / TERRAIN_CHUNK_SIZE)
    for (let ci = 0; ci < chunkCount; ci++) {
      for (let cj = 0; cj < chunkCount; cj++) {
        const startI = ci * TERRAIN_CHUNK_SIZE
        const startJ = cj * TERRAIN_CHUNK_SIZE
        const endI = Math.min(this.map.size, startI + TERRAIN_CHUNK_SIZE - 1)
        const endJ = Math.min(this.map.size, startJ + TERRAIN_CHUNK_SIZE - 1)
        this.chunks.set(`${ci}:${cj}`, {
          key: `${ci}:${cj}`,
          startI,
          startJ,
          endI,
          endJ,
          bounds: this._getChunkBounds(startI, startJ, endI, endJ),
          mounted: false,
          visualCells: null,
          lastUsed: 0,
        })
      }
    }

    if (viewport) this.update(viewport)
  }

  _getChunkBounds(startI: number, startJ: number, endI: number, endJ: number): Bounds {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const [i, j] of [
      [startI, startJ],
      [startI, endJ],
      [endI, startJ],
      [endI, endJ],
    ]) {
      const cell = this.map.grid[i][j]
      minX = Math.min(minX, cell.x - CELL_WIDTH)
      minY = Math.min(minY, cell.y - CELL_HEIGHT - CELL_DEPTH * 4)
      maxX = Math.max(maxX, cell.x + CELL_WIDTH)
      maxY = Math.max(maxY, cell.y + CELL_HEIGHT + CELL_DEPTH * 4)
    }

    return { minX, minY, width: maxX - minX, height: maxY - minY }
  }

  update(viewport: Viewport): void {
    if (!viewport) return
    this.clock++
    let visibleCount = 0

    for (const chunk of this.chunks.values()) {
      if (!rectangleIntersectsViewport(chunk.bounds, viewport, VIEWPORT_MARGIN)) {
        if (chunk.mounted) this._setChunkRenderable(chunk, false)
        continue
      }
      chunk.lastUsed = this.clock
      visibleCount++
      if (!chunk.mounted) this._mountChunk(chunk)
      this._setChunkRenderable(chunk, true)
    }

    this._trimCache()
    this.map.visibleRenderChunkCount = visibleCount
  }

  invalidateCell(cell: RuntimeCell): void {
    const key = `${Math.floor(cell.i / TERRAIN_CHUNK_SIZE)}:${Math.floor(cell.j / TERRAIN_CHUNK_SIZE)}`
    const chunk = this.chunks.get(key)
    if (!chunk?.mounted) return
    const wasRenderable = chunk.visualCells?.values().next().value?.renderable ?? false
    this._unmountChunk(chunk)
    if (wasRenderable) this._mountChunk(chunk)
  }

  refreshCell(cell: RuntimeCell): void {
    const key = `${Math.floor(cell.i / TERRAIN_CHUNK_SIZE)}:${Math.floor(cell.j / TERRAIN_CHUNK_SIZE)}`
    const chunk = this.chunks.get(key)
    if (!chunk?.mounted) return
    const cellKey = `${cell.i}:${cell.j}`
    if (!chunk.visualCells?.get(cellKey)) {
      const visualCell = this._createTerrainCell(cell)
      chunk.visualCells?.set(cellKey, visualCell)
      this.terrainLayer?.addChild(visualCell)
    }
  }

  invalidateAll(): void {
    for (const chunk of this.chunks.values()) {
      if (!chunk.mounted) continue
      const wasRenderable = chunk.visualCells?.values().next().value?.renderable ?? false
      this._unmountChunk(chunk)
      if (wasRenderable) this._mountChunk(chunk)
    }
  }

  _mountChunk(chunk: TerrainChunk): void {
    chunk.visualCells = new globalThis.Map()
    chunk.mounted = true

    for (let i = chunk.startI; i <= chunk.endI; i++) {
      for (let j = chunk.startJ; j <= chunk.endJ; j++) {
        const source = this.map.grid[i][j]
        const visualCell = this._createTerrainCell(source)
        chunk.visualCells.set(`${i}:${j}`, visualCell)
        this.terrainLayer?.addChild(visualCell)
      }
    }
  }

  _createTerrainCell(source: RuntimeCell): Cell {
    const cell = new Cell(
      {
        i: source.i,
        j: source.j,
        z: source.z,
        type: source.type,
        textureName: terrainSource(source).terrainTextureName,
      },
      this.map.context as ConstructorParameters<typeof Cell>[1]
    )
    cell.visible = true

    const sourceTerrain = terrainSource(source)
    const appearance = sourceTerrain._terrainAppearance ?? {}
    if (appearance.waterBorder) {
      cell.setWaterBorder(appearance.waterBorder.resourceName, appearance.waterBorder.index)
    }
    if (appearance.relief) {
      cell.setReliefBorder(appearance.relief.index, appearance.relief.elevation)
    }
    for (const direction of appearance.patchBorders ?? []) {
      cell.setPatchBorder(direction, appearance.patchBorderGroundType ?? undefined)
    }
    for (const direction of appearance.deepWaterBorders ?? []) cell.setDeepWaterBorder(direction)
    for (const decoration of sourceTerrain.getTerrainDecorations?.() ?? []) {
      const sprite = new Sprite(decoration.texture)
      sprite.label = decoration.label
      sprite.position.copyFrom(decoration.position)
      sprite.anchor.copyFrom(decoration.anchor)
      sprite.roundPixels = true
      sprite.eventMode = 'none'
      sprite.zIndex = decoration.zIndex
      cell.addChild(sprite)
    }

    if (sourceTerrain.terrainSet?.texture) {
      const set = new Sprite(sourceTerrain.terrainSet.texture)
      set.label = LABEL_TYPES.set
      set.position.copyFrom(sourceTerrain.terrainSet.position)
      set.anchor.copyFrom(sourceTerrain.terrainSet.anchor)
      set.roundPixels = true
      set.eventMode = 'none'
      set.zIndex = sourceTerrain.terrainSet.zIndex
      cell.addChild(set)
    }
    return cell
  }

  _setChunkRenderable(chunk: TerrainChunk, renderable: boolean): void {
    const first = chunk.visualCells?.values().next().value
    if (!first || first.renderable === renderable) return
    for (const visualCell of chunk.visualCells?.values() ?? []) visualCell.renderable = renderable
  }

  _trimCache(): void {
    let mountedCount = 0
    for (const chunk of this.chunks.values()) {
      if (chunk.mounted) mountedCount++
    }
    if (mountedCount <= TERRAIN_CHUNK_CACHE_LIMIT) return

    const removable = []
    for (const chunk of this.chunks.values()) {
      if (chunk.mounted && chunk.lastUsed < this.clock) removable.push(chunk)
    }
    removable.sort((a, b) => a.lastUsed - b.lastUsed)
    while (mountedCount > TERRAIN_CHUNK_CACHE_LIMIT && removable.length) {
      const chunk = removable.shift()
      if (chunk) this._unmountChunk(chunk)
      mountedCount--
    }
  }

  _unmountChunk(chunk: TerrainChunk): void {
    if (!chunk.mounted) return
    for (const visualCell of chunk.visualCells?.values() ?? []) {
      visualCell.destroy({ children: true, texture: false, textureSource: false })
    }
    chunk.mounted = false
    chunk.visualCells = null
  }

  destroy(): void {
    for (const chunk of this.chunks.values()) this._unmountChunk(chunk)
    this.chunks.clear()
    this.terrainLayer?.destroy({ children: true, texture: false, textureSource: false })
    this.terrainLayer = null
  }
}
