import { Container, Graphics, Matrix, RenderTexture, Sprite, TilingSprite } from 'pixi.js'
import { CELL_HEIGHT, CELL_WIDTH } from '../../../constants'
import { isometricToCartesian } from '../../../lib'
import type { Viewport } from '../../../types/geometry'
import type { RuntimeCell } from '../../../types/map'
import type { VisionGridLike } from '../../../types/player'
import { getFogPatternTexture } from '../../cell/CellFog'

type FogPerformanceMonitor = {
  measure?<T>(name: string, callback: () => T): T
  record?(name: string, value: number): void
}

type PixiRendererLike = {
  render(options: { container: Container; target: RenderTexture; transform?: Matrix | null; clear?: boolean }): void
}

type FogRendererMap = {
  size: number
  grid: RuntimeCell[][]
  revealEverything?: boolean
  revealTerrain?: boolean
  fogMemoryLayer?: Container | null
  fogLayer?: Container | null
  addChild<T extends Container>(child: T): T
  context: {
    app?: { renderer?: PixiRendererLike }
    player?: { views?: Pick<VisionGridLike, 'isViewed' | 'isVisible'> } | null
    controls?: object | null
    performance?: FogPerformanceMonitor | null
  }
}

type FogRevealCell = RuntimeCell & {
  _terrainAppearance?: {
    relief?: { elevation?: number | null } | null
  }
}

type FogRevealShape = {
  x: number
  y: number
  rx: number
  ry: number
}

function getFogViewport(controls: FogRendererMap['context']['controls']): Viewport | undefined {
  if (!controls || typeof controls !== 'object') return undefined
  const cameraController = (controls as { cameraController?: { getViewportRect?: () => Viewport } }).cameraController
  if (!cameraController || typeof cameraController !== 'object') return undefined
  const getViewportRect = cameraController.getViewportRect
  if (typeof getViewportRect !== 'function') return undefined
  return getViewportRect.call(cameraController) as Viewport
}

const VIEWPORT_MARGIN = CELL_WIDTH * 2
const CACHE_MARGIN = CELL_WIDTH * 2
const CACHE_SNAP = CELL_WIDTH
const CELL_MARGIN = 3
const REVEAL_RX = CELL_WIDTH / 2
const REVEAL_RY = CELL_HEIGHT / 2
const FOG_BAND = 20
const CORNER_RADIUS = 10
const OVERLAP = 14
const DIRTY_REDRAW_INTERVAL_MS = 80

export function getFogRevealShape(cell: FogRevealCell, rx: number, ry: number): FogRevealShape {
  const reliefElevation = Math.max(0, cell._terrainAppearance?.relief?.elevation ?? 0)
  return {
    x: cell.x,
    y: cell.y + reliefElevation / 2,
    rx,
    ry: ry + reliefElevation / 2,
  }
}

export class ViewportFogRenderer {
  map: FogRendererMap
  dirty: boolean
  width: number
  height: number
  left: number
  top: number
  lastRedrawAt: number
  darknessTexture?: RenderTexture | null
  fogTexture?: RenderTexture | null
  darknessSprite?: Sprite | null
  fogSprite?: Sprite | null
  _darknessFill?: Graphics | null
  _fogPattern?: TilingSprite | null
  _exploredErase?: Graphics | null
  _visibleErase?: Graphics | null
  _darknessEraseContainer?: Container | null
  _fogEraseContainer?: Container | null
  _eraseMatrix?: Matrix | null

  constructor(map: FogRendererMap) {
    this.map = map
    this.dirty = true
    this.width = 0
    this.height = 0
    this.left = 0
    this.top = 0
    this.lastRedrawAt = 0
  }

  initialize(): void {
    this.destroy()

    const { map } = this
    map.fogMemoryLayer = new Container()
    map.fogMemoryLayer.eventMode = 'none'
    map.fogMemoryLayer.sortableChildren = true
    map.fogMemoryLayer.zIndex = 1e9 - 1
    map.addChild(map.fogMemoryLayer)

    map.fogLayer = new Container()
    map.fogLayer.eventMode = 'none'
    map.fogLayer.zIndex = 1e9
    map.addChild(map.fogLayer)

    if (map.revealEverything) {
      map.fogMemoryLayer.visible = false
      map.fogLayer.visible = false
      return
    }

    this.update(getFogViewport(map.context.controls), true)
  }

  invalidate(): void {
    this.dirty = true
  }

