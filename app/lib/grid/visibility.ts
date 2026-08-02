import { BUCKET_SIZE, FAMILY_TYPES } from '../../constants'
import { getBuildingFootprintRadius } from './cells'
import { updateVisibility } from '../../services/FogOfWar'
import type { GridPosition, Point } from '../../types/grid'
import type { VisibilityEntity } from '../../services/FogOfWar'
import type { Bounds } from '../../types/geometry'

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
        instanceInCamera: (instance: RenderableInstance, bounds?: Bounds) => boolean
      }
      map?: {
        // Real runtime shape is Set<RuntimeEntity>[][] (nullable until first populated) — typed
        // generically here since this field is read through several different RuntimeEntity-ish
        // instance types across call sites.
        instanceBuckets?: Array<Array<Set<RenderableInstance>>> | null
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
    sprite?: { width: number; height: number; anchor?: { x: number; y: number } }
  }

// Buildings (and other sprite-based instances) are anchored on a single ground point but their
// sprite typically extends well beyond it (upward especially, in this isometric projection), so
// culling on the anchor point alone hides them while part of the sprite is still on screen. This
// derives the instance's actual on-screen bounding box so camera culling can use it instead.
function getInstanceScreenBounds(instance: RenderableInstance): Bounds | undefined {
  const sprite = instance.sprite
  if (!sprite) return undefined

  const anchorX = sprite.anchor?.x ?? 0.5
  const anchorY = sprite.anchor?.y ?? 1

  return {
    minX: instance.x - sprite.width * anchorX,
    minY: instance.y - sprite.height * anchorY,
    width: sprite.width,
    height: sprite.height,
  }
}

export function findInstancesInSight<
  TInstance extends RenderableInstance,
  TTarget extends RenderableInstance = RenderableInstance,
>(instance: TInstance, condition: (target: TTarget) => boolean, range?: number): TTarget[] {
  const { i: instX, j: instY, sight = 0 } = instance
  const searchRadius = range ?? sight
  const { instanceBuckets } = instance.context?.map || {}
  if (!instanceBuckets) return []

  const searchRadiusSq = searchRadius * searchRadius
  const instances: TTarget[] = []

  const minBi = Math.max(Math.floor((instX - searchRadius) / BUCKET_SIZE), 0)
  const maxBi = Math.min(Math.floor((instX + searchRadius) / BUCKET_SIZE), instanceBuckets.length - 1)
  const minBj = Math.max(Math.floor((instY - searchRadius) / BUCKET_SIZE), 0)
  const maxBj = Math.min(Math.floor((instY + searchRadius) / BUCKET_SIZE), instanceBuckets[0].length - 1)

  for (let bi = minBi; bi <= maxBi; bi++) {
    for (let bj = minBj; bj <= maxBj; bj++) {
      for (const target of instanceBuckets[bi][bj]) {
        const dx = target.i - instX
        const dy = target.j - instY
        const typedTarget = target as TTarget
        if (dx * dx + dy * dy <= searchRadiusSq && condition(typedTarget)) {
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
  if (!controls.instanceInCamera(instance, getInstanceScreenBounds(instance))) return false

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
  const dist = getBuildingFootprintRadius(instance.size ?? 1)
  for (let i = instance.i - dist; i <= instance.i + dist; i++) {
    for (let j = instance.j - dist; j <= instance.j + dist; j++) {
      if (player.views.isVisible(i, j)) return true
    }
  }
  return false
}
