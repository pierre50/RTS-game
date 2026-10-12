export type MinimapUnitPoint = { x: number; y: number; selected?: boolean }
export type MinimapUnitCluster = MinimapUnitPoint & { count: number }

/** Screen-space groups anchored to their first member, so a chain cannot merge distant crowds. */
export function clusterMinimapUnits(points: MinimapUnitPoint[], distance: number): MinimapUnitCluster[] {
  const clusters: MinimapUnitCluster[] = []
  const buckets = new Map<string, { anchor: MinimapUnitPoint; cluster: MinimapUnitCluster }[]>()
  for (const point of points) {
    const column = Math.floor(point.x / distance)
    const row = Math.floor(point.y / distance)
    let nearest: MinimapUnitCluster | undefined
    let nearestDistance = distance * distance
    for (let x = column - 1; x <= column + 1; x++) {
      for (let y = row - 1; y <= row + 1; y++) {
        for (const { anchor, cluster } of buckets.get(`${x}:${y}`) ?? []) {
          const squared = (point.x - anchor.x) ** 2 + (point.y - anchor.y) ** 2
          if (squared <= nearestDistance) {
            nearest = cluster
            nearestDistance = squared
          }
        }
      }
    }
    if (nearest) {
      nearest.count++
      nearest.x += (point.x - nearest.x) / nearest.count
      nearest.y += (point.y - nearest.y) / nearest.count
      nearest.selected ||= point.selected
    } else {
      const cluster = { ...point, count: 1 }
      clusters.push(cluster)
      const key = `${column}:${row}`
      const bucket = buckets.get(key) ?? []
      bucket.push({ anchor: point, cluster })
      buckets.set(key, bucket)
    }
  }
  return clusters
}
