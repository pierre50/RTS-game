import { Container, Graphics, Matrix, RenderTexture, Sprite, TilingSprite } from 'pixi.js'
import { CELL_HEIGHT, CELL_WIDTH } from '../../constants'
import { cartesianToIsometric, isometricToCartesian } from '../../lib'
import { getFogPatternTexture } from '../cell/CellFog'

const VIEWPORT_MARGIN = CELL_WIDTH * 2
const CELL_MARGIN = 3
const REVEAL_RX = CELL_WIDTH / 2
const REVEAL_RY = CELL_HEIGHT / 2
const FOG_BAND = 20
const CORNER_RADIUS = 10
const OVERLAP = 10

export class ViewportFogRenderer {
  constructor(map) {
    this.map = map
    this.dirty = true
    this.width = 0
    this.height = 0
    this.left = 0
    this.top = 0
  }

  initialize() {
    this.destroy()

    const { map } = this
    map.fogLayer = new Container()
    map.fogLayer.eventMode = 'none'
    map.fogLayer.zIndex = 1e9
    map.addChild(map.fogLayer)

    if (map.revealEverything) {
      map.fogLayer.visible = false
      return
    }

    this.update(map.context.controls?.cameraController?.getViewportRect(), true)
  }

  invalidate() {
    this.dirty = true
  }

  update(viewport, force = false) {
    const startedAt = performance.now()
    const renderer = this.map.context.app?.renderer
    const views = this.map.context.player?.views
    if (!renderer || !views || !viewport || !this.map.fogLayer) return
    try {
      this.map.fogLayer.visible = !this.map.revealEverything
      if (this.map.revealEverything) return

      const left = Math.floor(viewport.visibleLeft - VIEWPORT_MARGIN)
      const top = Math.floor(viewport.visibleTop - VIEWPORT_MARGIN)
      const width = Math.max(1, Math.ceil(viewport.visibleWidth + VIEWPORT_MARGIN * 2))
      const height = Math.max(1, Math.ceil(viewport.visibleHeight + VIEWPORT_MARGIN * 2))

      const viewportCovered =
        this.darknessTexture &&
        this.fogTexture &&
        left >= this.left &&
        top >= this.top &&
        left + width <= this.left + this.width &&
        top + height <= this.top + this.height

      if (!force && !this.dirty && viewportCovered) return

      this._ensureTargets(width, height)
      this.left = left
      this.top = top
      this.darknessSprite.position.set(left, top)
      this.fogSprite.position.set(left, top)

      renderer.render({ container: this._darknessFill, target: this.darknessTexture, clear: true })

      this._fogPattern.tilePosition.set(-left, -top)
      renderer.render({ container: this._fogPattern, target: this.fogTexture, clear: true })

      this._exploredErase.clear()
      this._visibleErase.clear()
      this._drawViewportCells(this._exploredErase, this._visibleErase, views, left, top, width, height)
      this._erase(renderer, this._exploredErase, this.darknessTexture, this._darknessEraseContainer)
      this._erase(renderer, this._visibleErase, this.fogTexture, this._fogEraseContainer)

      this.dirty = false
    } finally {
      this.map.context.performance?.record('fog.viewport', performance.now() - startedAt)
    }
  }

  _ensureTargets(width, height) {
    if (this.width === width && this.height === height && this.darknessTexture && this.fogTexture) return

    this._destroyTargets()
    this.width = width
    this.height = height
    this.darknessTexture = RenderTexture.create({ width, height })
    this.fogTexture = RenderTexture.create({ width, height })
    this.darknessSprite = new Sprite(this.darknessTexture)
    this.fogSprite = new Sprite(this.fogTexture)
    this.darknessSprite.eventMode = 'none'
    this.fogSprite.eventMode = 'none'
    this.map.fogLayer.addChild(this.darknessSprite, this.fogSprite)

    // Cache objects reused on every fog update to avoid GC pressure
    this._darknessFill = new Graphics()
    this._darknessFill.rect(0, 0, width, height).fill({ color: 0x000000 })
    this._fogPattern = new TilingSprite({ texture: getFogPatternTexture(), width, height })
    this._fogPattern.eventMode = 'none'
    this._exploredErase = new Graphics()
    this._visibleErase = new Graphics()
    this._darknessEraseContainer = new Container()
    this._fogEraseContainer = new Container()
    this._eraseMatrix = new Matrix()
  }

