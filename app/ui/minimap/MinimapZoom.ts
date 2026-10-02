const LEVELS = [1, 1.5, 2, 3, 4] as const
import { getMinimapPreferences } from './MinimapPreferences'

export function getMinimapZoom(context: object): number {
  return getMinimapPreferences(context).zoom
}

export function changeMinimapZoom(context: object, direction: -1 | 1): number {
  const index = LEVELS.findIndex(level => level === getMinimapZoom(context))
  const zoom = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, index + direction))]!
  getMinimapPreferences(context).zoom = zoom
  return zoom
}

/** Smaller overview markers, with a gentle increase up to their full size at maximum zoom. */
export function getMinimapMarkerScale(context: object): number {
  return Math.sqrt(getMinimapZoom(context) / LEVELS[LEVELS.length - 1]!)
}

/** Place icons grow from 8px in overview to 17px at maximum zoom. */
export function getMinimapPlaceScale(context: object): number {
  return 0.8 + 0.3 * (getMinimapZoom(context) - 1)
}

/** Overview at 100–200%; personal units, buildings and resources from 300%. */
export function showMinimapDetails(context: object): boolean {
  return getMinimapZoom(context) >= 3
}
