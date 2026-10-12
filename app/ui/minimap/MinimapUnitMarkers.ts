import { MINIMAP_RESOLUTION_SCALE as SCALE } from './MinimapGeometry'
import type { MinimapUnitCluster } from './MinimapUnitClusters'

type MarkerKind = 'villager' | 'troop' | 'building' | 'hero'

export function drawMinimapUnitCluster(
  context: CanvasRenderingContext2D,
  cluster: MinimapUnitCluster,
  color: string,
  markerScale: number
): void {
  if (cluster.count === 1) {
    drawMinimapUnitMarker(context, 'villager', cluster, color, cluster.selected, 0, markerScale)
    return
  }
  const label = String(cluster.count)
  const radius = Math.max(7, 3 + label.length * 2.5) * SCALE
  context.save()
  context.translate(cluster.x, cluster.y)
  if (cluster.selected) {
    context.beginPath()
    context.ellipse(0, 0, radius + 2 * SCALE, radius + 2 * SCALE, 0, 0, Math.PI * 2)
    context.strokeStyle = '#ffffff'
    context.lineWidth = SCALE
    context.stroke()
  }
  context.beginPath()
  context.ellipse(0, 0, radius, radius, 0, 0, Math.PI * 2)
  context.fillStyle = '#171a20'
  context.fill()
  context.strokeStyle = color
  context.lineWidth = 1.5 * SCALE
  context.stroke()
  context.font = `600 ${9 * SCALE}px sans-serif`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = '#ffffff'
  context.fillText(label, 0, 0)
  context.restore()
}

/** Scale shapes, selection rings and outlines together with the minimap zoom. */
export function drawMinimapUnitMarker(
  context: CanvasRenderingContext2D,
  kind: MarkerKind,
  point: { x: number; y: number },
  color: string,
  selected = false,
  degree = 0,
  markerScale = 1
): void {
  const scale = SCALE * markerScale
  const radius = (kind === 'hero' ? 7 : kind === 'villager' ? 1.8 : 3) * scale
  context.save()
  context.translate(point.x, point.y)
  if (selected) {
    context.beginPath()
    context.ellipse(0, 0, radius + 2 * scale, radius + 2 * scale, 0, 0, Math.PI * 2)
    context.strokeStyle = '#ffffff'
    context.lineWidth = scale
    context.stroke()
  }
  context.beginPath()
  if (kind === 'hero') {
    // Unit degrees use 180 for right, 270 for down, 0 for left and 90 for up.
    context.rotate(((degree - 180) * Math.PI) / 180)
    context.moveTo(radius, 0)
    context.lineTo(-radius * 0.8, -radius * 0.65)
    context.lineTo(-radius * 0.35, 0)
    context.lineTo(-radius * 0.8, radius * 0.65)
    context.closePath()
  } else if (kind === 'troop') {
    context.moveTo(0, -radius)
    context.lineTo(radius, radius)
    context.lineTo(-radius, radius)
    context.closePath()
  } else if (kind === 'building') {
    context.rect(-radius, -radius, radius * 2, radius * 2)
  } else {
    context.ellipse(0, 0, radius, radius, 0, 0, Math.PI * 2)
  }
  context.fillStyle = color
  context.fill()
  context.strokeStyle = kind === 'hero' || selected ? '#ffffff' : '#171a20'
  context.lineWidth = (kind === 'hero' ? 1.5 : 0.8) * scale
  context.stroke()
  context.restore()
}
