import { BUCKET_SIZE, FAMILY_TYPES } from '../../constants'
import type { VisibilityEntity } from '../../services/FogOfWar'
import { updateVisibility } from '../../services/FogOfWar'
import type { Bounds } from '../../types/geometry'
import type { GridPosition, Point } from '../../types/grid'
import { getEntityMapSpace, sameMapSpace } from '../mapSpaces'
import { getInsightDetectionRange } from '../units/insightDetection'
import { getBuildingFootprintCells } from './cells'
import { getInstanceScreenBounds, getRenderablePosition, getVisibilityRuntimeMap } from './screenBounds'
export { getInstanceScreenBounds } from './screenBounds'

type PlayerVisibility = {
  label?: string
  team?: number | null
  views?: {
    withSpace?: <T>(spaceId: string | null | undefined, callback: () => T) => T
    getViewers?: (i: number, j: number) => ReadonlySet<unknown>
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
        activeSpaceId?: string | null
        revealEverything?: boolean
        revealTerrain?: boolean
        showResources?: boolean
      }
      player?: PlayerVisibility
      players?: PlayerVisibility[]
    }
    family?: string
    spaceId?: string
    type?: string
    hideWhenFogged?: boolean
    owner?:
      | (VisibilityEntity['owner'] & {
          isPlayed?: boolean
        })
      | null
    isDestroyed?: boolean
    size?: number
    sprite?: { width: number; height: number; anchor?: { x: number; y: number } }
    syncShadow?: () => void
  }

export type FindInstancesInSightOptions = {
  range?: number
  useInsightRange?: boolean
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
  const space = getEntityMapSpace({ spaceId: instance.spaceId ?? null }, map)
  const instanceBuckets = space?.instanceBuckets ?? instance.context?.map?.instanceBuckets
  if (!instanceBuckets?.length) return []

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
  const { map, controls } = instance?.context || {}
  if (!map || !controls || !instance || instance.isDestroyed) return false
  const runtimeMap = getVisibilityRuntimeMap(instance)
  if (!sameMapSpace(instance, { spaceId: map.activeSpaceId ?? null })) return false
  if (!getRenderablePosition(instance)) return false
  if (instance.family === FAMILY_TYPES.resource && !map.showResources) return false
  if (!controls.instanceInCamera(instance, getInstanceScreenBounds(instance))) return false
  if (getEntityMapSpace({ spaceId: instance.spaceId ?? null }, runtimeMap)?.kind === 'interior') return true
  return instancePassesFog(instance)
}

function instancePassesFog(instance: RenderableInstance): boolean {
  const { map, player } = instance.context ?? {}
  if (!map) return false
  if (map.revealEverything) return true
  const inPlayerSight = instanceIsInPlayerSight(instance, player)
  if (instance.hideWhenFogged && !instanceIsInActiveOrTeamSight(instance, player, instance.context?.players)) {
    return false
  }

  return (
    instance.owner?.isPlayed ||
    inPlayerSight ||
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
  const checkVisible = () => {
    const space = getEntityMapSpace({ spaceId: instance.spaceId ?? null }, getVisibilityRuntimeMap(instance))
    if (space?.kind === 'interior') return true
    const parent = (instance as RenderableInstance & { parent?: { grid?: Array<Array<GridPosition>> } | null }).parent
    const grid = space?.grid ?? parent?.grid
    if (!grid) return views.isVisible(instance.i, instance.j)
    return getBuildingFootprintCells(instance.i, instance.j, grid, instance.size ?? 1).some(cell =>
      views.isVisible(cell.i, cell.j)
    )
  }
  return views.withSpace?.(instance.spaceId, checkVisible) ?? checkVisible()
}

function hasActiveViewerOtherThanSelf(
  instance: RenderableInstance,
  views: NonNullable<PlayerVisibility['views']>,
  i: number,
  j: number
): boolean {
  const viewers = views.getViewers?.(i, j)
  if (!viewers) return views.isVisible(i, j)
  for (const viewer of viewers) {
    if (viewer === instance) continue
    if (typeof viewer === 'string') {
      if (viewer !== instance.label) return true
      continue
    }
    if (viewer && typeof viewer === 'object' && 'label' in viewer && viewer.label === instance.label) continue
    return true
  }
  return false
}

function playerIsSameTeam(player: PlayerVisibility | undefined, other: PlayerVisibility | undefined): boolean {
  return Boolean(
    player &&
      other &&
      (player.label === other.label || (player.team != null && other.team != null && player.team === other.team))
  )
}

export function instanceIsInActiveOrTeamSight(
  instance: RenderableInstance,
  player?: PlayerVisibility,
  players: readonly PlayerVisibility[] = []
): boolean {
  const friendlyPlayers = players.length ? players.filter(candidate => playerIsSameTeam(player, candidate)) : [player]
  for (const candidate of friendlyPlayers) {
    const views = candidate?.views
    if (!views) continue
    const parent = (instance as RenderableInstance & { parent?: { grid?: Array<Array<GridPosition>> } | null }).parent
    const grid = parent?.grid
    if (!grid) {
      if (hasActiveViewerOtherThanSelf(instance, views, instance.i, instance.j)) return true
      continue
    }
    if (
      getBuildingFootprintCells(instance.i, instance.j, grid, instance.size ?? 1).some(cell =>
        hasActiveViewerOtherThanSelf(instance, views, cell.i, cell.j)
      )
    ) {
      return true
    }
  }
  return false
}
