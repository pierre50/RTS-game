export function rectangleIntersectsViewport(bounds, viewport, margin = 0) {
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
