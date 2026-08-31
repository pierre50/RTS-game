import { findInstancePath } from '../../services/Pathfinding'
import { randomItem, instancesDistance, pointsDistance, getInstanceDegree } from '../maths'
import { getCellsAroundPoint, getBuildingContactDistance } from './cells'
import { getEntitySpaceMapLike, sameCellMapSpace, sameMapSpace } from '../mapSpaces'
import type { Grid, GridCell, GridInstanceLike, GridPosition, InstanceLike, Point } from '../../types/grid'
import type { RuntimeMap } from '../../types/map'

export type GameMap<TCell extends GridCell = GridCell> = {
  grid: Grid<TCell>
}

type PathInstanceLike = GridPosition & Partial<Point> & { category?: string; label?: string }
type PathCellOccupant = { has?: (InstanceLike & { label?: string }) | null }
type PathSpaceEntity = PathInstanceLike & {
  context?: { map?: RuntimeMap | null }
  family?: string
  spaceId?: string | null
}
type PathSpaceCell = GridCell & { spaceId?: string | null }
type FreeCellCondition<TCell extends GridCell> = (cell: TCell) => boolean
type ClosestFreeCellPathOptions<TCell extends GridCell> = {
  isCellAllowed?: FreeCellCondition<TCell>
}

export function instanceContactInstance(a: InstanceLike, b: InstanceLike): boolean {
  return Math.floor(instancesDistance(a, b)) <= getBuildingContactDistance(b.size ?? 1) && !b.isDestroyed
}

type MovableInstance = Point & { degree?: number }

export function moveTowardPoint(instance: MovableInstance, x: number, y: number, speed: number): void {
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

function getFreeCellAroundPoint<TCell extends GridCell>(
  x: number,
  y: number,
  size: number,
  grid: Grid<TCell>,
  condition: FreeCellCondition<TCell>,
  pickRandomItem: (items: TCell[]) => TCell | undefined = randomItem
): TCell | null {
  const maxDistance = 50

  for (let distance = size; distance < maxDistance; distance++) {
    const cells = getCellsAroundPoint(x, y, grid, distance, condition)
    if (cells.length > 0) return pickRandomItem(cells) ?? null
  }

  return null
}

function getContactCandidateCells<TCell extends GridCell>(
  target: GridInstanceLike | TCell,
  grid: Grid<TCell>,
  distance: number
): TCell[] {
  const cells: TCell[] = []
  const radius = Math.ceil(distance + 1)

  for (let i = Math.max(target.i - radius, 0); i <= Math.min(target.i + radius, grid.length - 1); i++) {
    const row = grid[i]
    if (!row) continue
    for (let j = Math.max(target.j - radius, 0); j <= Math.min(target.j + radius, row.length - 1); j++) {
      const cell = row[j]
      if (!cell) continue
      if (Math.floor(instancesDistance(cell, target)) <= distance) cells.push(cell)
    }
  }

  return cells
}

export function getFreeLandCellAroundInstance<TCell extends GridCell>(
  instance: GridPosition & { size?: number },
  grid: Grid<TCell>,
  pickRandomItem: (items: TCell[]) => TCell | undefined = randomItem,
  extraCondition?: FreeCellCondition<TCell>
): TCell | null {
  return getFreeCellAroundPoint(
    instance.i,
    instance.j,
    instance.size || 1,
    grid,
    cell =>
      !cell.solid &&
      cell.category !== 'Water' &&
      !cell.waterBorder &&
      !cell.border &&
      (!extraCondition || extraCondition(cell)),
    pickRandomItem
  )
}

export function getInstanceClosestFreeCellPath<TCell extends GridCell>(
  instance: PathInstanceLike,
  target: GridInstanceLike | TCell,
  map: GameMap<TCell>,
  options: ClosestFreeCellPathOptions<TCell> = {}
): TCell[] {
  if (!targetIsInInstanceSpace(instance, target)) return []
  const pathMap = getPathMap(instance, map)
  const occupiedInstance = (target as { has?: InstanceLike | null }).has ?? undefined
  const targetSize = 'size' in target && typeof target.size === 'number' ? target.size : 0
  const size = targetSize || occupiedInstance?.size || 1
  const distance = getBuildingContactDistance(size)

  const candidates = getContactCandidateCells(target, pathMap.grid, distance)
  candidates.sort(
    (a, b) =>
      Math.abs(a.i - instance.i) +
      Math.abs(a.j - instance.j) -
      (Math.abs(b.i - instance.i) + Math.abs(b.j - instance.j))
  )

  let best: TCell[] = []
  for (const cell of candidates) {
    const occupantLabel = (cell as TCell & PathCellOccupant).has?.label
    if (cell.solid && (!instance.label || occupantLabel !== instance.label)) continue
    if (cell.category === 'Water' || (cell.border && (!cell.waterBorder || cell.solid))) continue
    if (options.isCellAllowed && !options.isCellAllowed(cell)) continue
    if (best.length && Math.abs(cell.i - instance.i) + Math.abs(cell.j - instance.j) >= best.length) break
    const path = getInstancePath(instance, cell.i, cell.j, pathMap)
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
  return findInstancePath(instance, x, y, getPathMap(instance, map))
}

function getPathMap<TCell extends GridCell>(instance: PathInstanceLike, map: GameMap<TCell>): GameMap<TCell> {
  const spaceMap = getEntitySpaceMapLike(
    instance as PathSpaceEntity,
    map as unknown as Parameters<typeof getEntitySpaceMapLike>[1]
  )
  return (spaceMap as GameMap<TCell> | null) ?? map
}

function targetIsInInstanceSpace(instance: PathInstanceLike, target: GridInstanceLike | GridCell): boolean {
  const source = instance as PathSpaceEntity
  const candidate = target as PathSpaceEntity | PathSpaceCell
  if ('has' in candidate || !('family' in candidate)) return sameCellMapSpace(source, candidate as PathSpaceCell)
  return sameMapSpace(source, candidate as PathSpaceEntity)
}
