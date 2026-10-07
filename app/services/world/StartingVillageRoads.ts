import type { RoadLayer } from '../../lib/terrain/roadLayer'
import type { SaveEntityState, SaveGridPoint } from '../../types/save'

const ROAD_ATTRACTION: Record<string, number> = {
  Market: 4,
  Forge: 1,
  House: 1,
  Barracks: 3,
  ArcheryRange: 3,
  Stable: 3,
}

const distance = (a: SaveGridPoint, b: SaveGridPoint) => Math.hypot(a.i - b.i, a.j - b.j)

/** Local scoring only: roads are planned once, before any secondary building. */
export class StartingVillageRoads {
  private readonly cells: Set<number>
  private readonly local = new Map<SaveGridPoint, SaveGridPoint[]>()
  private readonly approaches = new Map<SaveGridPoint, SaveGridPoint[]>()

  constructor(private readonly roads: RoadLayer) {
    this.cells = new Set(roads.cells.map(([id]) => id))
  }

  private nearby(center: SaveGridPoint): SaveGridPoint[] {
    let cells = this.local.get(center)
    if (!cells) {
      cells = []
      for (let i = Math.max(0, center.i - 28); i <= Math.min(this.roads.stride - 1, center.i + 28); i++)
        for (let j = Math.max(0, center.j - 28); j <= Math.min(this.roads.stride - 1, center.j + 28); j++)
          if (this.cells.has(i * this.roads.stride + j)) cells.push({ i, j })
      this.local.set(center, cells)
    }
    return cells
  }

  entrances(center: SaveGridPoint): SaveGridPoint[] {
    let entries = this.approaches.get(center)
    if (!entries) {
      // Cluster road crossings of the outskirts, including roads merely passing through.
      const crossings = this.nearby(center)
        .filter(point => distance(point, center) >= 14 && distance(point, center) <= 17)
        .sort(
          (a, b) => Math.abs(distance(a, center) - 15) - Math.abs(distance(b, center) - 15) || a.i - b.i || a.j - b.j
        )
      entries = []
      for (const point of crossings) if (entries.every(entry => distance(entry, point) >= 8)) entries.push(point)
      this.approaches.set(center, entries)
    }
    return entries
  }

  militarySite(center: SaveGridPoint, fallback: SaveGridPoint): SaveGridPoint {
    const entry = this.entrances(center)[0]
    if (!entry) return fallback
    return {
      i: Math.round(center.i + (entry.i - center.i) * 0.65),
      j: Math.round(center.j + (entry.j - center.j) * 0.65),
    }
  }

  score(
    center: SaveGridPoint,
    point: SaveGridPoint,
    type: string,
    placed: SaveEntityState[],
    towerRange: number
  ): number {
    if (type !== 'WatchTower' && !ROAD_ATTRACTION[type]) return 0
    const roads = this.nearby(center)
    if (!roads.length) return 0
    const nearestRoad = Math.min(...roads.map(road => distance(point, road)))
    if (type !== 'WatchTower') return nearestRoad * (ROAD_ATTRACTION[type] ?? 0)
    const entries = this.entrances(center)
    if (!entries.length) return 0
    const towers = placed.filter(building => building.type === 'WatchTower')
    const covered = entries.filter(entry => distance(point, entry) <= towerRange)
    const newlyCovered = covered.filter(entry => !towers.some(tower => distance(tower, entry) <= towerRange))
    const separation = towers.reduce((sum, tower) => sum + Math.max(0, 8 - distance(point, tower)), 0)
    // Cover distinct entrances first, then reinforce an existing one from a separate position.
    return -newlyCovered.length * 1000 - covered.length * 200 + separation * 60 + nearestRoad * 4
  }
}
