import { BUCKET_SIZE, FAMILY_TYPES } from '../../constants'
import { updateVisibility } from '../../services/FogOfWar'
import type { GridPosition, Point } from '../../types/grid'
import type { VisibilityEntity } from '../../services/FogOfWar'

type PlayerVisibility = {
  views?: {
    isVisible: (i: number, j: number) => boolean
  }
}

export type RenderableInstance = VisibilityEntity &
  GridPosition &
  Point & {
    context?: {
      controls?: {
        instanceInCamera: (instance: RenderableInstance) => boolean
      }
      map?: {
        instanceBuckets?: RenderableInstance[][][]
        revealEverything?: boolean
        revealTerrain?: boolean
        showResources?: boolean
      }
      player?: PlayerVisibility
    }
    family?: string
    type?: string
    owner?: VisibilityEntity['owner'] & {
      isPlayed?: boolean
    } | null
    isDestroyed?: boolean
    size?: number
  }

export function findInstancesInSight<
  TInstance extends RenderableInstance,
  TTarget extends RenderableInstance = RenderableInstance,
>(instance: TInstance, condition: (target: TTarget) => boolean): TTarget[] {
  const { i: instX, j: instY, sight = 0 } = instance
  const { instanceBuckets } = instance.context?.map || {}
  if (!instanceBuckets) return []

  const sightSq = sight * sight
  const instances: TTarget[] = []

  const minBi = Math.max(Math.floor((instX - sight) / BUCKET_SIZE), 0)
  const maxBi = Math.min(Math.floor((instX + sight) / BUCKET_SIZE), instanceBuckets.length - 1)
  const minBj = Math.max(Math.floor((instY - sight) / BUCKET_SIZE), 0)
  const maxBj = Math.min(Math.floor((instY + sight) / BUCKET_SIZE), instanceBuckets[0].length - 1)

  for (let bi = minBi; bi <= maxBi; bi++) {
    for (let bj = minBj; bj <= maxBj; bj++) {
      for (const target of instanceBuckets[bi][bj]) {
        const dx = target.i - instX
        const dy = target.j - instY
        const typedTarget = target as TTarget
        if (dx * dx + dy * dy <= sightSq && condition(typedTarget)) {
          instances.push(typedTarget)
        }
      }
    }
  }

  return instances
}

export function updateInstanceVisibility(instance: RenderableInstance): void {
  return updateVisibility(instance)
}

export function instanceShouldRender(instance?: RenderableInstance | null): boolean {
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

export function updateInstanceRenderVisibility(instance?: RenderableInstance | null): boolean {
  if (!instance) return false
  const visible = instanceShouldRender(instance)
  instance.visible = visible
  return visible
}

export function instanceIsInPlayerSight(instance: RenderableInstance, player?: PlayerVisibility): boolean {
  if (!player?.views) return false
  const dist = instance.size === 3 ? 1 : 0
  for (let i = instance.i - dist; i <= instance.i + dist; i++) {
    for (let j = instance.j - dist; j <= instance.j + dist; j++) {
      if (player.views.isVisible(i, j)) return true
    }
  }
  return false
}