  _drawViewportCells(exploredErase, visibleErase, views, left, top, width, height) {
    const [c0, c1, c2, c3] = [
      isometricToCartesian(left, top),
      isometricToCartesian(left + width, top),
      isometricToCartesian(left, top + height),
      isometricToCartesian(left + width, top + height),
    ]
    const minI = Math.max(0, Math.min(c0[0], c1[0], c2[0], c3[0]) - CELL_MARGIN)
    const maxI = Math.min(this.map.size, Math.max(c0[0], c1[0], c2[0], c3[0]) + CELL_MARGIN)
    const minJ = Math.max(0, Math.min(c0[1], c1[1], c2[1], c3[1]) - CELL_MARGIN)
    const maxJ = Math.min(this.map.size, Math.max(c0[1], c1[1], c2[1], c3[1]) + CELL_MARGIN)

    for (let i = minI; i <= maxI; i++) {
      for (let j = minJ; j <= maxJ; j++) {
        const explored = this.map.revealTerrain || views.isViewed(i, j)
        const visible = views.isVisible(i, j)
        if (!explored && !visible) continue

        const [worldX, worldY] = cartesianToIsometric(i, j)
        const x = worldX - left
        const y = worldY - top
        this._drawShape(exploredErase, x, y, REVEAL_RX + FOG_BAND + OVERLAP, REVEAL_RY + FOG_BAND / 2 + OVERLAP / 2)
        if (visible) this._drawShape(visibleErase, x, y, REVEAL_RX + OVERLAP, REVEAL_RY + OVERLAP / 2)
      }
    }

    exploredErase.fill({ color: 0xffffff })
    visibleErase.fill({ color: 0xffffff })
  }

  _drawShape(graphics, x, y, rx, ry) {
    const L = Math.sqrt(rx * rx + ry * ry)
    const t = Math.min(CORNER_RADIUS / L, 0.45)
    const t1 = 1 - t
    // Diamond vertices: top, right, bottom, left
    const v0x = x,
      v0y = y - ry
    const v1x = x + rx,
      v1y = y
    const v2x = x,
      v2y = y + ry
    const v3x = x - rx,
      v3y = y
    // i=0 (top): prev=3, next=1
    graphics.moveTo(v3x + (v0x - v3x) * t1, v3y + (v0y - v3y) * t1)
    graphics.quadraticCurveTo(v0x, v0y, v0x + (v1x - v0x) * t, v0y + (v1y - v0y) * t)
    // i=1 (right): prev=0, next=2
    graphics.lineTo(v0x + (v1x - v0x) * t1, v0y + (v1y - v0y) * t1)
    graphics.quadraticCurveTo(v1x, v1y, v1x + (v2x - v1x) * t, v1y + (v2y - v1y) * t)
    // i=2 (bottom): prev=1, next=3
    graphics.lineTo(v1x + (v2x - v1x) * t1, v1y + (v2y - v1y) * t1)
    graphics.quadraticCurveTo(v2x, v2y, v2x + (v3x - v2x) * t, v2y + (v3y - v2y) * t)
    // i=3 (left): prev=2, next=0
    graphics.lineTo(v2x + (v3x - v2x) * t1, v2y + (v3y - v2y) * t1)
    graphics.quadraticCurveTo(v3x, v3y, v3x + (v0x - v3x) * t, v3y + (v0y - v3y) * t)
    graphics.closePath()
  }

  _erase(renderer, graphics, target, container) {
    graphics.blendMode = 'erase'
    container.addChild(graphics)
    renderer.render({ container, target, transform: this._eraseMatrix, clear: false })
    container.removeChild(graphics)
  }

  _destroyTargets() {
    this.darknessSprite?.destroy({ texture: false, textureSource: false })
    this.fogSprite?.destroy({ texture: false, textureSource: false })
    this.darknessTexture?.destroy(true)
    this.fogTexture?.destroy(true)
    this._darknessFill?.destroy()
    this._fogPattern?.destroy()
    this._exploredErase?.destroy()
    this._visibleErase?.destroy()
    this._darknessEraseContainer?.destroy()
    this._fogEraseContainer?.destroy()
    this.darknessSprite = null
    this.fogSprite = null
    this.darknessTexture = null
    this.fogTexture = null
    this._darknessFill = null
    this._fogPattern = null
    this._exploredErase = null
    this._visibleErase = null
    this._darknessEraseContainer = null
    this._fogEraseContainer = null
    this._eraseMatrix = null
  }

  destroy() {
    this._destroyTargets()
    this.map.fogLayer?.destroy({ children: true, texture: false, textureSource: false })
    this.map.fogLayer = null
    this.width = 0
    this.height = 0
    this.dirty = true
  }
}
