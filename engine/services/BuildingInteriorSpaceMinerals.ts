import { Resource } from '../../app/classes/Resource'
import type { MapBlueprint } from '../../app/classes/map/MapGenerationTypes'
import { bindCaveMineralState } from '../../app/lib/resources/caveMinerals'
import type { GameContextLike } from '../../app/types/context'
import type { CaveMineralState } from '../../app/types/cave'
import type { BuildingInteriorRuntimeSpace } from './BuildingInteriorSpaceTypes'

export function ensureCaveMinerals(
  context: GameContextLike,
  space: BuildingInteriorRuntimeSpace,
  blueprint: MapBlueprint
): void {
  const cave = space.building.cave
  if (space.building.type !== 'Cave' || !cave) return
  if (!cave.minerals) {
    cave.minerals = (blueprint.resources ?? []).flatMap(node => {
      if (node.type !== 'Gold' && node.type !== 'Copper' && node.type !== 'Iron') return []
      const cell = space.grid[node.i]?.[node.j]
      if (!cell || cell.solid || cell.has || cell.terrainHidden) return []
      const quantity = Math.max(0, Math.floor(node.quantity ?? 0))
      if (quantity <= 0) return []
      return [{ i: node.i, j: node.j, type: node.type, quantity, totalQuantity: quantity } satisfies CaveMineralState]
    })
  }
  for (const [index, state] of cave.minerals.entries()) {
    if (state.quantity <= 0) continue
    const label = `${space.id}:mineral:${index}`
    if (space.renderer.entityLayer.children.some(child => child.label === label)) continue
    const cell = space.grid[state.i]?.[state.j]
    if (!cell || cell.solid || cell.has || cell.terrainHidden) continue
    const resource = new Resource(
      {
        i: state.i,
        j: state.j,
        type: state.type,
        totalQuantity: state.totalQuantity,
        spaceId: space.id,
        isNaturalResource: false,
      },
      context
    )
    resource.label = label
    bindCaveMineralState(resource, state)
    // Interior resources live in their space and are saved on the parent cave,
    // never in the exterior resource list or its natural-regrowth system.
    space.renderer.entityLayer.addChild(resource)
  }
}
