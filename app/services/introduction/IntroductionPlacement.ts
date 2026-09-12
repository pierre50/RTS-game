import { canPlaceBuildingAt } from '../../lib/grid/placement'
import { getBuildingFootprintCells } from '../../lib/grid/cells'
import type { RuntimeCell, RuntimeMap } from '../../types/map'
import type { GridPosition } from '../../types/grid'

/** Search connected land, not just nearby coordinates across water or blocked terrain. */
function reachable(map: RuntimeMap, start: GridPosition, blocked = new Set<RuntimeCell>()): RuntimeCell[] {
  const origin = map.grid[start.i]?.[start.j]
  if (!origin) return []
  const queue = [origin]
  const seen = new Set([origin])
  for (let index = 0; index < queue.length; index++) {
    const cell = queue[index]
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const next = map.grid[cell.i + di]?.[cell.j + dj]
      if (
        !next ||
        seen.has(next) ||
        blocked.has(next) ||
        next.solid ||
        next.has ||
        next.border ||
        next.waterBorder ||
        next.category === 'Water' ||
        Math.abs((cell.z ?? 0) - (next.z ?? 0)) > 1 ||
        Math.max(Math.abs(next.i - start.i), Math.abs(next.j - start.j)) > 6
      )
        continue
      seen.add(next)
      queue.push(next)
    }
  }
  return queue.slice(1)
}

export function findIntroductionPlacement(
  map: RuntimeMap,
  hero: GridPosition,
  size: number
): { camp: RuntimeCell; companion: RuntimeCell } | null {
  const nearby = reachable(map, hero)
  for (const camp of nearby) {
    if (!canPlaceBuildingAt(map.grid, camp.i, camp.j, { size })) continue
    const footprint = new Set(getBuildingFootprintCells(camp.i, camp.j, map.grid, size))
    if ([...footprint].some(cell => cell.has || (cell.i === hero.i && cell.j === hero.j))) continue
    const companion = reachable(map, hero, footprint).find(
      cell =>
        Math.max(Math.abs(cell.i - hero.i), Math.abs(cell.j - hero.j)) <= 2 &&
        Math.max(Math.abs(cell.i - camp.i), Math.abs(cell.j - camp.j)) <= 3
    )
    if (companion) return { camp, companion }
  }
  return null
}
