import { BUILDING_TYPES, PLAYER_TYPES, UNIT_TYPES } from '../../constants'
import { getBuildingFootprintCells } from '../../lib/grid/cells'
import { getEntitySpaceId } from '../../lib/mapSpaces'
import type { MinimapHostLike } from '../../types/context'
import type { MinimapBuildingKnowledge } from './MinimapBuildingKnowledge'
import { hasActiveCampGuards } from './MinimapCampState'
import { isMinimapMarkerHidden, minimapOwnerKey } from './MinimapFilters'
import type { MinimapGeometry } from './MinimapGeometry'
import { type MinimapTransform } from './MinimapGeometry'
import { drawMinimapMarker } from './MinimapMarkers'
import { drawMinimapUnitMarker } from './MinimapUnitMarkers'

export function drawMinimapEntities(
  menu: MinimapHostLike,
  geometry: MinimapGeometry,
  knownBuildings: ReturnType<MinimapBuildingKnowledge['update']>,
  transform: MinimapTransform,
  space: ReturnType<MinimapGeometry['getMinimapSpace']>,
  context: CanvasRenderingContext2D,
  redraw: () => void
): void {
  const { map, player, players, controls } = menu.context
  for (const owner of players) {
    for (const building of owner.buildings) {
      const cave = building.type === BUILDING_TYPES.cave
      const camp = owner.type === PLAYER_TYPES.bandits && building.type === BUILDING_TYPES.fireCamp
      const ownBase = owner === player && building.type === BUILDING_TYPES.townCenter
      if (ownBase && building.isBuilt === false) continue
      if (
        isMinimapMarkerHidden(menu.context, ownBase ? 'base' : owner === player ? 'self' : minimapOwnerKey(owner)) ||
        (cave && isMinimapMarkerHidden(menu.context, 'caves'))
      )
        continue
      if (owner !== player && !cave && !camp && building.type !== BUILDING_TYPES.townCenter) continue
      if (camp && !hasActiveCampGuards(owner, building)) continue
      if (!cave && owner !== player && owner.type === PLAYER_TYPES.ai) continue
      if (getEntitySpaceId(building) !== space.id || building.isDead || building.isDestroyed) continue
      if (
        owner !== player &&
        !map.revealEverything &&
        !getBuildingFootprintCells(building.i, building.j, space.grid, building.size).some(cell =>
          player?.views?.isViewed(cell.i, cell.j)
        )
      )
        continue
      const point = geometry.instanceToMinimapPoint(building, transform)
      if (owner === player && !cave && !ownBase) {
        if (point) drawMinimapUnitMarker(context, 'building', point, owner.colorHex, building.selected)
        continue
      }
      const kind = camp
        ? 'camp'
        : cave
          ? 'cave'
          : owner !== player && owner.type === PLAYER_TYPES.ai
            ? 'village'
            : 'home'
      if (point) {
        drawMinimapMarker(context, kind, point, cave ? '#8f8f8f' : owner.colorHex, redraw, building.selected)
      }
    }
  }
  for (const building of knownBuildings) {
    if (isMinimapMarkerHidden(menu.context, building.ownerKey)) continue
    const point = {
      x: geometry.toMinimapX(building.x, transform),
      y: geometry.toMinimapY(building.y, transform),
    }
    context.save()
    context.filter = building.visible ? 'none' : 'brightness(55%)'
    if (building.town) drawMinimapMarker(context, 'home', point, building.color, redraw)
    else drawMinimapUnitMarker(context, 'building', point, building.color)
    context.restore()
  }
  const hero = controls.heroUnit
  for (const owner of players) {
    if (owner !== player && owner.type !== PLAYER_TYPES.ai && owner.type !== PLAYER_TYPES.bandits) continue
    if (isMinimapMarkerHidden(menu.context, owner === player ? 'self' : minimapOwnerKey(owner))) continue
    for (const unit of owner.units) {
      if (unit === hero || getEntitySpaceId(unit) !== space.id || unit.shelterState?.status === 'inside') continue
      if (owner !== player && !map.revealEverything && !player.views?.isVisible?.(unit.i, unit.j)) continue
      const point = geometry.instanceToMinimapPoint(unit, transform)
      if (!point) continue
      drawMinimapUnitMarker(
        context,
        unit.type === UNIT_TYPES.villager ? 'villager' : 'troop',
        point,
        owner.colorHex,
        unit.selected
      )
    }
  }
  if (hero && !isMinimapMarkerHidden(menu.context, 'self') && getEntitySpaceId(hero) === space.id) {
    const point = geometry.instanceToMinimapPoint(hero, transform)
    if (point)
      drawMinimapUnitMarker(
        context,
        'hero',
        point,
        hero.owner?.colorHex ?? player?.colorHex ?? '#ffffff',
        false,
        hero.degree
      )
  }
}
