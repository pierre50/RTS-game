import { BUCKET_SIZE, FAMILY_TYPES } from '../../constants'
import { updateVisibility } from '../../services/FogOfWar'

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

export function instanceShouldRender(instance) {
  const { map, player, controls } = instance?.context || {}
  if (!map || !controls || !instance || instance.isDestroyed) return false
  if (instance.family === FAMILY_TYPES.resource && !map.showResources) return false
  if (!controls.instanceInCamera(instance)) return false

  return (
    map.revealEverything ||
    instance.owner?.isPlayed ||
    instanceIsInPlayerSight(instance, player) ||
    instance.family === FAMILY_TYPES.resource ||
    (!map.revealTerrain && !instance.owner)
  )
}

export function updateInstanceRenderVisibility(instance) {
  if (!instance) return false
  const visible = instanceShouldRender(instance)
  instance.visible = visible
  return visible
}

export function instanceIsInPlayerSight(instance, player) {
  if (!player?.views) return false
  const dist = instance.size === 3 ? 1 : 0
  for (let i = instance.i - dist; i <= instance.i + dist; i++) {
    for (let j = instance.j - dist; j <= instance.j + dist; j++) {
      if (player.views.isVisible(i, j)) return true
    }
  }
  return false
}
