import { Container, Sprite, RenderTexture, Matrix, Graphics, TilingSprite } from 'pixi.js'
import { CELL_WIDTH, CELL_HEIGHT, CELL_DEPTH } from '../../constants'
import { _DW, _DH, getFogPatternTexture } from '../cell/CellFog'
import { cartesianToIsometric } from '../../lib'

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
        this.map.addChild(sprite)
      }
    }

    const { player } = this.map.context
    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        if (player.views[i]?.[j]?.viewed) {
          cell.updateVisible()
        }
      }
    }
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
          renderer.render({ container: blackG, target: darknessRt, transform: new Matrix().translate(-cMinX, -cMinY), clear: false })
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
        })
      }
    }

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
    const bounds = this.map._getFogCellBounds(cell)
    return this.map._fogChunks.filter(chunk =>
      bounds.maxX >= chunk.minX &&
      bounds.minX <= chunk.minX + chunk.w &&
      bounds.maxY >= chunk.minY &&
      bounds.minY <= chunk.minY + chunk.h
    )
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
    return pointCross * Math.sign(cellCross || 1) / len
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
    const emptyC = new Container()
    renderer.render({ container: emptyC, target: chunk.edgeRt, clear: true })
    emptyC.destroy()
  }

  _drawVisibleCellsInChunk(graphics, chunk) {
    const maxX = chunk.minX + chunk.w
    const maxY = chunk.minY + chunk.h
    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        if (cell._hasFog) continue
        const bounds = this.map._getFogCellBounds(cell)
        if (
          bounds.maxX >= chunk.minX &&
          bounds.minX <= maxX &&
          bounds.maxY >= chunk.minY &&
          bounds.minY <= maxY
        ) {
          this.map._drawFogEraseCellShape(graphics, cell)
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
        if (!chunkUpdates.has(chunk)) chunkUpdates.set(chunk, [])
        chunkUpdates.get(chunk).push({ cell, state })
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

    for (const [chunk, updates] of chunkUpdates) {
      const transform = new Matrix().translate(-chunk.minX, -chunk.minY)
      const darknessDraw = new Graphics()
      const darknessErase = new Graphics()
      const fogErase = new Graphics()
      let hasDarknessDraw = false
      let hasDarknessErase = false
      let hasFogErase = false
      let needsFogRestore = false

      for (const { cell, state } of updates) {
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
        renderer.render({ container: darknessDraw, target: chunk.darknessRt, transform, clear: false })
      }
      if (hasDarknessErase) {
        darknessErase.blendMode = 'erase'
        darknessErase.fill({ color: 0xffffff })
        const eraseContainer = new Container()
        eraseContainer.addChild(darknessErase)
        renderer.render({ container: eraseContainer, target: chunk.darknessRt, transform, clear: false })
        eraseContainer.removeChildren()
        eraseContainer.destroy()
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
        const eraseContainer = new Container()
        eraseContainer.addChild(fogErase)
        renderer.render({ container: eraseContainer, target: chunk.fogRt, transform, clear: false })
        eraseContainer.removeChildren()
        eraseContainer.destroy()
      }
      darknessDraw.destroy()
      darknessErase.destroy()
      fogErase.destroy()
    }

    for (const chunk of this.map._fogChunks) {
      this.map._redrawFogEdgesInChunk(renderer, chunk)
    }
  }
}
