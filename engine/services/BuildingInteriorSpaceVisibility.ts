import type { Container } from 'pixi.js'
import { updateInstanceVisibility } from '../../app/lib/grid/visibility'
import type { GameContextLike } from '../../app/types/context'
import { isBuildingInteriorRuntimeSpace } from './BuildingInteriorSpaceLookup'
import type { BuildingInteriorRuntimeSpace } from './BuildingInteriorSpaceTypes'

export function refreshMapSpaceEntityVisibility(context: GameContextLike): void {
  const refreshed = new Set<object>()
  for (const space of context.map.spaces?.values?.() ?? []) {
    for (const column of space.instanceBuckets ?? []) {
      for (const bucket of column) {
        for (const entity of bucket) {
          if (refreshed.has(entity)) continue
          refreshed.add(entity)
          updateInstanceVisibility(entity)
        }
      }
    }
    ;(space.container as Container & { sortChildren?: () => void }).sortChildren?.()
  }
}

export function activateBuildingInteriorSpace(context: GameContextLike, space: BuildingInteriorRuntimeSpace): void {
  const map = context.map
  for (const candidate of map.spaces?.values?.() ?? []) {
    if (isBuildingInteriorRuntimeSpace(candidate)) candidate.renderer.setActive(candidate.id === space.id)
  }
  map.activeSpaceId = space.id
  space.renderer.setActive(true)
  space.renderer.update(0)
  refreshMapSpaceEntityVisibility(context)
}

export function deactivateBuildingInteriorSpace(context: GameContextLike, space: BuildingInteriorRuntimeSpace): void {
  const map = context.map
  if (map.activeSpaceId === space.id) map.activeSpaceId = null
  space.renderer.setActive(false)
  refreshMapSpaceEntityVisibility(context)
}
