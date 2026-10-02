import { SHEET_TYPES } from '../../constants'
import type { UnitAppearanceLayerConfig } from '../../types/config'

export function getAppearanceLayerZIndex({
  layer,
  sheet,
}: {
  layer: Pick<UnitAppearanceLayerConfig, 'zIndex' | 'deathZIndex'>
  sheet: string
}): number {
  if ((sheet === SHEET_TYPES.dying || sheet === SHEET_TYPES.corpse) && typeof layer.deathZIndex === 'number') {
    return layer.deathZIndex
  }
  return layer.zIndex
}
