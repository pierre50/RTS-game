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

  /** Complete a gate across the local road direction before defending another approach. */
  private gateScore(
    entries: SaveGridPoint[],
    roads: SaveGridPoint[],
    point: SaveGridPoint,
    towers: SaveEntityState[],
    range: number
  ): number {
    let best = 0
    for (const entry of entries) {
      if (distance(point, entry) > range) continue
      const nearby = roads.filter(road => distance(road, entry) <= 3)
      let ii = 0,
        jj = 0,
        ij = 0
      for (const road of nearby) {
        const di = road.i - entry.i,
          dj = road.j - entry.j
        ii += di * di
        jj += dj * dj
        ij += di * dj
      }
      if (ii + jj === 0 || (ii === jj && ij === 0)) continue
      const angle = Math.atan2(2 * ij, ii - jj) / 2
      const di = Math.cos(angle),
        dj = Math.sin(angle)
      const along = (p: SaveGridPoint) => (p.i - entry.i) * di + (p.j - entry.j) * dj
      const side = (p: SaveGridPoint) => (p.i - entry.i) * -dj + (p.j - entry.j) * di
      const alignment = (a: SaveGridPoint, b: SaveGridPoint): number | null => {
        if (side(a) * side(b) >= 0 || Math.min(Math.abs(side(a)), Math.abs(side(b))) < 2) return null
        const offset = Math.abs(along(a) - along(b))
        const symmetry = Math.abs(side(a) + side(b))
        return offset <= 2 && symmetry <= 2 ? offset + symmetry : null
      }
      const defenders = towers.filter(tower => distance(tower, entry) <= range)
      for (const tower of defenders) {
        if (defenders.some(other => other !== tower && alignment(tower, other) !== null)) continue
        const error = alignment(tower, point)
        if (error !== null) best = Math.min(best, -3000 + error * 150 + distance(tower, point) * 100)
      }
    }
    return best
  }

  score(
    center: SaveGridPoint,
    point: SaveGridPoint,
    type: string,
    placed: SaveEntityState[],
    towerRange: number,
    perimeter = false
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
    const gate = this.gateScore(entries, roads, point, towers, towerRange)
    // Pair towers across an approach when a valid lot exists; otherwise retain coverage priorities.
    return (
      gate -
      newlyCovered.length * 1000 -
      (perimeter ? 0 : covered.length * 200) +
      (gate < 0 ? 0 : separation * 60) +
      (newlyCovered.length ? nearestRoad * 100 : perimeter ? 0 : nearestRoad * 4)
    )
  }
}