  update(viewport?: Viewport | null, force: boolean = false): void {
    const startedAt = performance.now()
    let didRedraw = false
    const renderer = this.map.context.app?.renderer
    const views = this.map.context.player?.views
    if (!renderer || !views || !viewport || !this.map.fogLayer) return
    try {
      if (this.map.fogMemoryLayer) this.map.fogMemoryLayer.visible = !this.map.revealEverything
      this.map.fogLayer.visible = !this.map.revealEverything
      if (this.map.revealEverything) return

      const requiredLeft = Math.floor(viewport.visibleLeft - VIEWPORT_MARGIN)
      const requiredTop = Math.floor(viewport.visibleTop - VIEWPORT_MARGIN)
      const requiredWidth = Math.max(1, Math.ceil(viewport.visibleWidth + VIEWPORT_MARGIN * 2))
      const requiredHeight = Math.max(1, Math.ceil(viewport.visibleHeight + VIEWPORT_MARGIN * 2))

      const viewportCovered =
        this.darknessTexture &&
        this.fogTexture &&
        requiredLeft >= this.left &&
        requiredTop >= this.top &&
        requiredLeft + requiredWidth <= this.left + this.width &&
        requiredTop + requiredHeight <= this.top + this.height

      const now = performance.now()
      if (!force && viewportCovered) {
        if (!this.dirty) return
        if (now - this.lastRedrawAt < DIRTY_REDRAW_INTERVAL_MS) return
      }

      didRedraw = true
      this.lastRedrawAt = now
      const left = Math.floor((requiredLeft - CACHE_MARGIN) / CACHE_SNAP) * CACHE_SNAP
      const top = Math.floor((requiredTop - CACHE_MARGIN) / CACHE_SNAP) * CACHE_SNAP
      const right = Math.ceil((requiredLeft + requiredWidth + CACHE_MARGIN) / CACHE_SNAP) * CACHE_SNAP
      const bottom = Math.ceil((requiredTop + requiredHeight + CACHE_MARGIN) / CACHE_SNAP) * CACHE_SNAP
      const width = Math.max(1, right - left)
      const height = Math.max(1, bottom - top)
      this._ensureTargets(width, height)
      this.left = left
      this.top = top
      this.darknessSprite?.position.set(left, top)
      this.fogSprite?.position.set(left, top)

      const performanceMonitor = this.map.context.performance
      const renderBase = () => {
        if (!this._darknessFill || !this._fogPattern || !this.darknessTexture || !this.fogTexture) return
        renderer.render({ container: this._darknessFill, target: this.darknessTexture, clear: true })

        this._fogPattern.tilePosition.set(-left, -top)
        renderer.render({ container: this._fogPattern, target: this.fogTexture, clear: true })
      }
      const drawCells = () => {
        if (!this._exploredErase || !this._visibleErase) return
        this._exploredErase.clear()
        this._visibleErase.clear()
        this._drawViewportCells(this._exploredErase, this._visibleErase, views, left, top, width, height)
      }
      const eraseMasks = () => {
        if (
          !this._exploredErase ||
          !this._visibleErase ||
          !this.darknessTexture ||
          !this.fogTexture ||
          !this._darknessEraseContainer ||
          !this._fogEraseContainer
        )
          return
        this._erase(renderer, this._exploredErase, this.darknessTexture, this._darknessEraseContainer)
        this._erase(renderer, this._visibleErase, this.fogTexture, this._fogEraseContainer)
      }

      performanceMonitor?.measure?.('fog.viewport.base', renderBase) ?? renderBase()
      performanceMonitor?.measure?.('fog.viewport.drawCells', drawCells) ?? drawCells()
      performanceMonitor?.measure?.('fog.viewport.erase', eraseMasks) ?? eraseMasks()

      this.dirty = false
    } finally {
      this.map.context.performance?.record?.(
        didRedraw ? 'fog.viewport' : 'fog.viewportSkip',
        performance.now() - startedAt
      )
    }
  }

  _ensureTargets(width: number, height: number): void {
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
    this.map.fogLayer?.addChild(this.darknessSprite, this.fogSprite)

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

  _drawViewportCells(
    exploredErase: Graphics,
    visibleErase: Graphics,
    views: Pick<VisionGridLike, 'isViewed' | 'isVisible'>,
    left: number,
    top: number,
    width: number,
    height: number
  ): void {
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

        const cell = this.map.grid[i]?.[j]
        if (!cell) continue

        const exploredShape = getFogRevealShape(
          cell as FogRevealCell,
          REVEAL_RX + FOG_BAND + OVERLAP,
          REVEAL_RY + FOG_BAND / 2 + OVERLAP / 2
        )
        this._drawShape(exploredErase, exploredShape.x - left, exploredShape.y - top, exploredShape.rx, exploredShape.ry)
        if (visible) {
          const visibleShape = getFogRevealShape(cell as FogRevealCell, REVEAL_RX + OVERLAP, REVEAL_RY + OVERLAP / 2)
          this._drawShape(visibleErase, visibleShape.x - left, visibleShape.y - top, visibleShape.rx, visibleShape.ry)
        }
      }
    }

    exploredErase.fill({ color: 0xffffff })
    visibleErase.fill({ color: 0xffffff })
  }

  _drawShape(graphics: Graphics, x: number, y: number, rx: number, ry: number): void {
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

  _erase(renderer: PixiRendererLike, graphics: Graphics, target: RenderTexture, container: Container): void {
    graphics.blendMode = 'erase'
    container.addChild(graphics)
    renderer.render({ container, target, transform: this._eraseMatrix, clear: false })
    container.removeChild(graphics)
  }

  _destroyTargets(): void {
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

  destroy(): void {
    this._destroyTargets()
    this.map.fogLayer?.destroy({ children: true, texture: false, textureSource: false })
    this.map.fogLayer = null
    this.map.fogMemoryLayer?.destroy({ children: true, texture: false, textureSource: false })
    this.map.fogMemoryLayer = null
    this.width = 0
    this.height = 0
    this.dirty = true
  }
}
