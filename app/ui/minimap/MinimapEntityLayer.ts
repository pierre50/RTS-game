import type { MinimapPlace } from '../../types/minimap'
import type { MinimapHostLike } from '../../types/context'
import type { MinimapBuildingKnowledge } from './MinimapBuildingKnowledge'
import type { MinimapGeometry, MinimapTransform } from './MinimapGeometry'
import { getMinimapMarkerScale, getMinimapPlaceScale, showMinimapDetails } from './MinimapZoom'
import {
  drawMinimapBuildings,
  drawMinimapDebugLandmarks,
  drawMinimapKnownSettlements,
} from './entities/MinimapBuildingLayer'
import type { MinimapEntityDraw } from './entities/MinimapEntityDraw'
import { drawMinimapHero, drawMinimapPlayerUnits } from './entities/MinimapUnitLayer'

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
  const draw: MinimapEntityDraw = {
    menu,
    geometry,
    transform,
    space,
    context,
    redraw,
    places,
    details: showMinimapDetails(menu.context),
    markerScale: getMinimapPlaceScale(menu.context),
    unitScale: getMinimapMarkerScale(menu.context),
  }
  if (menu.context.map.revealEverything) drawMinimapDebugLandmarks(draw)
  drawMinimapBuildings(draw)
  drawMinimapKnownSettlements(draw, knownBuildings)
  drawMinimapPlayerUnits(draw)
  drawMinimapHero(draw)
}
