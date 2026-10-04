import type { MinimapHostLike } from '../../types/context'
import { MINIMAP_RESOLUTION_SCALE, type MinimapGeometry, type MinimapTransform } from './MinimapGeometry'

/** Quest destinations are known information, independent of terrain exploration and entity filters. */
export function drawMinimapQuestMarkers(
  menu: MinimapHostLike,
  geometry: MinimapGeometry,
  transform: MinimapTransform,
  context: CanvasRenderingContext2D
): void {
  const { map, neutralQuests } = menu.context
  const regionId = map.worldRegionId ?? menu.context.getCurrentWorldId?.() ?? ''
  const space = geometry.getMinimapSpace()
  const markers = neutralQuests?.getTrackedMarkers(space.id, regionId) ?? []
  for (const marker of markers) {
    const cell = space.grid[marker.position.i]?.[marker.position.j]
    if (!cell) continue
    const point = geometry.cellToMinimapPoint(cell, transform)
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue
    const scale = MINIMAP_RESOLUTION_SCALE
    const radius = 6 * scale
    context.save()
    context.beginPath()
    context.ellipse(point.x, point.y, radius, radius, 0, 0, Math.PI * 2)
    context.fillStyle = '#e9b949'
    context.fill()
    context.strokeStyle = '#241a08'
    context.lineWidth = 1.5 * scale
    context.stroke()
    context.fillStyle = '#241a08'
    context.font = `bold ${9 * scale}px sans-serif`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(marker.kind === 'return' ? '?' : '!', point.x, point.y)
    context.restore()
  }
}
