import { Container, Sprite, RenderTexture, Matrix, Assets, Particle, ParticleContainer, Rectangle } from 'pixi.js'
import { CELL_WIDTH, CELL_HEIGHT, CELL_DEPTH, FAMILY_TYPES, LABEL_TYPES } from '../../constants'
import { _DW, _DH } from '../cell/CellFog'
import { RuntimeCell } from '../cell/RuntimeCell'
import { ViewportFogRenderer } from './ViewportFogRenderer'

const WATER_CHUNK_SIZE = 64

export class MapFog {
  constructor(map) {
    this.map = map
    this.viewportRenderer = new ViewportFogRenderer(map)
  }

  bakeTerrainToChunks() {
    if (this.map.grid[0]?.[0]?.isGenerationCell) {
      const viewport = this.map.context.controls?.cameraController?.getViewportRect()
      this.map.terrainChunkManager.initialize(viewport)
      this.map.context.performance?.record('terrainBake', 0)
      return
    }

    const renderer = this.map.context.app?.renderer
    if (!renderer) return
    const bakeStartedAt = performance.now()

    const { minX, minY, maxX, maxY, totalW, totalH } = this._getFogMapBounds()

    const gl = renderer.gl
    const maxTex = gl ? Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), 4096) : 4096
    const chunksX = Math.ceil(totalW / maxTex)
    const chunksY = Math.ceil(totalH / maxTex)
    const chunkW = totalW / chunksX
    const chunkH = totalH / chunksY

    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        this.map.grid[i][j].visible = true
      }
    }

    const terrainContainer = new Container()
    terrainContainer.sortableChildren = true
    const backfillContainer = new Container()
    backfillContainer.label = 'terrainBackfillBake'
    backfillContainer.zIndex = -2
    backfillContainer.sortableChildren = true
    terrainContainer.addChild(backfillContainer)
    const backfillSprites = []
    const terrainSets = []
    for (const source of this.map.terrainBackfill?.children || []) {
      const sprite = new Sprite(source.texture)
      sprite.position.copyFrom(source.position)
      sprite.anchor.copyFrom(source.anchor)
      sprite.roundPixels = source.roundPixels
      sprite.zIndex = source.zIndex
      sprite.eventMode = 'none'
      backfillContainer.addChild(sprite)
      backfillSprites.push(sprite)
    }
    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        const set = cell.getChildByLabel(LABEL_TYPES.set)
        if (set) {
          cell.removeChild(set)
          set.x += cell.x
          set.y += cell.y
          set.zIndex = cell.i + cell.j + 0.1
          cell.terrainSet = set
          terrainSets.push(set)
        }
        terrainContainer.addChild(cell)
      }
    }

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

    for (const sprite of backfillSprites) sprite.destroy()
    backfillContainer.destroy()
    if (this.map.terrainBackfill) this.map.terrainBackfill.visible = false
    terrainSets.forEach(set => this.map.addChild(set))

    if (!this.map.context.editor) {
      const compactStartedAt = performance.now()
      const replacements = new globalThis.Map()
      for (let i = 0; i <= this.map.size; i++) {
        for (let j = 0; j <= this.map.size; j++) {
          const cell = this.map.grid[i][j]
          terrainContainer.removeChild(cell)
          cell.releaseTerrainRenderResources()
          const runtimeCell = new RuntimeCell(cell)
          replacements.set(cell, runtimeCell)
          this.map.grid[i][j] = runtimeCell
          cell.destroy()
        }
      }
      terrainContainer.destroy()
      const instances = [
        ...(this.map.gaia?.units || []),
        ...this.map.context.players.flatMap(owner => [...owner.units, ...owner.buildings, ...owner.corpses]),
        ...this.map.resources,
      ]
      const replaceCell = cell => replacements.get(cell) || cell
      for (const instance of instances) {
        if (instance.currentCell) instance.currentCell = replaceCell(instance.currentCell)
        if (instance.dest?.family === FAMILY_TYPES.cell) instance.dest = replaceCell(instance.dest)
        if (instance.previousDest?.family === FAMILY_TYPES.cell)
          instance.previousDest = replaceCell(instance.previousDest)
        if (instance.path?.length) instance.path = instance.path.map(replaceCell)
      }
      this.map.context.controls?.cameraController?.visibleCells?.clear()
      this._indexFogChunkCells()
      this.map.context.performance?.record('cellCompaction', performance.now() - compactStartedAt)
    }

    const { player } = this.map.context
    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        if (player.views.isViewed(i, j)) {
          cell.updateVisible()
        }
      }
    }

    this._createWaterAnimation()
    this.map.context.performance?.record('terrainBake', performance.now() - bakeStartedAt)
  }

  _createWaterAnimation() {
    const startedAt = performance.now()
    const spritesheet = Assets.cache.get('15002')
    if (!spritesheet) return

    const frames = ['000', '001', '002', '003'].map(i => spritesheet.textures[`${i}_15002.png`]).filter(Boolean)
    if (!frames.length) return

    const PHASES = frames.length

    // Destroy previous water layers if re-baking (e.g. load from save)
    if (this.map._waterLayers) {
      this.map.context.app.ticker.remove(this.map._waterAnimTicker)
      for (const layer of this.map._waterLayers) {
        for (const chunk of layer.chunks.values()) {
          chunk.container.destroy({ children: true, texture: false, textureSource: false })
        }
      }
      this.map._waterLayers = null
    }

    this.map._waterLayers = Array.from({ length: PHASES }, (_, p) => ({
      chunks: new globalThis.Map(),
      phase: p,
      frameMs: 900 + ((p * 97 + 43) % 300),
      elapsed: 0,
    }))
    for (let p = 0; p < PHASES; p++) {
      const layer = this.map._waterLayers[p]
      layer.elapsed = (p / PHASES) * layer.frameMs
    }

    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        if (cell.category !== 'Water') continue
        const layer = this.map._waterLayers[(cell.i + cell.j) % PHASES]
        const chunkKey = `${Math.floor(cell.i / WATER_CHUNK_SIZE)}:${Math.floor(cell.j / WATER_CHUNK_SIZE)}`
        let chunk = layer.chunks.get(chunkKey)
        if (!chunk) {
          const container = new ParticleContainer({
            texture: frames[layer.phase],
            dynamicProperties: {
              position: false,
              rotation: false,
              vertex: false,
              uvs: false,
              color: false,
            },
            roundPixels: true,
          })
          container.zIndex = -0.5
          container.eventMode = 'none'
          container.cullable = true
          chunk = { container, minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
          layer.chunks.set(chunkKey, chunk)
          this.map.addChild(container)
        }
        chunk.container.addParticle(
          new Particle({
            texture: frames[layer.phase],
            x: cell.x,
            y: cell.y,
            anchorX: 0.5,
            anchorY: 0.5,
          })
        )
        chunk.minX = Math.min(chunk.minX, cell.x - CELL_WIDTH / 2)
        chunk.minY = Math.min(chunk.minY, cell.y - CELL_HEIGHT / 2)
        chunk.maxX = Math.max(chunk.maxX, cell.x + CELL_WIDTH / 2)
        chunk.maxY = Math.max(chunk.maxY, cell.y + CELL_HEIGHT / 2)
      }
    }
    for (const layer of this.map._waterLayers) {
      for (const chunk of layer.chunks.values()) {
        chunk.container.boundsArea = new Rectangle(
          chunk.minX,
          chunk.minY,
          chunk.maxX - chunk.minX,
          chunk.maxY - chunk.minY
        )
        this.map.registerRenderChunk(chunk.container, {
          minX: chunk.minX,
          minY: chunk.minY,
          width: chunk.maxX - chunk.minX,
          height: chunk.maxY - chunk.minY,
        })
      }
    }

    this.map._waterAnimTicker = ticker => {
      if (this.map.context.map !== this.map) {
        this.map.context.app.ticker.remove(this.map._waterAnimTicker)
        return
      }
      for (const layer of this.map._waterLayers) {
        layer.elapsed += ticker.elapsedMS
        if (layer.elapsed >= layer.frameMs) {
          layer.elapsed %= layer.frameMs
          layer.phase = (layer.phase + 1) % frames.length
          for (const chunk of layer.chunks.values()) {
            chunk.container.texture = frames[layer.phase]
          }
        }
      }
    }
    this.map.context.app.ticker.add(this.map._waterAnimTicker)
    this.map.context.performance?.record('waterBuild', performance.now() - startedAt)
  }

  _initFogChunks() {
    this.destroyFogResources()
    this.map._fogQueue = new globalThis.Map()
    this.map._pendingFogChunkUpdates = new globalThis.Map()
    this.map._fogInitComplete = false
    this.map._fogChunks = []
    this.viewportRenderer.initialize()

    this.map._fogTickerCb = () => {
      if (this.map.context.map !== this.map) {
        this.map.context.app.ticker.remove(this.map._fogTickerCb)
        return
      }
      this._flushFogQueue()
    }
    this.map.context.app.ticker.add(this.map._fogTickerCb)
  }

  _getFogMapBounds() {
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

  _getFogCellBounds(cell) {
    const hw = _DW / 2
    const hh = _DH / 2
    return {
      minX: cell.x - hw,
      minY: cell.y - hh,
      maxX: cell.x + hw,
      maxY: cell.y + hh,
    }
  }

  _indexFogChunkCells() {
    this.viewportRenderer.invalidate()
  }

  _flushFogQueue() {
    if (this.map._fogQueue?.size) {
      this.map._fogQueue.clear()
      this.viewportRenderer.invalidate()
    }
    this.map._pendingFogChunkUpdates?.clear()
    this.viewportRenderer.update(this.map.context.controls?.cameraController?.getViewportRect())
  }

  destroyFogResources() {
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
