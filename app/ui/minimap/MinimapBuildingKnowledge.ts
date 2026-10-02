import { BUILDING_TYPES, PLAYER_TYPES } from '../../constants'
import { getBuildingFootprintCells } from '../../lib/grid/cells'
import { getEntitySpaceId } from '../../lib/mapSpaces'
import { cartesianToIsometric } from '../../lib/maths'
import { deferredVillageBuildings } from '../../services/world/distantVillages/DeferredVillageStore'
import type { MinimapBuildingMemory } from '../../types/minimap'
import type { RuntimeMapSpace } from '../../types/map'
import type { PlayerLike } from '../../types/player'
import { getMinimapDrawPosition } from './MinimapGeometry'
import { minimapOwnerKey } from './MinimapFilters'
import { withMinimapPlayerVision } from './MinimapVisibility'

type KnownMinimapBuilding = MinimapBuildingMemory & { visible: boolean }

/** Snapshots deliberately contain no live entity reference or hidden health state. */
export class MinimapBuildingKnowledge {
  update(player: PlayerLike, owners: PlayerLike[], space: RuntimeMapSpace, reveal = false): KnownMinimapBuilding[] {
    const saved = player.minimapBuildingMemory ?? []
    const memory = new Map<string, KnownMinimapBuilding>(
      saved.filter(entry => entry.spaceId === space.id).map(entry => [entry.id, { ...entry, visible: false }])
    )
    return withMinimapPlayerVision(player, space.id, () => {
      const visible = (building: { i: number; j: number; size?: number; type?: string }) =>
        reveal ||
        getBuildingFootprintCells(building.i, building.j, space.grid, building.size, undefined, building.type).some(
          cell => player.views?.isVisible?.(cell.i, cell.j)
        )
      // A visible location is checked against the live buildings below. Hidden ones
      // retain their last observed owner and position even after destruction.
      for (const [key, known] of memory) {
        if (visible(known)) memory.delete(key)
        else known.visible = false
      }
      for (const owner of owners) {
        if (owner === player || owner.type !== PLAYER_TYPES.ai) continue
        const deferred = deferredVillageBuildings(owner)
        const buildings = deferred
          ? deferred.map(building => {
              const [x, y] = cartesianToIsometric(building.i, building.j)
              return { building, position: { x, y } }
            })
          : owner.buildings.map(building => ({ building, position: getMinimapDrawPosition(building) }))
        for (const { building, position } of buildings) {
          if (building.type === BUILDING_TYPES.cave || getEntitySpaceId(building) !== space.id) continue
          if (!visible(building) || building.isDead || building.isDestroyed) continue
          if (!position) continue
          const { x, y } = position
          const id = building.label || `${minimapOwnerKey(owner)}:${building.type}:${building.i}:${building.j}`
          memory.set(id, {
            id,
            spaceId: space.id,
            x,
            y,
            i: building.i,
            j: building.j,
            size: building.size ?? 1,
            color: owner.colorHex,
            ownerKey: minimapOwnerKey(owner),
            settlementId: owner.label ?? minimapOwnerKey(owner),
            settlementKind: owner.settlementType ?? 'village',
            town: building.type === BUILDING_TYPES.townCenter,
            visible: true,
          })
        }
      }
      const known = [...memory.values()]
      player.minimapBuildingMemory = [
        ...saved.filter(entry => entry.spaceId !== space.id),
        ...known.map(({ visible: _visible, ...entry }) => entry),
      ]
      return known
    })
  }
}
