import { Container, Sprite } from 'pixi.js'
import { CELL_DEPTH, CELL_HEIGHT, CELL_WIDTH, LABEL_TYPES } from '../../constants'
import { rectangleIntersectsViewport } from '../../lib/graphics/chunkCulling'
import { Cell } from '../cell'

const TERRAIN_CHUNK_SIZE = 32
const TERRAIN_CHUNK_CACHE_LIMIT = 20
const VIEWPORT_MARGIN = CELL_WIDTH * 4

export class TerrainChunkManager {
  constructor(map) {
    this.map = map
    this.chunks = new globalThis.Map()
    this.clock = 0
    this.terrainLayer = null
  }

  initialize(viewport) {
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

  _getChunkBounds(startI, startJ, endI, endJ) {
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

  update(viewport) {
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

  invalidateCell(cell) {
    const key = `${Math.floor(cell.i / TERRAIN_CHUNK_SIZE)}:${Math.floor(cell.j / TERRAIN_CHUNK_SIZE)}`
    const chunk = this.chunks.get(key)
    if (!chunk?.mounted) return
    const wasRenderable = chunk.visualCells.values().next().value?.renderable ?? false
    this._unmountChunk(chunk)
    if (wasRenderable) this._mountChunk(chunk)
  }

  refreshCell(cell) {
    const key = `${Math.floor(cell.i / TERRAIN_CHUNK_SIZE)}:${Math.floor(cell.j / TERRAIN_CHUNK_SIZE)}`
    const chunk = this.chunks.get(key)
    if (!chunk?.mounted) return
    const cellKey = `${cell.i}:${cell.j}`
    if (!chunk.visualCells.get(cellKey)) {
      const visualCell = this._createTerrainCell(cell)
      chunk.visualCells.set(cellKey, visualCell)
      this.terrainLayer.addChild(visualCell)
    }
  }

  invalidateAll() {
    for (const chunk of this.chunks.values()) {
      if (!chunk.mounted) continue
      const wasRenderable = chunk.visualCells.values().next().value?.renderable ?? false
      this._unmountChunk(chunk)
      if (wasRenderable) this._mountChunk(chunk)
    }
  }

  _mountChunk(chunk) {
    chunk.visualCells = new globalThis.Map()
    chunk.mounted = true

    for (let i = chunk.startI; i <= chunk.endI; i++) {
      for (let j = chunk.startJ; j <= chunk.endJ; j++) {
        const source = this.map.grid[i][j]
        const visualCell = this._createTerrainCell(source)
        chunk.visualCells.set(`${i}:${j}`, visualCell)
        this.terrainLayer.addChild(visualCell)
      }
    }
  }

  _createTerrainCell(source) {
    const cell = new Cell(
      {
        i: source.i,
        j: source.j,
        z: source.z,
        type: source.type,
        textureName: source.terrainTextureName,
      },
      this.map.context
    )
    cell.visible = true

    const appearance = source._terrainAppearance
    if (appearance.waterBorder) {
      cell.setWaterBorder(appearance.waterBorder.resourceName, appearance.waterBorder.index)
    }
    if (appearance.relief) {
      cell.setReliefBorder(appearance.relief.index, appearance.relief.elevation)
    }
    for (const direction of appearance.desertBorders) cell.setDesertBorder(direction)
    for (const decoration of source.getTerrainDecorations()) {
      const sprite = new Sprite(decoration.texture)
      sprite.label = decoration.label
      sprite.position.copyFrom(decoration.position)
      sprite.anchor.copyFrom(decoration.anchor)
      sprite.roundPixels = true
      sprite.eventMode = 'none'
      sprite.zIndex = decoration.zIndex
      cell.addChild(sprite)
    }

    if (source.terrainSet?.texture) {
      const set = new Sprite(source.terrainSet.texture)
      set.label = LABEL_TYPES.set
      set.position.copyFrom(source.terrainSet.position)
      set.anchor.copyFrom(source.terrainSet.anchor)
      set.roundPixels = true
      set.eventMode = 'none'
      set.zIndex = source.terrainSet.zIndex
      cell.addChild(set)
    }
    return cell
  }

  _setChunkRenderable(chunk, renderable) {
    const first = chunk.visualCells.values().next().value
    if (!first || first.renderable === renderable) return
    for (const visualCell of chunk.visualCells.values()) visualCell.renderable = renderable
  }

  _trimCache() {
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
      this._unmountChunk(removable.shift())
      mountedCount--
    }
  }

  _unmountChunk(chunk) {
    if (!chunk.mounted) return
    for (const visualCell of chunk.visualCells.values()) {
      visualCell.destroy({ children: true, texture: false, textureSource: false })
    }
    chunk.mounted = false
    chunk.visualCells = null
  }

  destroy() {
    for (const chunk of this.chunks.values()) this._unmountChunk(chunk)
    this.chunks.clear()
    this.terrainLayer?.destroy({ children: true, texture: false, textureSource: false })
    this.terrainLayer = null
  }
}
