import { UNIT_TYPES } from '../../../constants'
import { getEntitySpaceId } from '../../../lib/mapSpaces'
import type { PlayerLike } from '../../../types/player'
import { isMinimapMarkerHidden } from '../MinimapFilters'
import { MINIMAP_RESOLUTION_SCALE } from '../MinimapGeometry'
import { clusterMinimapUnits, type MinimapUnitPoint } from '../MinimapUnitClusters'
import { drawMinimapUnitCluster, drawMinimapUnitMarker } from '../MinimapUnitMarkers'
import type { MinimapEntityDraw } from './MinimapEntityDraw'

function collectUnitPoints(draw: MinimapEntityDraw, owner: PlayerLike) {
  const hero = draw.menu.context.controls.heroUnit
  const villagers: MinimapUnitPoint[] = []
  const troops: MinimapUnitPoint[] = []
  for (const unit of owner.units) {
    if (!draw.details && unit.type !== UNIT_TYPES.villager) continue
    if (unit === hero || getEntitySpaceId(unit) !== draw.space.id || unit.shelterState?.status === 'inside') continue
    const point = draw.geometry.instanceToMinimapPoint(unit, draw.transform)
    if (!point) continue
    const markers = unit.type === UNIT_TYPES.villager ? villagers : troops
    markers.push({ ...point, selected: unit.selected })
  }
  return { villagers, troops }
}

/** Only the local player's own units appear; villagers cluster, troops draw individually. */
export function drawMinimapPlayerUnits(draw: MinimapEntityDraw): void {
  const { player, players } = draw.menu.context
  for (const owner of players) {
    if (owner !== player) continue
    if (isMinimapMarkerHidden(draw.menu.context, 'self')) continue
    const { villagers, troops } = collectUnitPoints(draw, owner)
    for (const cluster of clusterMinimapUnits(villagers, 16 * MINIMAP_RESOLUTION_SCALE)) {
      drawMinimapUnitCluster(draw.context, cluster, owner.colorHex, draw.unitScale)
    }
    for (const point of troops) {
      drawMinimapUnitMarker(draw.context, 'troop', point, owner.colorHex, point.selected, 0, draw.unitScale)
    }
  }
}

export function drawMinimapHero(draw: MinimapEntityDraw): void {
  const { controls, player } = draw.menu.context
  const hero = controls.heroUnit
  if (!hero || isMinimapMarkerHidden(draw.menu.context, 'self') || getEntitySpaceId(hero) !== draw.space.id) return
  const point = draw.geometry.instanceToMinimapPoint(hero, draw.transform)
  if (point)
    drawMinimapUnitMarker(
      draw.context,
      'hero',
      point,
      hero.owner?.colorHex ?? player?.colorHex ?? '#ffffff',
      false,
      hero.degree,
      draw.unitScale
    )
}
