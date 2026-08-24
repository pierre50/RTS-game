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

export function getAppearanceAgeSheetOverride(
  overrides: UnitAppearanceLayerConfig['ageSheetOverrides'] | undefined,
  ownerAge: number,
  sheet: string
): string | undefined {
  if (!overrides) return undefined
  const exact = overrides[String(ownerAge)]?.[sheet]
  if (exact) return exact
  const fallbackAge = Object.keys(overrides)
    .map(Number)
    .filter(age => age <= ownerAge)
    .sort((a, b) => b - a)[0]
  return fallbackAge == null ? undefined : overrides[String(fallbackAge)]?.[sheet]
}
