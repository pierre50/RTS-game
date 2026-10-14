import { t } from '../../../lib/lang'
import { BUILDING_TYPES, PLAYER_TYPES } from '../../../constants'
import { getBuildingFootprintCells } from '../../../lib/grid/cells'
import { getEntitySpaceId } from '../../../lib/mapSpaces'
import type { BuildingEntity } from '../../../types/entities'
import type { PlayerLike } from '../../../types/player'
import type { MinimapBuildingKnowledge } from '../MinimapBuildingKnowledge'
import { hasActiveCampGuards } from '../MinimapCampState'
import { minimapDebugLandmarks } from '../MinimapDebugLandmarks'
import { isMinimapMarkerHidden, minimapOwnerKey } from '../MinimapFilters'
import { drawMinimapMarker } from '../MinimapMarkers'
import { drawMinimapUnitMarker } from '../MinimapUnitMarkers'
import { minimapPlaceLabel, type MinimapEntityDraw } from './MinimapEntityDraw'

type KnownBuilding = ReturnType<MinimapBuildingKnowledge['update']>[number]
type BuildingRole = { cave: boolean; camp: boolean; ownBase: boolean }

export function drawMinimapDebugLandmarks(draw: MinimapEntityDraw): void {
  const { menu, geometry, transform } = draw
  const { players, player } = menu.context
  for (const marker of minimapDebugLandmarks(players, player, draw.space.id)) {
    if (
      isMinimapMarkerHidden(menu.context, marker.ownerKey) ||
      (marker.kind === 'cave' && isMinimapMarkerHidden(menu.context, 'caves'))
    )
      continue
    draw.places.push({
      x: geometry.toMinimapX(marker.x, transform),
      y: geometry.toMinimapY(marker.y, transform),
      name: minimapPlaceLabel(marker.kind),
      description: '',
    })
    drawMinimapMarker(
      draw.context,
      marker.kind,
      {
        x: geometry.toMinimapX(marker.x, transform),
        y: geometry.toMinimapY(marker.y, transform),
      },
      marker.color,
      draw.redraw,
      false,
      draw.markerScale
    )
  }
}

function isFilteredOut(draw: MinimapEntityDraw, owner: PlayerLike, role: BuildingRole): boolean {
  const { player } = draw.menu.context
  const ownerKey = role.ownBase ? 'base' : owner === player ? 'self' : minimapOwnerKey(owner)
  return (
    isMinimapMarkerHidden(draw.menu.context, ownerKey) ||
    (role.cave && isMinimapMarkerHidden(draw.menu.context, 'caves'))
  )
}

function isForeignBuildingHidden(
  draw: MinimapEntityDraw,
  owner: PlayerLike,
  building: BuildingEntity,
  role: BuildingRole
): boolean {
  const { map, player } = draw.menu.context
  if (owner === player) return false
  if (!role.cave && !role.camp && building.type !== BUILDING_TYPES.townCenter) return true
  if (!role.cave && owner.type === PLAYER_TYPES.ai) return true
  if (map.revealEverything) return false
  return !getBuildingFootprintCells(
    building.i,
    building.j,
    draw.space.grid,
    building.size,
    undefined,
    building.type
  ).some(cell => player?.views?.isViewed(cell.i, cell.j))
}

function minimapBuildingRole(
  draw: MinimapEntityDraw,
  owner: PlayerLike,
  building: BuildingEntity
): BuildingRole | null {
  const { player } = draw.menu.context
  const role = {
    cave: building.type === BUILDING_TYPES.cave,
    camp: owner.type === PLAYER_TYPES.bandits && building.type === BUILDING_TYPES.fireCamp,
    ownBase: owner === player && building.type === BUILDING_TYPES.townCenter,
  }
  if (role.ownBase && building.isBuilt === false) return null
  if (isFilteredOut(draw, owner, role)) return null
  if (role.camp && !hasActiveCampGuards(owner, building)) return null
  if (getEntitySpaceId(building) !== draw.space.id || building.isDead || building.isDestroyed) return null
  return isForeignBuildingHidden(draw, owner, building, role) ? null : role
}

function drawOwnedBuilding(draw: MinimapEntityDraw, owner: PlayerLike, building: BuildingEntity, role: BuildingRole) {
  const { player } = draw.menu.context
  const point = draw.geometry.instanceToMinimapPoint(building, draw.transform)
  if (owner === player && !role.cave && !role.ownBase) {
    if (point)
      drawMinimapUnitMarker(draw.context, 'building', point, owner.colorHex, building.selected, 0, draw.unitScale)
    return
  }
  const kind = role.camp
    ? 'camp'
    : role.cave
      ? 'cave'
      : owner !== player && owner.type === PLAYER_TYPES.ai
        ? 'village'
        : 'home'
  if (!point) return
  draw.places.push({
    ...point,
    name: minimapPlaceLabel(kind),
    description: owner === player ? t('you') : (owner.name ?? owner.civ ?? ''),
  })
  drawMinimapMarker(
    draw.context,
    kind,
    point,
    role.cave ? '#8f8f8f' : owner.colorHex,
    draw.redraw,
    building.selected,
    draw.markerScale
  )
}

export function drawMinimapBuildings(draw: MinimapEntityDraw): void {
  const { map, player, players } = draw.menu.context
  for (const owner of players) {
    if (map.revealEverything && owner !== player) continue
    for (const building of owner.buildings) {
      const role = minimapBuildingRole(draw, owner, building)
      if (role) drawOwnedBuilding(draw, owner, building, role)
    }
  }
}

export function drawMinimapKnownSettlements(draw: MinimapEntityDraw, knownBuildings: KnownBuilding[]): void {
  const settlements = new Map<string, KnownBuilding>()
  for (const building of knownBuildings) {
    const key = building.settlementId ?? building.ownerKey
    const previous = settlements.get(key)
    if (!previous || (building.town && !previous.town)) settlements.set(key, building)
  }
  const { context, geometry, transform } = draw
  for (const building of draw.menu.context.map.revealEverything ? [] : settlements.values()) {
    if (isMinimapMarkerHidden(draw.menu.context, building.ownerKey)) continue
    const point = {
      x: geometry.toMinimapX(building.x, transform),
      y: geometry.toMinimapY(building.y, transform),
    }
    draw.places.push({
      ...point,
      name: minimapPlaceLabel(building.settlementKind ?? 'village'),
      description: t(building.visible ? 'minimapPlaceVisible' : 'minimapPlaceRemembered'),
    })
    context.save()
    context.filter = building.visible ? 'none' : 'brightness(55%)'
    drawMinimapMarker(
      context,
      building.settlementKind ?? 'village',
      point,
      building.color,
      draw.redraw,
      false,
      draw.markerScale
    )
    context.restore()
  }
}
