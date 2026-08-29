import { BUCKET_SIZE, FAMILY_TYPES } from '../../constants'
import { getBuildingFootprintCells } from './cells'
import { updateVisibility } from '../../services/FogOfWar'
import { getInsightDetectionRange } from '../units/insightDetection'
import { getEntityMapPoint, getEntityMapSpace, isEntityInActiveMapSpace, sameMapSpace } from '../mapSpaces'
import type { GridPosition, Point } from '../../types/grid'
import type { VisibilityEntity } from '../../services/FogOfWar'
import type { Bounds } from '../../types/geometry'
import type { RuntimeMap } from '../../types/map'

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
    spaceId?: string
    type?: string
    owner?: VisibilityEntity['owner'] & {
      isPlayed?: boolean
    } | null
    isDestroyed?: boolean
    size?: number
    sprite?: { width: number; height: number; anchor?: { x: number; y: number } }
    syncShadow?: () => void
  }

export type BoundsSource = {
  context?: {
    map?: unknown
  }
  x: number
  y: number
  destroyed?: boolean
  isDestroyed?: boolean
  position?: { x?: number; y?: number } | null
  spaceId?: string
  sprite?: { destroyed?: boolean; width: number; height: number; anchor?: { x: number; y: number } }
}

type SpaceAwareInstance = {
  context?: { map?: RuntimeMap | null }
  spaceId?: string | null
  x: number
  y: number
}

function getVisibilityRuntimeMap(instance?: { context?: { map?: unknown } } | null): RuntimeMap | null {
  const map = instance?.context?.map
  if (!map || typeof map !== 'object') return null
  const candidate = map as Partial<RuntimeMap>
  return Array.isArray(candidate.grid) && typeof candidate.size === 'number' ? (candidate as RuntimeMap) : null
}

export type FindInstancesInSightOptions = {
  range?: number
  useInsightRange?: boolean
}

function getRenderablePosition(instance: BoundsSource): Point | null {
  if (instance.isDestroyed || instance.destroyed || instance.position === null) return null
  const x = instance.position?.x ?? instance.x
  const y = instance.position?.y ?? instance.y
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  const map = getVisibilityRuntimeMap(instance)
  if (map) return getEntityMapPoint({ ...instance, x: x as number, y: y as number } as SpaceAwareInstance, map)
  return { x: x as number, y: y as number }
}

// Buildings (and other sprite-based instances) are anchored on a single ground point but their
// sprite typically extends well beyond it (upward especially, in this isometric projection), so
// culling on the anchor point alone hides them while part of the sprite is still on screen. This
// derives the instance's actual on-screen bounding box so camera culling — and other overlap
// tests, e.g. hero-occlusion fade — can use it instead.
export function getInstanceScreenBounds(instance: BoundsSource): Bounds | undefined {
  const sprite = instance.sprite
  if (!sprite) return undefined
  if (sprite.destroyed) return undefined
  const position = getRenderablePosition(instance)
  if (!position) return undefined

  const anchorX = sprite.anchor?.x ?? 0.5
  const anchorY = sprite.anchor?.y ?? 1

  return {
    minX: position.x - sprite.width * anchorX,
    minY: position.y - sprite.height * anchorY,
    width: sprite.width,
    height: sprite.height,
  }
}

export function findInstancesInSight<
  TInstance extends RenderableInstance,
  TTarget extends RenderableInstance = RenderableInstance,
>(
  instance: TInstance,
  condition: (target: TTarget) => boolean,
  rangeOrOptions?: number | FindInstancesInSightOptions
): TTarget[] {
  const { i: instX, j: instY, sight = 0 } = instance
  const options = typeof rangeOrOptions === 'number' ? { range: rangeOrOptions } : rangeOrOptions
  const searchRadius = options?.range ?? sight
  const map = getVisibilityRuntimeMap(instance)
  const space = getEntityMapSpace(instance as SpaceAwareInstance, map)
  const instanceBuckets = space?.instanceBuckets ?? instance.context?.map?.instanceBuckets
  if (!instanceBuckets) return []

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
        if (!sameMapSpace(instance, typedTarget)) continue
        const detectionRadius = options?.useInsightRange
          ? getInsightDetectionRange(instance, typedTarget, searchRadius)
          : searchRadius
        if (dx * dx + dy * dy <= detectionRadius * detectionRadius && condition(typedTarget)) {
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

function instanceShouldRender(instance?: RenderableInstance | null): boolean {
  const { map, player, controls } = instance?.context || {}
  if (!map || !controls || !instance || instance.isDestroyed) return false
  const runtimeMap = getVisibilityRuntimeMap(instance)
  if (!isEntityInActiveMapSpace(instance as SpaceAwareInstance, runtimeMap)) return false
  if (!getRenderablePosition(instance)) return false
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
  instance.syncShadow?.()
  return visible
}

export function instanceIsInPlayerSight(instance: RenderableInstance, player?: PlayerVisibility): boolean {
  const views = player?.views
  if (!views) return false
  const parent = (instance as RenderableInstance & { parent?: { grid?: Array<Array<GridPosition>> } | null }).parent
  const grid = parent?.grid
  if (!grid) return views.isVisible(instance.i, instance.j)
  return getBuildingFootprintCells(instance.i, instance.j, grid, instance.size ?? 1).some(cell =>
    views.isVisible(cell.i, cell.j)
  )
}
