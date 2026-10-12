import { findInstancePath } from '../../Pathfinding'
import { isGroundResourceType } from '../../../lib/resources/groundResourceRegrowth'
import type { SaveEntityState, SaveGridPoint } from '../../../types/save'

const ZONE = 16
const key = (point: SaveGridPoint) => `${Math.floor(point.i / ZONE)}:${Math.floor(point.j / ZONE)}`

/** Mutable occupied zones shared by all workers in one offline simulation. */
export class OfflineResourceIndex {
  private zones = new Map<string, Set<SaveEntityState>>()
  add(entity: SaveEntityState): void {
    const zone = key(entity)
    if (!this.zones.has(zone)) this.zones.set(zone, new Set())
    this.zones.get(zone)!.add(entity)
  }
  delete(entity: SaveEntityState): void {
    const zone = key(entity),
      entries = this.zones.get(zone)
    entries?.delete(entity)
    if (!entries?.size) this.zones.delete(zone)
  }
  nearest(
    point: SaveGridPoint,
    area: SaveGridPoint & { radius: number },
    accepts: (entity: SaveEntityState) => boolean,
    limit: number
  ): SaveEntityState[] {
    const best: { entity: SaveEntityState; distance: number }[] = []
    for (let zi = Math.floor((area.i - area.radius) / ZONE); zi <= Math.floor((area.i + area.radius) / ZONE); zi++)
      for (let zj = Math.floor((area.j - area.radius) / ZONE); zj <= Math.floor((area.j + area.radius) / ZONE); zj++)
        for (const entity of this.zones.get(`${zi}:${zj}`) ?? []) {
          if ((entity.i - area.i) ** 2 + (entity.j - area.j) ** 2 > area.radius ** 2 || !accepts(entity)) continue
          const distance = (entity.i - point.i) ** 2 + (entity.j - point.j) ** 2
          let index = best.findIndex(
            other =>
              distance < other.distance ||
              (distance === other.distance &&
                (entity.i < other.entity.i || (entity.i === other.entity.i && entity.j < other.entity.j)))
          )
          if (index < 0) index = best.length
          if (index >= limit) continue
          best.splice(index, 0, { entity, distance })
          if (best.length > limit) best.pop()
        }
    return best.map(entry => entry.entity)
  }
}

/** Build the local walkable grid once, then test nearby candidates with the game's pathfinder. */
export function offlineResourceApproach(
  unit: SaveEntityState,
  targets: SaveEntityState[],
  area: SaveGridPoint & { radius: number },
  walkable: (point: SaveGridPoint) => boolean
): { target: SaveEntityState; point: SaveGridPoint; steps: number } | undefined {
  type Cell = SaveGridPoint & { solid: boolean }
  const grid: Cell[][] = []
  const minI = Math.max(0, Math.floor(Math.min(unit.i, area.i - area.radius) - 4))
  const minJ = Math.max(0, Math.floor(Math.min(unit.j, area.j - area.radius) - 4))
  const maxI = Math.ceil(Math.max(unit.i, area.i + area.radius) + 4)
  const maxJ = Math.ceil(Math.max(unit.j, area.j + area.radius) + 4)
  for (let i = minI; i <= maxI; i++) {
    grid[i] = []
    for (let j = minJ; j <= maxJ; j++) grid[i][j] = { i, j, solid: !walkable({ i, j }) }
  }
  for (const target of targets) {
    const goals: Cell[] = []
    const radius = isGroundResourceType(target.type) ? 0 : 1
    for (let i = target.i - radius; i <= target.i + radius; i++)
      for (let j = target.j - radius; j <= target.j + radius; j++) {
        const cell = grid[i]?.[j]
        if (cell && !cell.solid) goals.push(cell)
      }
    if (!goals.length) continue
    if (goals.some(cell => cell.i === unit.i && cell.j === unit.j)) return { target, point: unit, steps: 0 }
    const path = findInstancePath(
      unit,
      goals[0].i,
      goals[0].j,
      { grid, size: Math.max(maxI, maxJ) },
      { alternativeGoals: goals, searchMargin: area.radius + 4 }
    )
    if (path.length) return { target, point: path[0], steps: path.length }
  }
  return undefined
}
