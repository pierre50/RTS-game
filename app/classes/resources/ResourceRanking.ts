import type { ResourceEntity } from '../../types/entities'

/** Keep a bounded, deterministic nearest selection without materializing packed resources. */
export function createResourceRanking(
  types: readonly string[],
  point: { i: number; j: number },
  area: { i: number; j: number; radius: number },
  limit: number,
  accepts: (resource: ResourceEntity) => boolean
) {
  const wanted = new Set(types)
  const best: { distance: number; resource: ResourceEntity }[] = []
  const consider = (resource: ResourceEntity) => {
    if (!wanted.has(resource.type) || (resource.i - area.i) ** 2 + (resource.j - area.j) ** 2 > area.radius ** 2) return
    const distance = (resource.i - point.i) ** 2 + (resource.j - point.j) ** 2
    if (best.length >= limit && distance > best[best.length - 1].distance) return
    if (!accepts(resource)) return
    const key = `${resource.spaceId ?? 'outside'}:${resource.i}:${resource.j}:${resource.type}`
    if (
      best.some(
        entry =>
          `${entry.resource.spaceId ?? 'outside'}:${entry.resource.i}:${entry.resource.j}:${entry.resource.type}` ===
          key
      )
    )
      return
    let at = best.findIndex(
      entry =>
        distance < entry.distance ||
        (distance === entry.distance &&
          (resource.i < entry.resource.i || (resource.i === entry.resource.i && resource.j < entry.resource.j)))
    )
    if (at < 0) at = best.length
    best.splice(at, 0, { distance, resource })
    if (best.length > limit) best.pop()
  }
  return { consider, results: () => best.map(entry => entry.resource) }
}
