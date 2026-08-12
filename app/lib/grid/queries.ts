import { instancesDistance } from '../maths'
import { getInstanceClosestFreeCellPath, type GameMap } from './movement'
import type { Grid, GridCell, GridInstanceLike } from '../../types/grid'

type Candidate<TInstance extends GridInstanceLike> = {
  distance: number
  instance: TInstance
}

type InstanceWithPath<TInstance extends GridInstanceLike, TCell extends GridCell = GridCell> = {
  instance: TInstance
  path: TCell[]
}

function insertCandidate<TInstance extends GridInstanceLike>(
  candidates: Array<Candidate<TInstance>>,
  candidate: Candidate<TInstance>,
  maxCandidates: number
): void {
  let index = candidates.findIndex(item => candidate.distance < item.distance)
  if (index === -1) index = candidates.length
  candidates.splice(index, 0, candidate)
  if (candidates.length > maxCandidates) {
    candidates.length = maxCandidates
  }
}

function isGameMap<TCell extends GridCell>(parent: unknown): parent is GameMap<TCell> {
  return Boolean(parent && typeof parent === 'object' && Array.isArray((parent as Partial<GameMap<TCell>>).grid))
}

export function getClosestInstance<TInstance extends GridInstanceLike>(
  instance: GridInstanceLike,
  instances: Iterable<TInstance>
): TInstance | false {
  let closestInstance: TInstance | null = null
  let closestDistance = Infinity

  for (const targetInstance of instances) {
    const distance = instancesDistance(instance, targetInstance)

    if (distance < closestDistance) {
      closestDistance = distance
      closestInstance = targetInstance
    }
  }

  return closestInstance || false
}

export function getClosestInstanceWithPath<TInstance extends GridInstanceLike, TCell extends GridCell = GridCell>(
  instance: GridInstanceLike,
  instances: Iterable<TInstance>,
  maxCandidates = 6
): InstanceWithPath<TInstance, TCell> | null {
  if (!isGameMap<TCell>(instance.parent)) return null
  const map = instance.parent

  const candidates: Array<Candidate<TInstance>> = []
  for (const target of instances) {
    insertCandidate(
      candidates,
      {
        instance: target,
        distance: Math.abs(instance.i - target.i) + Math.abs(instance.j - target.j),
      },
      maxCandidates
    )
  }

  let closest: InstanceWithPath<TInstance, TCell> | null = null

  for (const candidate of candidates) {
    if (closest && candidate.distance >= closest.path.length) break

    const path = getInstanceClosestFreeCellPath<TCell>(instance, candidate.instance, map)
    if (path.length && (!closest || path.length < closest.path.length)) {
      closest = { instance: candidate.instance, path }
    }
  }

  return closest
}

export function hasWaterBorderWithin<TCell extends GridCell>(
  grid: Grid<TCell>,
  i: number,
  j: number,
  radius: number
): boolean {
  if (radius <= 0) return Boolean(grid[i]?.[j]?.waterBorder)

  const minI = Math.max(0, i - radius)
  const maxI = Math.min(grid.length - 1, i + radius)
  for (let ni = minI; ni <= maxI; ni++) {
    const row = grid[ni]
    if (!row) continue
    const minJ = Math.max(0, j - radius)
    const maxJ = Math.min(row.length - 1, j + radius)
    for (let nj = minJ; nj <= maxJ; nj++) {
      if (row[nj]?.waterBorder) return true
    }
  }
  return false
}
