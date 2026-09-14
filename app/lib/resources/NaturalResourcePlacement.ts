import { SPACED_RESOURCE_TYPES, WATER_BORDER_PLACEMENT_CLEARANCE } from '../../constants'
import type { SaveEntityState, SaveGridPoint } from '../../types/save'
type TerrainCell = { type?: string; category?: string; waterBorder?: boolean }
type PlacementAccess = {
  naturalCell(point: SaveGridPoint): boolean
  reachable(from: SaveGridPoint, to: SaveGridPoint): boolean
}

const spacedTypes = new Set<string>(SPACED_RESOURCE_TYPES)
const key = (point: SaveGridPoint) => `${point.i}:${point.j}`
const family = (resource: SaveEntityState) => `${resource.type}:${resource.textureName ?? ''}`

function noise(seed: string): number {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index++) hash = Math.imul(hash ^ seed.charCodeAt(index), 16777619)
  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x45d9f3b)
  hash ^= hash >>> 16
  return ((hash >>> 0) + 1) / 4294967297
}

/** Reuse the generator's resource families, coastal clearance and deposit spacing.
 * Ranked, seeded candidates extend existing patches instead of filling square rings.
 */
export class NaturalResourcePlacement {
  private readonly resources = new Map<string, SaveEntityState>()
  private readonly density = new Map<string, Map<string, number>>()
  private readonly pools = new Map<string, SaveGridPoint[]>()

  constructor(
    resources: SaveEntityState[],
    private readonly terrain: (TerrainCell | null | undefined)[][],
    private readonly spatial: PlacementAccess
  ) {
    for (const resource of resources) {
      this.resources.set(key(resource), resource)
      let density = this.density.get(family(resource))
      if (!density) this.density.set(family(resource), density = new Map())
      const radius = resource.type === 'Tree' ? 7 : 5
      for (let di = -radius; di <= radius; di++) {
        for (let dj = -radius; dj <= radius; dj++) {
          const distance = Math.hypot(di, dj)
          if (distance >= radius) continue
          const cellKey = key({ i: resource.i + di, j: resource.j + dj })
          density.set(cellKey, (density.get(cellKey) ?? 0) + (1 - distance / radius))
        }
      }
    }
  }

  private suitable(point: SaveGridPoint, resource: SaveEntityState): boolean {
    if (!this.spatial.naturalCell(point)) return false
    const cell = this.terrain[point.i]?.[point.j]
    if (resource.type === 'Tree' && (cell?.type === 'Dirt' || cell?.type === 'Snow')) return false
    const clearance = WATER_BORDER_PLACEMENT_CLEARANCE
    for (let i = point.i - clearance; i <= point.i + clearance; i++) {
      for (let j = point.j - clearance; j <= point.j + clearance; j++) {
        const nearby = this.terrain[i]?.[j]
        if (nearby?.waterBorder || nearby?.category === 'Water') return false
      }
    }
    return true
  }

  private candidates(center: SaveGridPoint, resource: SaveEntityState): SaveGridPoint[] {
    const sourceType = this.terrain[resource.i]?.[resource.j]?.type
    const poolKey = `${key(center)}:${family(resource)}:${sourceType ?? ''}`
    const cached = this.pools.get(poolKey)
    if (cached) return cached
    const density = this.density.get(family(resource))
    const scored: Array<SaveGridPoint & { score: number }> = []
    this.terrain.forEach((row, i) => row.forEach((cell, j) => {
      const point = { i, j }
      if (!this.suitable(point, resource) || !this.spatial.reachable(center, point)) return
      // Small overlapping circular patches provide an organic fallback where the
      // original forest or deposit has been cleared completely.
      let patch = 0
      const tileI = Math.floor(i / 12)
      const tileJ = Math.floor(j / 12)
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        const seed = `${poolKey}:${tileI + di}:${tileJ + dj}`
        const ci = (tileI + di) * 12 + noise(`${seed}:i`) * 12
        const cj = (tileJ + dj) * 12 + noise(`${seed}:j`) * 12
        patch += Math.max(0, 1 - Math.hypot(i - ci, j - cj) / 7)
      }
      const matchingTerrain = !sourceType || cell?.type === sourceType ? 1 : 0.15
      const affinity = 0.02 + (density?.get(key(point)) ?? 0) * 3 + patch * patch
      const distance = Math.hypot(i - center.i, j - center.j)
      const weight = affinity * matchingTerrain / (1 + distance / 45)
      scored.push({ ...point, score: -Math.log(noise(`${poolKey}:${i}:${j}:pick`)) / weight })
    }))
    scored.sort((a, b) => a.score - b.score)
    const points = scored.map(({ i, j }) => ({ i, j }))
    this.pools.set(poolKey, points)
    return points
  }

  canPlace(resource: SaveEntityState, point: SaveGridPoint, spacing = 3): boolean {
    if (!this.suitable(point, resource)) return false
    for (let di = -spacing; di <= spacing; di++) for (let dj = -spacing; dj <= spacing; dj++) {
      const nearby = this.resources.get(key({ i: point.i + di, j: point.j + dj }))
      if (nearby && nearby !== resource && spacedTypes.has(nearby.type)) return false
    }
    return true
  }

  find(
    resource: SaveEntityState,
    center: SaveGridPoint,
    excluded: (point: SaveGridPoint) => boolean,
    options: { spacing?: number[]; clearances?: number[] } = {}
  ): SaveGridPoint | null {
    const candidates = this.candidates(center, resource)
    // Preserve generator spacing first. Only crowded maps reduce decorative
    // spacing; water, slopes, occupied cells and access reservations stay forbidden.
    for (const spacing of options.spacing ?? [3, 1, 0]) {
      for (const villageClearance of options.clearances ?? [28, 12, 0]) {
        const destination = candidates.find(point => {
          if (Math.hypot(point.i - center.i, point.j - center.j) < villageClearance || excluded(point)) return false
          return this.canPlace(resource, point, spacing)
        })
        if (!destination) continue
        return destination
      }
    }
    return null
  }

  record(resource: SaveEntityState, previous?: SaveGridPoint): void {
    if (previous) this.resources.delete(key(previous))
    this.resources.set(key(resource), resource)
  }
}
