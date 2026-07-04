import { instancesDistance } from '../maths'
import { getInstanceClosestFreeCellPath, type GameMap } from './movement'
import type { GridCell, InstanceLike } from '../../types/grid'

type Candidate<TInstance extends InstanceLike> = {
  distance: number
  instance: TInstance
}

type InstanceWithPath<TInstance extends InstanceLike, TCell extends GridCell = GridCell> = {
  instance: TInstance
  path: TCell[]
}

function insertCandidate<TInstance extends InstanceLike>(
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

export function getClosestInstance<TInstance extends InstanceLike>(
  instance: InstanceLike,
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

export function getClosestInstanceWithPath<TInstance extends InstanceLike, TCell extends GridCell = GridCell>(
  instance: InstanceLike,
  instances: Iterable<TInstance>,
  maxCandidates = 6
): InstanceWithPath<TInstance, TCell> | null {
  if (!instance.parent) return null
  const map = instance.parent as unknown as GameMap<TCell>

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
