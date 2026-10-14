import { t } from '../../../lib/lang'
import type { MinimapPlace } from '../../../types/minimap'
import type { MinimapHostLike } from '../../../types/context'
import type { MinimapGeometry, MinimapTransform } from '../MinimapGeometry'

/** Everything one minimap entity pass shares: canvas, projection, scales and the hover places it collects. */
export interface MinimapEntityDraw {
  menu: MinimapHostLike
  geometry: MinimapGeometry
  transform: MinimapTransform
  space: ReturnType<MinimapGeometry['getMinimapSpace']>
  context: CanvasRenderingContext2D
  redraw: () => void
  places: MinimapPlace[]
  details: boolean
  markerScale: number
  unitScale: number
}

const PLACE_LABEL_KEYS: Record<string, string> = {
  village: 'settlementVillage',
  city: 'settlementCity',
  outpost: 'settlementOutpost',
  camp: 'minimapLegendCamp',
  cave: 'Cave',
  home: 'minimapPlayerBase',
}

export function minimapPlaceLabel(kind: string): string {
  return t(PLACE_LABEL_KEYS[kind] ?? kind)
}
