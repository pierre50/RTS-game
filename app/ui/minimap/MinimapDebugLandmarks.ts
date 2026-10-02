import { BUILDING_TYPES, PLAYER_TYPES } from '../../constants'
import { cartesianToIsometric } from '../../lib/maths'
import { deferredVillageBuildings } from '../../services/world/distantVillages/DeferredVillageStore'
import type { PlayerLike } from '../../types/player'
import { minimapOwnerKey } from './MinimapFilters'
import { settlementMarkerKind, type MinimapMarkerKind } from './MinimapMarkerIcons'

/** Debug geography only: no units, visibility updates, simulation or entity creation. */
export function minimapDebugLandmarks(owners: PlayerLike[], player: PlayerLike, spaceId: string) {
  const markers: { x: number; y: number; kind: MinimapMarkerKind; color: string; ownerKey: string }[] = []
  for (const owner of owners) {
    if (owner === player) continue
    const buildings = (deferredVillageBuildings(owner) ?? owner.buildings).filter(
      building => !building.isDead && !building.isDestroyed && (building.spaceId || 'outside') === spaceId
    )
    const add = (building: { i: number; j: number }, kind: MinimapMarkerKind) => {
      const [x, y] = cartesianToIsometric(building.i, building.j)
      markers.push({
        x,
        y,
        kind,
        color: kind === 'cave' ? '#8f8f8f' : owner.colorHex,
        ownerKey: minimapOwnerKey(owner),
      })
    }
    for (const building of buildings) {
      if (building.type === BUILDING_TYPES.cave) add(building, 'cave')
      else if (owner.type === PLAYER_TYPES.bandits && building.type === BUILDING_TYPES.fireCamp) add(building, 'camp')
    }
    if (owner.type !== PLAYER_TYPES.ai) continue
    const settlement = buildings.filter(building => building.type !== BUILDING_TYPES.cave)
    const anchor =
      settlement.find(building => building.type === BUILDING_TYPES.townCenter) ??
      settlement.find(building => building.type === BUILDING_TYPES.fireCamp) ??
      settlement[0]
    if (anchor) add(anchor, settlementMarkerKind(owner))
  }
  return markers
}
