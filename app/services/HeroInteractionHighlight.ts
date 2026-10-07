import { Graphics, type Container } from 'pixi.js'
import type { RuntimeEntity } from '../types/entities'
import { getContactTargetShape } from '../lib/contact/contactGeometry'
import { drawRoundedIsoShape } from '../lib/graphics/isoFootprint'

/** A separate overlay leaves the player's selection and entity textures untouched. */
export class HeroInteractionHighlight {
  private graphic: Graphics | null = null

  update(target: RuntimeEntity | null): void {
    const parent = (target as (RuntimeEntity & { parent?: Container }) | null)?.parent
    if (!target || !parent || target.isDestroyed || target.visible === false) {
      this.clear()
      return
    }
    const graphic = this.graphic ?? (this.graphic = new Graphics())
    graphic.eventMode = 'none'
    if (graphic.parent !== parent) parent.addChild(graphic)
    graphic.zIndex = (target.zIndex ?? 0) + 0.1
    graphic.clear()
    drawRoundedIsoShape(graphic, [...getContactTargetShape(target)])
    graphic.fill({ color: 0xffdf8a, alpha: 0.12 }).stroke({ color: 0xffdf8a, alpha: 0.8, width: 2 })
  }

  clear(): void {
    this.graphic?.destroy()
    this.graphic = null
  }
}
