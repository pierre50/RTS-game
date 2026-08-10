import { pointsDistance } from '../maths'
import { getCellsAroundPoint } from './cells'
import { getInstancePath, type GameMap } from './movement'
import type { GridCell, GridPosition } from '../../types/grid'

type FleeCandidate<TCell extends GridCell> = {
  cell: TCell
  score: number
}

type FleeInstance = GridPosition

type FleeThreat = GridPosition

type ReachableFleeCellOptions<TCell extends GridCell> = {
  isCellAllowed?: (cell: TCell) => boolean
  pathLengthWeight?: number
  directionWeight?: number
  distanceWeight?: number
  preferredCell?: TCell | null
  range: number
}

const DEFAULT_DIRECTION_WEIGHT = 6
const DEFAULT_DISTANCE_WEIGHT = 2
const DEFAULT_PATH_LENGTH_WEIGHT = 0.12

function defaultCellAllowed<TCell extends GridCell>(cell: TCell): boolean {
  return !cell.solid && cell.category !== 'Water'
}

export function findReachableFleeCell<TCell extends GridCell>(
  instance: FleeInstance,
  threat: FleeThreat,
  map: GameMap<TCell>,
  {
    directionWeight = DEFAULT_DIRECTION_WEIGHT,
    distanceWeight = DEFAULT_DISTANCE_WEIGHT,
    isCellAllowed = defaultCellAllowed,
    pathLengthWeight = DEFAULT_PATH_LENGTH_WEIGHT,
    preferredCell = null,
    range,
  }: ReachableFleeCellOptions<TCell>
): TCell | null {
  if (preferredCell && isCellAllowed(preferredCell) && getInstancePath(instance, preferredCell.i, preferredCell.j, map).length) {
    return preferredCell
  }

  const awayI = instance.i - threat.i
  const awayJ = instance.j - threat.j
  const awayLength = Math.hypot(awayI, awayJ) || 1
  const candidates: FleeCandidate<TCell>[] = []

  getCellsAroundPoint(instance.i, instance.j, map.grid, range, (cell: TCell) => {
    if ((cell.i === instance.i && cell.j === instance.j) || !isCellAllowed(cell)) return false

    const moveI = cell.i - instance.i
    const moveJ = cell.j - instance.j
    const moveLength = Math.hypot(moveI, moveJ) || 1
    const directionScore = (moveI * awayI + moveJ * awayJ) / (moveLength * awayLength)
    const distanceScore = pointsDistance(cell.i, cell.j, threat.i, threat.j)

    candidates.push({
      cell,
      score: distanceScore * distanceWeight + directionScore * directionWeight,
    })
    return false
  })

  candidates.sort((a, b) => b.score - a.score)

  let best: { cell: TCell; score: number } | null = null
  for (const candidate of candidates) {
    const path = getInstancePath(instance, candidate.cell.i, candidate.cell.j, map)
    if (!path.length) continue
    const score = candidate.score - path.length * pathLengthWeight
    if (!best || score > best.score) {
      best = { cell: candidate.cell, score }
    }
  }

  return best?.cell ?? null
}
