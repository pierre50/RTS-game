import { t } from '../../lib/lang'
import type { MinimapPlace } from '../../types/minimap'
import { BUILDING_TYPES, PLAYER_TYPES, UNIT_TYPES } from '../../constants'
import { getBuildingFootprintCells } from '../../lib/grid/cells'
import { getEntitySpaceId } from '../../lib/mapSpaces'
import type { MinimapHostLike } from '../../types/context'
import type { MinimapBuildingKnowledge } from './MinimapBuildingKnowledge'
import { hasActiveCampGuards } from './MinimapCampState'
import { isMinimapMarkerHidden, minimapOwnerKey } from './MinimapFilters'
import type { MinimapGeometry } from './MinimapGeometry'
import { MINIMAP_RESOLUTION_SCALE, type MinimapTransform } from './MinimapGeometry'
import { drawMinimapMarker } from './MinimapMarkers'
import { drawMinimapUnitCluster, drawMinimapUnitMarker } from './MinimapUnitMarkers'
import { clusterMinimapUnits, type MinimapUnitPoint } from './MinimapUnitClusters'
import { getMinimapMarkerScale, getMinimapPlaceScale, showMinimapDetails } from './MinimapZoom'
import { minimapDebugLandmarks } from './MinimapDebugLandmarks'

export function drawMinimapEntities(
  menu: MinimapHostLike,
  geometry: MinimapGeometry,
  knownBuildings: ReturnType<MinimapBuildingKnowledge['update']>,
  transform: MinimapTransform,
  space: ReturnType<MinimapGeometry['getMinimapSpace']>,
  context: CanvasRenderingContext2D,
  redraw: () => void,
  places: MinimapPlace[] = []
): void {
  const { map, player, players, controls } = menu.context
  const details = showMinimapDetails(menu.context)
  const markerScale = getMinimapPlaceScale(menu.context)
  const label = (kind: string) =>
    t(
      (
        {
          village: 'settlementVillage',
          city: 'settlementCity',
          outpost: 'settlementOutpost',
          camp: 'minimapLegendCamp',
          cave: 'Cave',
          home: 'minimapPlayerBase',
        } as Record<string, string>
      )[kind] ?? kind
    )
  const unitScale = getMinimapMarkerScale(menu.context)
  if (map.revealEverything) {
    for (const marker of minimapDebugLandmarks(players, player, space.id)) {
      if (
        isMinimapMarkerHidden(menu.context, marker.ownerKey) ||
        (marker.kind === 'cave' && isMinimapMarkerHidden(menu.context, 'caves'))
      )
        continue
      places.push({
        x: geometry.toMinimapX(marker.x, transform),
        y: geometry.toMinimapY(marker.y, transform),
        name: label(marker.kind),
        description: '',
      })
      drawMinimapMarker(
        context,
        marker.kind,
        {
          x: geometry.toMinimapX(marker.x, transform),
          y: geometry.toMinimapY(marker.y, transform),
        },
        marker.color,
        redraw,
        false,
        markerScale
      )
    }
  }
  for (const owner of players) {
    if (map.revealEverything && owner !== player) continue
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
        !getBuildingFootprintCells(building.i, building.j, space.grid, building.size, undefined, building.type).some(
          cell => player?.views?.isViewed(cell.i, cell.j)
        )
      )
        continue
      const point = geometry.instanceToMinimapPoint(building, transform)
      if (owner === player && !cave && !ownBase) {
        if (point) drawMinimapUnitMarker(context, 'building', point, owner.colorHex, building.selected, 0, unitScale)
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
        places.push({
          ...point,
          name: label(kind),
          description: owner === player ? t('you') : (owner.name ?? owner.civ ?? ''),
        })
        drawMinimapMarker(
          context,
          kind,
          point,
          cave ? '#8f8f8f' : owner.colorHex,
          redraw,
          building.selected,
          markerScale
        )
      }
    }
  }
  const settlements = new Map<string, (typeof knownBuildings)[number]>()
  for (const building of knownBuildings) {
    const key = building.settlementId ?? building.ownerKey
    const previous = settlements.get(key)
    if (!previous || (building.town && !previous.town)) settlements.set(key, building)
  }
  for (const building of map.revealEverything ? [] : settlements.values()) {
    if (isMinimapMarkerHidden(menu.context, building.ownerKey)) continue
    const point = {
      x: geometry.toMinimapX(building.x, transform),
      y: geometry.toMinimapY(building.y, transform),
    }
    places.push({
      ...point,
      name: label(building.settlementKind ?? 'village'),
      description: t(building.visible ? 'minimapPlaceVisible' : 'minimapPlaceRemembered'),
    })
    context.save()
    context.filter = building.visible ? 'none' : 'brightness(55%)'
    drawMinimapMarker(context, building.settlementKind ?? 'village', point, building.color, redraw, false, markerScale)
    context.restore()
  }
  const hero = controls.heroUnit
  for (const owner of players) {
    if (owner !== player) continue
    if (isMinimapMarkerHidden(menu.context, owner === player ? 'self' : minimapOwnerKey(owner))) continue
    const villagers: MinimapUnitPoint[] = []
    const troops: MinimapUnitPoint[] = []
    for (const unit of owner.units) {
      if (!details && unit.type !== UNIT_TYPES.villager) continue
      if (unit === hero || getEntitySpaceId(unit) !== space.id || unit.shelterState?.status === 'inside') continue
      if (owner !== player && !map.revealEverything && !player.views?.isVisible?.(unit.i, unit.j)) continue
      const point = geometry.instanceToMinimapPoint(unit, transform)
      if (!point) continue
      const markers = unit.type === UNIT_TYPES.villager ? villagers : troops
      markers.push({ ...point, selected: unit.selected })
    }
    for (const cluster of clusterMinimapUnits(villagers, 16 * MINIMAP_RESOLUTION_SCALE)) {
      drawMinimapUnitCluster(context, cluster, owner.colorHex, unitScale)
    }
    for (const point of troops) {
      drawMinimapUnitMarker(context, 'troop', point, owner.colorHex, point.selected, 0, unitScale)
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
        hero.degree,
        unitScale
      )
  }
}
