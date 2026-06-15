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
const OVERLAP = 4

export class ViewportFogRenderer {
  constructor(map) {
    this.map = map
    this.dirty = true
    this.viewportKey = ''
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
    const renderer = this.map.context.app?.renderer
    const views = this.map.context.player?.views
    if (!renderer || !views || !viewport || !this.map.fogLayer) return

    this.map.fogLayer.visible = !this.map.revealEverything
    if (this.map.revealEverything) return

    const left = Math.floor(viewport.visibleLeft - VIEWPORT_MARGIN)
    const top = Math.floor(viewport.visibleTop - VIEWPORT_MARGIN)
    const width = Math.max(1, Math.ceil(viewport.visibleWidth + VIEWPORT_MARGIN * 2))
    const height = Math.max(1, Math.ceil(viewport.visibleHeight + VIEWPORT_MARGIN * 2))
    const viewportKey = `${left}:${top}:${width}:${height}`

    if (!force && !this.dirty && viewportKey === this.viewportKey) return

    this._ensureTargets(width, height)
    this.left = left
    this.top = top
    this.viewportKey = viewportKey
    this.darknessSprite.position.set(left, top)
    this.fogSprite.position.set(left, top)

    const darkness = new Graphics()
    darkness.rect(0, 0, width, height).fill({ color: 0x000000 })
    renderer.render({ container: darkness, target: this.darknessTexture, clear: true })
    darkness.destroy()

    const pattern = new TilingSprite({
      texture: getFogPatternTexture(),
      width,
      height,
    })
    pattern.tilePosition.set(-left, -top)
    pattern.eventMode = 'none'
    renderer.render({ container: pattern, target: this.fogTexture, clear: true })
    pattern.destroy()

    const exploredErase = new Graphics()
    const visibleErase = new Graphics()
    this._drawViewportCells(exploredErase, visibleErase, views, left, top, width, height)
    this._erase(renderer, exploredErase, this.darknessTexture)
    this._erase(renderer, visibleErase, this.fogTexture)

    exploredErase.destroy()
    visibleErase.destroy()
    this.dirty = false
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
  }

  _drawViewportCells(exploredErase, visibleErase, views, left, top, width, height) {
    const corners = [
      isometricToCartesian(left, top),
      isometricToCartesian(left + width, top),
      isometricToCartesian(left, top + height),
      isometricToCartesian(left + width, top + height),
    ]
    const minI = Math.max(0, Math.min(...corners.map(point => point[0])) - CELL_MARGIN)
    const maxI = Math.min(this.map.size, Math.max(...corners.map(point => point[0])) + CELL_MARGIN)
    const minJ = Math.max(0, Math.min(...corners.map(point => point[1])) - CELL_MARGIN)
    const maxJ = Math.min(this.map.size, Math.max(...corners.map(point => point[1])) + CELL_MARGIN)

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
    const vx = [x, x + rx, x, x - rx]
    const vy = [y - ry, y, y + ry, y]
    for (let i = 0; i < 4; i++) {
      const p = (i + 3) % 4
      const n = (i + 1) % 4
      const ax = vx[p] + (vx[i] - vx[p]) * (1 - t)
      const ay = vy[p] + (vy[i] - vy[p]) * (1 - t)
      const bx = vx[i] + (vx[n] - vx[i]) * t
      const by = vy[i] + (vy[n] - vy[i]) * t
      if (i === 0) graphics.moveTo(ax, ay)
      else graphics.lineTo(ax, ay)
      graphics.quadraticCurveTo(vx[i], vy[i], bx, by)
    }
    graphics.closePath()
  }

  _erase(renderer, graphics, target) {
    graphics.blendMode = 'erase'
    const eraseContainer = new Container()
    eraseContainer.addChild(graphics)
    renderer.render({
      container: eraseContainer,
      target,
      transform: new Matrix(),
      clear: false,
    })
    eraseContainer.removeChild(graphics)
    eraseContainer.destroy()
  }

  _destroyTargets() {
    this.darknessSprite?.destroy({ texture: false, textureSource: false })
    this.fogSprite?.destroy({ texture: false, textureSource: false })
    this.darknessTexture?.destroy(true)
    this.fogTexture?.destroy(true)
    this.darknessSprite = null
    this.fogSprite = null
    this.darknessTexture = null
    this.fogTexture = null
  }

  destroy() {
    this._destroyTargets()
    this.map.fogLayer?.destroy({ children: true, texture: false, textureSource: false })
    this.map.fogLayer = null
    this.viewportKey = ''
    this.width = 0
    this.height = 0
    this.dirty = true
  }
}
