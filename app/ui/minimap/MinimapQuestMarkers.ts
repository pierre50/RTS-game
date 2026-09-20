import { CELL_HEIGHT, CELL_WIDTH } from '../../constants'
import type { MinimapHostLike } from '../../types/context'
import { MINIMAP_RESOLUTION_SCALE, type MinimapGeometry, type MinimapTransform } from './MinimapGeometry'

export function drawMinimapQuestMarkers(
  context: CanvasRenderingContext2D,
  menu: MinimapHostLike,
  geometry: MinimapGeometry,
  transform: MinimapTransform
): void {
  const { factor } = transform
  const space = geometry.getMinimapSpace()
  const regionId = menu.context.map.worldRegionId ?? menu.context.getCurrentWorldId?.() ?? ''
  const markers = menu.context.neutralQuests?.getTrackedMarkers(space.id, regionId) ?? []
  for (const marker of markers) {
    const cell = space.grid[marker.position.i]?.[marker.position.j]
    if (!cell) continue
    const point = geometry.cellToMinimapPoint(cell, transform)
    context.save()
    context.strokeStyle = '#f4d36a'
    context.fillStyle = 'rgba(244, 211, 106, 0.18)'
    context.lineWidth = 2 * MINIMAP_RESOLUTION_SCALE
    if (marker.kind === 'return') {
      context.font = `bold ${16 * MINIMAP_RESOLUTION_SCALE}px sans-serif`
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.lineWidth = 3 * MINIMAP_RESOLUTION_SCALE
      context.strokeStyle = '#101730'
      context.fillStyle = '#f4d36a'
      context.strokeText('?', point.x, point.y)
      context.fillText('?', point.x, point.y)
      context.restore()
      continue
    }
    context.beginPath()
    context.ellipse(
      point.x,
      point.y,
      Math.max(4 * MINIMAP_RESOLUTION_SCALE, ((marker.radius ?? 1) * CELL_WIDTH) / (2 * factor)),
      Math.max(3 * MINIMAP_RESOLUTION_SCALE, ((marker.radius ?? 1) * CELL_HEIGHT) / (2 * factor)),
      0,
      0,
      Math.PI * 2
    )
    context.fill()
    context.stroke()
    context.restore()
  }
}
