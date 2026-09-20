import { canPlaceBuildingAt } from '../../lib/grid/placement'
import { getBuildingFootprintCells, getPlainCellsAroundPoint } from '../../lib/grid/cells'
import type { RuntimeCell, RuntimeMap } from '../../types/map'
import type { GridPosition } from '../../types/grid'

const CHEST_DIRECTIONS: GridPosition[] = [
  { i: 0, j: -1 },
  { i: 1, j: 0 },
  { i: -1, j: 0 },
  { i: 0, j: 1 },
  { i: 1, j: 1 },
  { i: -1, j: -1 },
  { i: 1, j: -1 },
  { i: -1, j: 1 },
]
/** Prefer the upper-right side of the fire, with one free cell between the two buildings. */
export function findChestPlacement(
  map: RuntimeMap,
  camp: RuntimeCell,
  campSize: number,
  chestSize: number
): RuntimeCell | null {
  const margin = Math.ceil(campSize / 2) + Math.ceil(chestSize / 2)
  for (const direction of CHEST_DIRECTIONS) {
    const targetI = camp.i + direction.i * margin
    const targetJ = camp.j + direction.j * margin
    const target = map.grid[targetI]?.[targetJ]
    if (target && canPlaceBuildingAt(map.grid, targetI, targetJ, { size: chestSize })) return target
    const cells = getPlainCellsAroundPoint(targetI, targetJ, map.grid, 1, cell =>
      canPlaceBuildingAt(map.grid, cell.i, cell.j, { size: chestSize })
    )
    if (cells[0]) return cells[0]
  }
  return null
}

/** Search connected land, not just nearby coordinates across water or blocked terrain. */
function reachable(map: RuntimeMap, start: GridPosition, blocked = new Set<RuntimeCell>(), maxSteps = Infinity): RuntimeCell[] {
  const origin = map.grid[start.i]?.[start.j]
  if (!origin) return []
  const queue = [origin]
  const seen = new Set([origin])
  const distances = new Map([[origin, 0]])
  for (let index = 0; index < queue.length; index++) {
    const cell = queue[index]
    const distance = distances.get(cell) ?? 0
    if (distance >= maxSteps) continue
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
      distances.set(next, distance + 1)
      queue.push(next)
    }
  }
  return queue.slice(1)
}

export function findIntroductionPlacement(
  map: RuntimeMap,
  hero: GridPosition,
  size: number
): { camp: RuntimeCell; companion: RuntimeCell; arrival: RuntimeCell } | null {
  const nearby = reachable(map, hero)
  for (const camp of nearby) {
    if (!canPlaceBuildingAt(map.grid, camp.i, camp.j, { size })) continue
    const footprint = new Set(getBuildingFootprintCells(camp.i, camp.j, map.grid, size))
    // Leave one tile between the hero and the edge of the starting fire.
    if ([...footprint].some(cell =>
      cell.has || Math.max(Math.abs(cell.i - hero.i), Math.abs(cell.j - hero.j)) < 2
    )) continue
    const connected = reachable(map, hero, footprint)
    const available = new Set(connected)
    // Place both ends on the same clear ray, preferably away from the fire.
    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]].sort(
      ([ai, aj], [bi, bj]) => (ai - bi) * (camp.i - hero.i) + (aj - bj) * (camp.j - hero.j)
    )
    for (const [di, dj] of directions) {
      const corridor = [1, 2, 3].map(step => map.grid[hero.i + di * step]?.[hero.j + dj * step])
      if (corridor.every((cell, index) => cell && available.has(cell) &&
        Math.abs((cell.z ?? 0) - (index ? corridor[index - 1]?.z ?? 0 : map.grid[hero.i]?.[hero.j]?.z ?? 0)) <= 1)) {
        return { camp, arrival: corridor[0], companion: corridor[2] }
      }
    }
    const arrivals = connected.filter(
      cell =>
        Math.max(Math.abs(cell.i - hero.i), Math.abs(cell.j - hero.j)) <= 2 &&
        Math.max(Math.abs(cell.i - camp.i), Math.abs(cell.j - camp.j)) <= 3
    )
    const blocked = new Set(footprint)
    const heroCell = map.grid[hero.i]?.[hero.j]
    if (heroCell) blocked.add(heroCell)
    for (const arrival of arrivals) {
      // On cramped terrain, allow a short approach but never a long detour around the fire.
      const companion = reachable(map, arrival, blocked, 3).find(cell => {
        const distance = Math.max(Math.abs(cell.i - hero.i), Math.abs(cell.j - hero.j))
        return distance >= 3 && distance <= 4
      })
      if (companion) return { camp, companion, arrival }
    }
    if (arrivals[0]) return { camp, companion: arrivals[0], arrival: arrivals[0] }
  }
  return null
}
