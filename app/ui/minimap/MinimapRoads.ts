import { CELL_HEIGHT, CELL_WIDTH } from '../../constants'
import type { MinimapHostLike } from '../../types/context'
import { MINIMAP_RESOLUTION_SCALE, type MinimapGeometry, type MinimapTransform } from './MinimapGeometry'

/** Draw the sparse saved network without reading/materializing the terrain grid. */
export function drawMinimapRoads(
  menu: MinimapHostLike,
  geometry: MinimapGeometry,
  transform: MinimapTransform,
  spaceId: string,
  context: CanvasRenderingContext2D
): void {
  const { map, player } = menu.context
  const roads = map.roads
  if (spaceId !== 'outside' || !roads?.cells.length) return
  const revealed = map.revealEverything || map.revealTerrain
  const viewed = (i: number, j: number) => revealed || player?.views?.isViewed(i, j)
  const point = (i: number, j: number) => ({
    x: geometry.toMinimapX(((i - j) * CELL_WIDTH) / 2, transform),
    y: geometry.toMinimapY(((i + j) * CELL_HEIGHT) / 2, transform),
  })
  context.save()
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.beginPath()
  for (const [id, mask] of roads.cells) {
    const i = Math.floor(id / roads.stride),
      j = id % roads.stride
    if (!viewed(i, j)) continue
    // SE and SW cover each reciprocal edge exactly once.
    for (const [bit, di, dj] of [
      [2, 1, 0],
      [4, 0, 1],
    ]) {
      if (!(mask & bit) || !viewed(i + di, j + dj)) continue
      const a = point(i, j),
        b = point(i + di, j + dj)
      const margin = MINIMAP_RESOLUTION_SCALE * 2
      if (
        Math.max(a.x, b.x) < -transform.translate - margin ||
        Math.min(a.x, b.x) > transform.canvasWidth - transform.translate + margin ||
        Math.max(a.y, b.y) < -margin ||
        Math.min(a.y, b.y) > transform.canvasHeight + margin
      )
        continue
      context.moveTo(a.x, a.y)
      context.lineTo(b.x, b.y)
    }
  }
  // A restrained outline keeps dirt paths readable on sand and snow too.
  context.strokeStyle = '#65513a'
  context.lineWidth = MINIMAP_RESOLUTION_SCALE * 1.1
  context.stroke()
  context.strokeStyle = '#edc88c'
  context.lineWidth = MINIMAP_RESOLUTION_SCALE * 0.65
  context.stroke()
  context.restore()
}
