import { Container, Matrix, RenderTexture, Sprite } from 'pixi.js'
import { getShadowsEnabled } from '../lib/settings'
import type { GameContextLike } from '../types/context'
import type { RuntimeMap } from '../types/map'

type TickerLike = { deltaMS?: number; elapsedMS?: number }
type ViewportMetrics = {
  visibleHeight: number
  visibleLeft: number
  visibleTop: number
  visibleWidth: number
}

const TARGET_FRAME_MS = 1000 / 60
const SHADOW_ALPHA = 0.42
const SHADOW_LAYER_Z_INDEX = 0.5

export class ShadowSystem {
  context: GameContextLike
  layer: Container
  map: RuntimeMap
  sprite: Sprite
  texture: RenderTexture
  transform: Matrix
  _onTick: (ticker: TickerLike) => void

  constructor(context: GameContextLike, map: RuntimeMap) {
    this.context = context
    this.map = map
    this.texture = RenderTexture.create({ width: 1, height: 1, dynamic: true })
    this.texture.source.autoGarbageCollect = false
    this.sprite = new Sprite(this.texture)
    this.sprite.alpha = SHADOW_ALPHA
    this.sprite.eventMode = 'none'
    this.sprite.roundPixels = true
    this.layer = new Container()
    this.layer.eventMode = 'none'
    this.layer.label = 'shadow-mask-layer'
    this.layer.zIndex = SHADOW_LAYER_Z_INDEX
    this.layer.addChild(this.sprite)
    this.transform = new Matrix()

    map.addChild(this.layer)

    this._onTick = ticker => this.update(ticker.deltaMS ?? ticker.elapsedMS ?? TARGET_FRAME_MS)
    context.app.ticker.add(this._onTick)
  }

  update(_elapsedMs: number): void {
    const sourceLayer = this.map.shadowLayer
    if (!sourceLayer || !getShadowsEnabled() || sourceLayer.children.length === 0) {
      this.layer.visible = false
      return
    }

    const viewport = this.context.controls?.getViewportMetrics?.() as ViewportMetrics | undefined
    if (!viewport) {
      this.layer.visible = false
      return
    }

    this.layer.visible = true
    this.resizeTexture(viewport)
    this.sprite.position.set(viewport.visibleLeft, viewport.visibleTop)
    this.sprite.width = viewport.visibleWidth
    this.sprite.height = viewport.visibleHeight
    this.transform.identity()
    this.transform.translate(-viewport.visibleLeft, -viewport.visibleTop)
    this.context.app.renderer.render({
      clear: true,
      clearColor: [0, 0, 0, 0],
      container: sourceLayer,
      target: this.texture,
      transform: this.transform,
    })
  }

  resizeTexture(viewport: ViewportMetrics): void {
    const width = Math.max(1, Math.ceil(viewport.visibleWidth))
    const height = Math.max(1, Math.ceil(viewport.visibleHeight))
    if (this.texture.width !== width || this.texture.height !== height) {
      this.texture.resize(width, height)
    }
  }

  destroy(): void {
    this.context.app.ticker.remove(this._onTick)
    this.layer.parent?.removeChild(this.layer)
    this.layer.destroy({ children: true, texture: false })
    this.texture.destroy(true)
  }
}
