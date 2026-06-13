import { Container, Sprite, RenderTexture, Matrix, Graphics, TilingSprite, Assets } from 'pixi.js'
import { CELL_WIDTH, CELL_HEIGHT, CELL_DEPTH } from '../../constants'
import { _DW, _DH, getFogPatternTexture } from '../cell/CellFog'
import { cartesianToIsometric } from '../../lib'

const WATER_TEXTURE_UPDATES_PER_TICK = 768

const FOG_UPDATE_PRIORITY = {
  fog: 0,
  refreshFogErase: 1,
  fogViewed: 2,
  clear: 3,
}

export class MapFog {
  constructor(map) {
    this.map = map
  }

  bakeTerrainToChunks() {
    const renderer = this.map.context.app?.renderer
    if (!renderer) return

    const { minX, minY, maxX, maxY, totalW, totalH } = this.map._getFogMapBounds()

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
        terrainContainer.addChild(this.map.grid[i][j])
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
      }
    }

    for (const sprite of backfillSprites) sprite.destroy()
    backfillContainer.destroy()
    if (this.map.terrainBackfill) this.map.terrainBackfill.visible = false

    const { player } = this.map.context
    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        if (player.views[i]?.[j]?.viewed) {
          cell.updateVisible()
        }
      }
    }

    this._createWaterAnimation()
  }

  _createWaterAnimation() {
    const spritesheet = Assets.cache.get('15002')
    if (!spritesheet) return

    const frames = ['000', '001', '002', '003'].map(i => spritesheet.textures[`${i}_15002.png`]).filter(Boolean)
    if (!frames.length) return

    const PHASES = frames.length

    // Destroy previous water layers if re-baking (e.g. load from save)
    if (this.map._waterLayers) {
      this.map.context.app.ticker.remove(this.map._waterAnimTicker)
      for (const layer of this.map._waterLayers) {
        for (const sprite of layer.sprites) sprite.destroy()
      }
      this.map._waterLayers = null
    }

    // One sprite per water cell — no mask, no camera drift, PixiJS batches same-texture sprites
    this.map._waterLayers = Array.from({ length: PHASES }, (_, p) => ({
      sprites: [],
      phase: p,
      frameMs: 900 + ((p * 97 + 43) % 300),
      elapsed: 0,
      pendingTexture: null,
      updateIndex: 0,
    }))
    for (let p = 0; p < PHASES; p++) {
      this.map._waterLayers[p].elapsed = (p / PHASES) * this.map._waterLayers[p].frameMs
    }

    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        if (cell.category !== 'Water') continue
        const layer = this.map._waterLayers[(cell.i + cell.j) % PHASES]

        const sprite = new Sprite(frames[layer.phase])
        sprite.x = cell.x
        sprite.y = cell.y
        sprite.anchor.set(0.5, 0.5)
        sprite.zIndex = -0.5
        sprite.eventMode = 'none'
        sprite.cullable = true

        this.map.addChild(sprite)
        layer.sprites.push(sprite)
      }
    }

    this.map._waterAnimTicker = ticker => {
      if (this.map.context.map !== this.map) {
        this.map.context.app.ticker.remove(this.map._waterAnimTicker)
        return
      }
      for (const layer of this.map._waterLayers) {
        layer.elapsed += ticker.elapsedMS
        if (!layer.pendingTexture && layer.elapsed >= layer.frameMs) {
          layer.elapsed %= layer.frameMs
          layer.phase = (layer.phase + 1) % frames.length
          layer.pendingTexture = frames[layer.phase]
          layer.updateIndex = 0
        }
      }

      let remainingUpdates = WATER_TEXTURE_UPDATES_PER_TICK
      for (const layer of this.map._waterLayers) {
        if (!layer.pendingTexture) continue
        const start = layer.updateIndex
        const end = Math.min(layer.updateIndex + remainingUpdates, layer.sprites.length)
        for (; layer.updateIndex < end; layer.updateIndex++) {
          layer.sprites[layer.updateIndex].texture = layer.pendingTexture
        }
        remainingUpdates -= end - start
        if (layer.updateIndex >= layer.sprites.length) {
          layer.pendingTexture = null
          layer.updateIndex = 0
        }
        if (remainingUpdates <= 0) break
      }
    }
    this.map.context.app.ticker.add(this.map._waterAnimTicker)
  }

  _initFogChunks() {
    this.map._fogQueue = new globalThis.Map()
    this.map._fogInitComplete = false
    this.map._fogChunks = []

    const renderer = this.map.context.app?.renderer
    if (!renderer) return

    const margin = CELL_WIDTH
    const minX = -this.map.size * (CELL_WIDTH / 2) - margin
    const minY = -margin
    const maxX = this.map.size * (CELL_WIDTH / 2) + margin
    const maxY = this.map.size * CELL_HEIGHT + margin
    const totalW = maxX - minX
    const totalH = maxY - minY

    const gl = renderer.gl
    const maxTex = gl ? Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), 4096) : 4096
    const chunksX = Math.ceil(totalW / maxTex)
    const chunksY = Math.ceil(totalH / maxTex)
    const chunkW = totalW / chunksX
    const chunkH = totalH / chunksY

    this.map._fogBounds = { minX, minY, chunksX, chunksY, chunkW, chunkH, totalW, totalH }
    this.map._fogScratchEmptyContainer = new Container()
    this.map._fogScratchEraseContainer = new Container()

    this.map.fogLayer = new Container()
    this.map.fogLayer.eventMode = 'none'
    this.map.fogLayer.zIndex = 1e9
    this.map.fogLayer.sortableChildren = true
    this.map.addChild(this.map.fogLayer)

    if (this.map.revealEverything) return

    for (let cx = 0; cx < chunksX; cx++) {
      for (let cy = 0; cy < chunksY; cy++) {
        const cMinX = minX + cx * chunkW
        const cMinY = minY + cy * chunkH
        const cW = Math.ceil(cx === chunksX - 1 ? totalW - cx * chunkW : chunkW)
        const cH = Math.ceil(cy === chunksY - 1 ? totalH - cy * chunkH : chunkH)

        const darknessRt = RenderTexture.create({ width: cW, height: cH })
        const fogRt = RenderTexture.create({ width: cW, height: cH })
        const edgeRt = RenderTexture.create({ width: cW, height: cH })
        const emptyC = new Container()
        renderer.render({ container: emptyC, target: darknessRt, clear: true })
        renderer.render({ container: emptyC, target: fogRt, clear: true })
        renderer.render({ container: emptyC, target: edgeRt, clear: true })
        emptyC.destroy()

        const pattern = this.map._createFogPatternSprite(cMinX, cMinY, cW, cH)
        renderer.render({ container: pattern, target: fogRt, clear: false })
        pattern.destroy()

        if (!this.map.revealTerrain) {
          const blackG = new Graphics()
          blackG.rect(cMinX, cMinY, cW, cH).fill({ color: 0x000000 })
          renderer.render({
            container: blackG,
            target: darknessRt,
            transform: new Matrix().translate(-cMinX, -cMinY),
            clear: false,
          })
          blackG.destroy()
        }

        const darknessSprite = new Sprite(darknessRt)
        darknessSprite.x = cMinX
        darknessSprite.y = cMinY
        darknessSprite.zIndex = 1
        darknessSprite.eventMode = 'none'
        this.map.fogLayer.addChild(darknessSprite)

        const fogSprite = new Sprite(fogRt)
        fogSprite.x = cMinX
        fogSprite.y = cMinY
        fogSprite.zIndex = 2
        fogSprite.eventMode = 'none'
        this.map.fogLayer.addChild(fogSprite)

        const edgeSprite = new Sprite(edgeRt)
        edgeSprite.x = cMinX
        edgeSprite.y = cMinY
        edgeSprite.zIndex = 3
        edgeSprite.eventMode = 'none'
        this.map.fogLayer.addChild(edgeSprite)

        this.map._fogChunks.push({
          darknessRt,
          fogRt,
          edgeRt,
          minX: cMinX,
          minY: cMinY,
          w: cW,
          h: cH,
          transform: new Matrix().translate(-cMinX, -cMinY),
          cells: [],
        })
      }
    }

    this._indexFogChunkCells()

    this.map._fogTickerCb = () => {
      if (this.map.context.map !== this.map) {
        this.map.context.app.ticker.remove(this.map._fogTickerCb)
        return
      }
      this.map._flushFogQueue()
    }
    this.map.context.app.ticker.add(this.map._fogTickerCb)
  }

  _createFogPatternSprite(x, y, width, height) {
    const pattern = new TilingSprite({
      texture: getFogPatternTexture(),
      width: Math.ceil(width),
      height: Math.ceil(height),
    })
    pattern.x = 0
    pattern.y = 0
    pattern.tilePosition.set(-Math.floor(x), -Math.floor(y))
    pattern.eventMode = 'none'
    return pattern
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
        const bounds = this.map._getFogCellBounds(cell)
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
    const [cx, cy] = this.map._getFogCellCenter(cell)
    return {
      minX: cx - hw,
      minY: cy - hh,
      maxX: cx + hw,
      maxY: cy + hh,
    }
  }

  _getFogChunksForCell(cell) {
    if (cell._fogChunks) return cell._fogChunks
    const bounds = this.map._getFogCellBounds(cell)
    cell._fogChunks = this.map._fogChunks.filter(
      chunk =>
        bounds.maxX >= chunk.minX &&
        bounds.minX <= chunk.minX + chunk.w &&
        bounds.maxY >= chunk.minY &&
        bounds.minY <= chunk.minY + chunk.h
    )
    return cell._fogChunks
  }

  _drawFogCellShape(graphics, cell) {
    const [top, right, bottom, left] = this.map._getFogCellPoints(cell)
    graphics.poly([top.x, top.y, right.x, right.y, bottom.x, bottom.y, left.x, left.y])
  }

  _getFogCellOpenSides(cell) {
    const { grid } = this.map
    const [top, right, bottom, left] = this.map._getFogCellPoints(cell)
    const sides = []
    const addSide = (neighbor, from, to) => {
      if (neighbor && !neighbor._hasFog) return
      sides.push({ from, to })
    }

    addSide(grid[cell.i - 1]?.[cell.j], left, top)
    addSide(grid[cell.i]?.[cell.j - 1], top, right)
    addSide(grid[cell.i + 1]?.[cell.j], right, bottom)
    addSide(grid[cell.i]?.[cell.j + 1], bottom, left)
    return sides
  }

  _signedDistanceToFogSide(point, from, to, cell) {
    const edgeX = to.x - from.x
    const edgeY = to.y - from.y
    const len = Math.hypot(edgeX, edgeY)
    if (len === 0) return 0
    const [cx, cy] = this.map._getFogCellCenter(cell)
    const pointCross = edgeX * (point.y - from.y) - edgeY * (point.x - from.x)
    const cellCross = edgeX * (cy - from.y) - edgeY * (cx - from.x)
    return (pointCross * Math.sign(cellCross || 1)) / len
  }

  _clipFogErasePolygonBySide(points, from, to, cell, inset) {
    const clipped = []
    const isInside = point => this.map._signedDistanceToFogSide(point, from, to, cell) >= inset
    const intersection = (a, b) => {
      const da = this.map._signedDistanceToFogSide(a, from, to, cell) - inset
      const db = this.map._signedDistanceToFogSide(b, from, to, cell) - inset
      const t = da / (da - db)
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      }
    }

    for (let i = 0; i < points.length; i++) {
      const current = points[i]
      const previous = points[(i + points.length - 1) % points.length]
      const currentInside = isInside(current)
      const previousInside = isInside(previous)

      if (currentInside) {
        if (!previousInside) clipped.push(intersection(previous, current))
        clipped.push(current)
      } else if (previousInside) {
        clipped.push(intersection(previous, current))
      }
    }

    return clipped
  }

  _drawFogEraseCellShape(graphics, cell, inset = 5) {
    let points = this.map._getFogCellPoints(cell)
    for (const { from, to } of this.map._getFogCellOpenSides(cell)) {
      points = this.map._clipFogErasePolygonBySide(points, from, to, cell, inset)
      if (points.length < 3) return
    }
    graphics.poly(points.flatMap(point => [point.x, point.y]))
  }

  _getFogEraseRefreshCells(cell) {
    const { grid } = this.map
    return [
      cell,
      grid[cell.i - 1]?.[cell.j],
      grid[cell.i]?.[cell.j - 1],
      grid[cell.i + 1]?.[cell.j],
      grid[cell.i]?.[cell.j + 1],
    ].filter(refreshCell => refreshCell && !refreshCell._hasFog)
  }

  _getFogCellCenter(cell) {
    return cartesianToIsometric(cell.i, cell.j)
  }

  _getFogCellPoints(cell) {
    const hw = _DW / 2
    const hh = _DH / 2
    const [cx, cy] = this.map._getFogCellCenter(cell)
    return [
      { x: cx, y: cy - hh },
      { x: cx + hw, y: cy },
      { x: cx, y: cy + hh },
      { x: cx - hw, y: cy },
    ]
  }

  _redrawFogEdgesInChunk(renderer, chunk) {
    renderer.render({ container: this.map._fogScratchEmptyContainer, target: chunk.edgeRt, clear: true })
  }

  _drawVisibleCellsInChunk(graphics, chunk) {
    for (const cell of chunk.cells) {
      if (cell._hasFog) continue
      this.map._drawFogEraseCellShape(graphics, cell)
    }
  }

  _indexFogChunkCells() {
    for (const chunk of this.map._fogChunks) {
      chunk.cells = []
    }

    if (!this.map.grid.length || !this.map.grid[0]) return

    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        cell._fogChunks = null
        const chunks = this.map._getFogChunksForCell(cell)
        for (const chunk of chunks) {
          chunk.cells.push(cell)
        }
      }
    }
  }

  _flushFogQueue() {
    if (!this.map._fogQueue || this.map._fogQueue.size === 0) return
    const renderer = this.map.context.app?.renderer
    if (!renderer) return

    const chunkUpdates = new globalThis.Map()
    const addChunkUpdate = (cell, state) => {
      const chunks = this.map._getFogChunksForCell(cell)
      for (const chunk of chunks) {
        let updates = chunkUpdates.get(chunk)
        if (!updates) {
          updates = new globalThis.Map()
          chunkUpdates.set(chunk, updates)
        }
        const previousState = updates.get(cell)
        if (previousState === undefined || FOG_UPDATE_PRIORITY[state] > FOG_UPDATE_PRIORITY[previousState]) {
          updates.set(cell, state)
        }
      }
    }

    for (const [cell, state] of this.map._fogQueue) {
      addChunkUpdate(cell, state)
      if (state === 'clear') {
        for (const refreshCell of this.map._getFogEraseRefreshCells(cell)) {
          if (refreshCell === cell) continue
          addChunkUpdate(refreshCell, 'refreshFogErase')
        }
      }
    }
    this.map._fogQueue.clear()

    const eraseContainer = this.map._fogScratchEraseContainer

    for (const [chunk, updates] of chunkUpdates) {
      const darknessDraw = new Graphics()
      const darknessErase = new Graphics()
      const fogErase = new Graphics()
      let hasDarknessDraw = false
      let hasDarknessErase = false
      let hasFogErase = false
      let needsFogRestore = false

      for (const [cell, state] of updates) {
        if (state === 'clear') {
          this.map._drawFogCellShape(darknessErase, cell)
          this.map._drawFogEraseCellShape(fogErase, cell)
          hasDarknessErase = true
          hasFogErase = true
        } else if (state === 'refreshFogErase') {
          this.map._drawFogEraseCellShape(fogErase, cell)
          hasFogErase = true
        } else if (state === 'fogViewed') {
          this.map._drawFogCellShape(darknessErase, cell)
          hasDarknessErase = true
          needsFogRestore = true
        } else {
          this.map._drawFogCellShape(darknessDraw, cell)
          hasDarknessDraw = true
        }
      }

      if (hasDarknessDraw) {
        darknessDraw.fill({ color: 0x000000 })
        renderer.render({ container: darknessDraw, target: chunk.darknessRt, transform: chunk.transform, clear: false })
      }
      if (hasDarknessErase) {
        darknessErase.blendMode = 'erase'
        darknessErase.fill({ color: 0xffffff })
        eraseContainer.removeChildren()
        eraseContainer.addChild(darknessErase)
        renderer.render({
          container: eraseContainer,
          target: chunk.darknessRt,
          transform: chunk.transform,
          clear: false,
        })
        eraseContainer.removeChildren()
      }
      if (needsFogRestore) {
        const pattern = this.map._createFogPatternSprite(chunk.minX, chunk.minY, chunk.w, chunk.h)
        renderer.render({ container: pattern, target: chunk.fogRt, clear: false })
        pattern.destroy()
        this.map._drawVisibleCellsInChunk(fogErase, chunk)
        hasFogErase = true
      }
      if (hasFogErase) {
        fogErase.blendMode = 'erase'
        fogErase.fill({ color: 0xffffff })
        eraseContainer.removeChildren()
        eraseContainer.addChild(fogErase)
        renderer.render({
          container: eraseContainer,
          target: chunk.fogRt,
          transform: chunk.transform,
          clear: false,
        })
        eraseContainer.removeChildren()
      }
      darknessDraw.destroy()
      darknessErase.destroy()
      fogErase.destroy()
    }

    for (const chunk of chunkUpdates.keys()) {
      this.map._redrawFogEdgesInChunk(renderer, chunk)
    }
  }
}
