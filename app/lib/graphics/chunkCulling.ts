import type { Bounds, Viewport } from '../../types/geometry'

export function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return a.minX + a.width >= b.minX && a.minX <= b.minX + b.width && a.minY + a.height >= b.minY && a.minY <= b.minY + b.height
}

export function rectangleIntersectsViewport(bounds: Bounds, viewport: Viewport, margin = 0): boolean {
  const left = viewport.visibleLeft - margin
  const top = viewport.visibleTop - margin
  const right = viewport.visibleLeft + viewport.visibleWidth + margin
  const bottom = viewport.visibleTop + viewport.visibleHeight + margin

  return (
    bounds.minX + bounds.width >= left &&
    bounds.minX <= right &&
    bounds.minY + bounds.height >= top &&
    bounds.minY <= bottom
  )
}
