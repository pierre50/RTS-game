import { instancesDistance } from '../maths'
import { getInstanceClosestFreeCellPath } from './movement'

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
  const sorted = [...instances].sort((a, b) => instancesDistance(instance, a) - instancesDistance(instance, b))

  let closest = null
  let attempts = 0

  for (const target of sorted) {
    if (closest && instancesDistance(instance, target) >= closest.path.length) break
    if (attempts++ >= maxCandidates) break

    const path = getInstanceClosestFreeCellPath(instance, target, instance.parent)
    if (path.length && (!closest || path.length < closest.path.length)) {
      closest = { instance: target, path }
    }
  }

  return closest
}
