import { Container, Matrix, RenderTexture, Sprite } from 'pixi.js'
import { getShadowsEnabled } from '../lib/audio/settings'
import {
  ensureOutsideMapSpace,
  getActiveMapSpace,
  getMapSpaceShadowLayer,
  getMapSpaceShadowRenderContainer,
} from '../lib/mapSpaces'
import type { GameContextLike } from '../types/context'
import type { RuntimeMap, RuntimeMapSpace } from '../types/map'

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
const SHADOW_RENDER_OFFSET_Y = 3
type ShadowRenderContainer = Container | RuntimeMap

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

    this._onTick = ticker => {
      const update = () => this.update(ticker.deltaMS ?? ticker.elapsedMS ?? TARGET_FRAME_MS)
      this.context.performance?.measure?.('shadow.update', update) ?? update()
    }
    context.app.ticker.add(this._onTick)
  }

  getActiveShadowSpace(): RuntimeMapSpace {
    return getActiveMapSpace(this.map) ?? ensureOutsideMapSpace(this.map)
  }

  attachLayerTo(container: ShadowRenderContainer): void {
    if (this.layer.parent === container) return
    this.layer.parent?.removeChild(this.layer)
    container.addChild(this.layer)
    ;(container as ShadowRenderContainer & { sortChildren?: () => void }).sortChildren?.()
  }

  update(_elapsedMs: number): void {
    const space = this.getActiveShadowSpace()
    const sourceLayer = getMapSpaceShadowLayer(this.map, space)
    const renderContainer = getMapSpaceShadowRenderContainer(this.map, space)
    if (!renderContainer) {
      this.layer.visible = false
      return
    }
    this.attachLayerTo(renderContainer)
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
    const origin = space.origin ?? { x: 0, y: 0 }
    this.sprite.position.set(viewport.visibleLeft - origin.x, viewport.visibleTop - origin.y + SHADOW_RENDER_OFFSET_Y)
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
