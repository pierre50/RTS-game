import { BUCKET_SIZE } from '../../constants'
import { updateVisibility } from '../../services/FogOfWar'
import { getPlainCellsAroundPoint } from './cells'

export function findInstancesInSight(instance, condition) {
  const {
    i: instX,
    j: instY,
    sight,
    context: { map },
  } = instance
  const { instanceBuckets } = map
  if (!instanceBuckets) return []

  const sightSq = sight * sight
  const instances = []

  const minBi = Math.max(Math.floor((instX - sight) / BUCKET_SIZE), 0)
  const maxBi = Math.min(Math.floor((instX + sight) / BUCKET_SIZE), instanceBuckets.length - 1)
  const minBj = Math.max(Math.floor((instY - sight) / BUCKET_SIZE), 0)
  const maxBj = Math.min(Math.floor((instY + sight) / BUCKET_SIZE), instanceBuckets[0].length - 1)

  for (let bi = minBi; bi <= maxBi; bi++) {
    for (let bj = minBj; bj <= maxBj; bj++) {
      for (const target of instanceBuckets[bi][bj]) {
        const dx = target.i - instX
        const dy = target.j - instY
        if (dx * dx + dy * dy <= sightSq && condition(target)) {
          instances.push(target)
        }
      }
    }
  }

  return instances
}

export function updateInstanceVisibility(instance) {
  return updateVisibility(instance)
}

export function instanceIsInPlayerSight(instance, player) {
  if (!player?.views) return false
  const dist = instance.size === 3 ? 1 : 0
  const cells = getPlainCellsAroundPoint(instance.i, instance.j, player.views, dist)
  return cells.some(cell => cell.viewBy.size > 0)
}
