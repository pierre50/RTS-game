export type PolygonPoint = { x: number; y: number }

export function pointIsInsidePolygon(points: readonly PolygonPoint[], point: PolygonPoint): boolean {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]
    const b = points[j]
    const cross = (point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x)
    const dot = (point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)
    const lenSq = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
    if (Math.abs(cross) < 0.001 && dot >= 0 && dot <= lenSq) return true
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside
    }
  }
  return inside
}

function distanceToSegment(point: PolygonPoint, a: PolygonPoint, b: PolygonPoint): number {
  const segmentX = b.x - a.x
  const segmentY = b.y - a.y
  const segmentLengthSq = segmentX * segmentX + segmentY * segmentY
  if (segmentLengthSq <= 0) return Math.hypot(point.x - a.x, point.y - a.y)
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * segmentX + (point.y - a.y) * segmentY) / segmentLengthSq))
  return Math.hypot(point.x - (a.x + segmentX * t), point.y - (a.y + segmentY * t))
}

export function distanceToPolygon(points: readonly PolygonPoint[], point: PolygonPoint): number {
  if (!points.length) return Infinity
  if (pointIsInsidePolygon(points, point)) return 0
  let closest = Infinity
  for (let index = 0; index < points.length; index++) {
    closest = Math.min(closest, distanceToSegment(point, points[index], points[(index + 1) % points.length]))
  }
  return closest
}

export function closestPointOnSegment(point: PolygonPoint, a: PolygonPoint, b: PolygonPoint): PolygonPoint {
  const segmentX = b.x - a.x
  const segmentY = b.y - a.y
  const segmentLengthSq = segmentX * segmentX + segmentY * segmentY
  if (segmentLengthSq <= 0) return a
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * segmentX + (point.y - a.y) * segmentY) / segmentLengthSq))
  return {
    x: a.x + segmentX * t,
    y: a.y + segmentY * t,
  }
}
