import { MINIMAP_RESOLUTION_SCALE } from './MinimapGeometry'

import { minimapMarkerIcon, type MinimapMarkerKind as MarkerKind } from './MinimapMarkerIcons'
const icons = new Map<MarkerKind, HTMLImageElement>()

export function drawMinimapMarker(
  context: CanvasRenderingContext2D,
  kind: MarkerKind,
  point: { x: number; y: number },
  color: string,
  redraw: () => void,
  selected = false,
  markerScale = 1
): void {
  const scale = MINIMAP_RESOLUTION_SCALE * markerScale
  const size = 10 * scale
  context.save()
  context.beginPath()
  if (kind === 'home') context.rect(point.x - size / 2, point.y - size / 2, size, size)
  else context.ellipse(point.x, point.y, size / 2, size / 2, 0, 0, Math.PI * 2)
  context.fillStyle = color
  context.fill()
  context.strokeStyle = selected ? '#ffffff' : '#171a20'
  context.lineWidth = 1.5 * scale
  context.stroke()
  let icon = icons.get(kind)
  if (!icon) {
    icon = new Image()
    icon.onload = redraw
    icon.src = minimapMarkerIcon(kind)
    icons.set(kind, icon)
  }
  if (icon.complete && icon.naturalWidth) context.drawImage(icon, point.x - size / 2, point.y - size / 2, size, size)
  context.restore()
}
