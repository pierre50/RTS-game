import { CELL_HEIGHT,CELL_WIDTH } from '../../constants'
import type { MinimapHostLike } from '../../types/context'
import { MINIMAP_RESOLUTION_SCALE,type MinimapGeometry,type MinimapTransform } from './MinimapGeometry'

export function drawMinimapQuestMarkers(
  context: CanvasRenderingContext2D,
  menu: MinimapHostLike,
  geometry: MinimapGeometry,
  transform: MinimapTransform
): void {
  const { factor } = transform
  const space = geometry.getMinimapSpace()
  const regionId = menu.context.map.worldRegionId ?? menu.context.getCurrentWorldId?.() ?? ''
  const markers = menu.context.neutralQuests?.system.getTrackedMarkers(space.id, regionId) ?? []
  for (const marker of markers) {
    const cell = space.grid[marker.position.i]?.[marker.position.j]
    if (!cell) continue
    const point = geometry.cellToMinimapPoint(cell, transform)
    context.save()
    context.strokeStyle = '#f4d36a'
    context.fillStyle = 'rgba(244, 211, 106, 0.18)'
    context.lineWidth = 2 * MINIMAP_RESOLUTION_SCALE
    context.beginPath()
    context.ellipse(
      point.x,
      point.y,
      ((marker.radius ?? 1) * CELL_WIDTH) / (2 * factor),
      ((marker.radius ?? 1) * CELL_HEIGHT) / (2 * factor),
      0,
      0,
      Math.PI * 2
    )
    context.fill()
    context.stroke()
    context.restore()
  }
}
