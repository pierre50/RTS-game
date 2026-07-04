import { findInstancePath } from '../../services/Pathfinding'
import { randomItem, instancesDistance, pointsDistance, getInstanceDegree } from '../maths'
import { getCellsAroundPoint } from './cells'
import type { Grid, GridCell, GridPosition, InstanceLike, Point } from '../../types/grid'

export type GameMap<TCell extends GridCell = GridCell> = {
  grid: Grid<TCell>
  [key: string]: unknown
}

type PathInstanceLike = GridPosition & Partial<Point> & { category?: string }

export function instanceContactInstance(a: InstanceLike, b: InstanceLike): boolean {
  return Math.floor(instancesDistance(a, b)) <= ((b.size ?? 1) - 1 || 1) && !b.isDestroyed
}

export function moveTowardPoint(instance: InstanceLike, x: number, y: number, speed: number): void {
  const dist = pointsDistance(x, y, instance.x, instance.y)
  if (dist === 0) return

  const tX = x - instance.x
  const tY = y - instance.y
  const velX = (tX / dist) * speed
  const velY = (tY / dist) * speed

  instance.degree = getInstanceDegree(instance, x, y)
  instance.x += velX
  instance.y += velY
}

export function getFreeCellAroundPoint<TCell extends GridCell>(
  x: number,
  y: number,
  size: number,
  grid: Grid<TCell>,
  condition: (cell: TCell) => boolean,
  pickRandomItem: (items: TCell[]) => TCell | undefined = randomItem
): TCell | null {
  const maxDistance = 50

  for (let distance = size; distance < maxDistance; distance++) {
    const cells = getCellsAroundPoint(x, y, grid, distance, condition)
    if (cells.length > 0) return pickRandomItem(cells) ?? null
  }

  return null
}

export function getInstanceClosestFreeCellPath<TCell extends GridCell>(
  instance: PathInstanceLike,
  target: InstanceLike | TCell,
  map: GameMap<TCell>
): TCell[] {
  const occupiedInstance = target.has as InstanceLike | undefined
  const size = target.size || occupiedInstance?.size || 1
  const distance = size === 3 ? 2 : 1

  const candidates = getCellsAroundPoint(target.i, target.j, map.grid, distance)
  candidates.sort(
    (a, b) =>
      Math.abs(a.i - instance.i) +
      Math.abs(a.j - instance.j) -
      (Math.abs(b.i - instance.i) + Math.abs(b.j - instance.j))
  )

  let best: TCell[] = []
  for (const cell of candidates) {
    if (best.length && Math.abs(cell.i - instance.i) + Math.abs(cell.j - instance.j) >= best.length) break
    const path = getInstancePath(instance, cell.i, cell.j, map)
    if (path.length && (!best.length || path.length < best.length)) best = path
  }
  return best
}

export function getInstancePath<TCell extends GridCell>(
  instance: PathInstanceLike,
  x: number,
  y: number,
  map: GameMap<TCell>
): TCell[] {
  return findInstancePath(instance, x, y, map)
}
