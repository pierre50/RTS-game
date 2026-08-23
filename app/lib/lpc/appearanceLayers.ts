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

export function isAppearanceLayerHiddenByLoading({
  layer,
  isLoading,
  sheet,
  heroControlled,
}: {
  layer: Pick<UnitAppearanceLayerConfig, 'hideWhenLoading' | 'showWhenLoading'>
  isLoading: boolean
  sheet: string
  heroControlled: boolean
}): boolean {
  if (heroControlled) return Boolean(layer.showWhenLoading)
  if (layer.hideWhenLoading && isLoading) return sheet !== SHEET_TYPES.action
  if (!layer.showWhenLoading) return false
  return !isLoading || sheet === SHEET_TYPES.action
}
