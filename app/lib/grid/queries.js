import { instancesDistance } from '../maths'
import { getInstanceClosestFreeCellPath } from './movement'

function insertCandidate(candidates, candidate, maxCandidates) {
  let index = candidates.findIndex(item => candidate.distance < item.distance)
  if (index === -1) index = candidates.length
  candidates.splice(index, 0, candidate)
  if (candidates.length > maxCandidates) {
    candidates.length = maxCandidates
  }
}

export function getClosestInstance(instance, instances) {
  let closestInstance = null
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

export function getClosestInstanceWithPath(instance, instances, maxCandidates = 6) {
  const candidates = []
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

  let closest = null

  for (const candidate of candidates) {
    if (closest && candidate.distance >= closest.path.length) break

    const path = getInstanceClosestFreeCellPath(instance, candidate.instance, instance.parent)
    if (path.length && (!closest || path.length < closest.path.length)) {
      closest = { instance: candidate.instance, path }
    }
  }

  return closest
}
