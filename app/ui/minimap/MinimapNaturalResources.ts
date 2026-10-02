import { CompactResourceSet } from '../../classes/resources/CompactResourceSet'
import { cartesianToIsometric } from '../../lib/maths'
import type { MinimapHostLike } from '../../types/context'
import type { MinimapGeometry, MinimapTransform } from './MinimapGeometry'
import { showMinimapDetails } from './MinimapZoom'

const COLORS: Record<string, string> = {
  Tree: '#448c45',
  Berrybush: '#b8699b',
  Wheat: '#d8c16b',
  Stone: '#a9b0b7',
  Gold: '#e5bb45',
  Iron: '#8a839a',
  Copper: '#ce8659',
  MedicinalHerb: '#8abb69',
  ToxicHerb: '#9077a8',
  FiberPlant: '#79a674',
}

/** Resource dots are sampled into screen bins; no sprites or gameplay objects are loaded. */
export class MinimapNaturalResources {
  private key = ''
  private updated = -Infinity
  private dots: { x: number; y: number; color: string; visible: boolean }[] = []

  draw(
    menu: MinimapHostLike,
    geometry: MinimapGeometry,
    transform: MinimapTransform,
    spaceId: string,
    context: CanvasRenderingContext2D
  ): void {
    if (!showMinimapDetails(menu.context)) return
    const { map, player } = menu.context
    const key = `${spaceId}:${transform.layoutKey}:${map.revealEverything}`
    if (key !== this.key || Date.now() - this.updated >= 1000) {
      this.key = key
      this.updated = Date.now()
      const bins = new Map<string, (typeof this.dots)[number]>()
      const visit = (i: number, j: number, type: string, resourceSpace: string) => {
        if (resourceSpace !== spaceId || !COLORS[type]) return
        const [worldX, worldY] = cartesianToIsometric(i, j)
        const x = geometry.toMinimapX(worldX, transform),
          y = geometry.toMinimapY(worldY, transform)
        if (
          x < -transform.translate ||
          x > transform.canvasWidth - transform.translate ||
          y < 0 ||
          y > transform.canvasHeight
        )
          return
        if (!map.revealEverything && !player.views?.isViewed(i, j)) return
        const bin = `${Math.floor(x / 8)}:${Math.floor(y / 8)}`
        if (!bins.has(bin))
          bins.set(bin, {
            x,
            y,
            color: COLORS[type],
            visible: map.revealEverything || Boolean(player.views?.isVisible?.(i, j)),
          })
      }
      if (map.resources instanceof CompactResourceSet) map.resources.visitMapResources(visit)
      else
        for (const resource of map.resources) {
          if (!resource.isDead && !resource.isDestroyed)
            visit(resource.i, resource.j, resource.type, resource.spaceId || 'outside')
        }
      this.dots = [...bins.values()]
    }
    context.save()
    for (const dot of this.dots) {
      context.globalAlpha = dot.visible ? 0.9 : 0.45
      context.fillStyle = dot.color
      context.fillRect(dot.x - 3, dot.y - 3, 6, 6)
    }
    context.restore()
  }
}
