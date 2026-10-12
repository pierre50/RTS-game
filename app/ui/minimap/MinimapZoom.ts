const LEVELS = [1, 1.5, 2, 3, 4] as const
import { getMinimapPreferences } from './MinimapPreferences'

export function getMinimapZoom(context: object): number {
  return getMinimapPreferences(context).zoom
}

export function changeMinimapZoom(context: object, direction: -1 | 1): number {
  const current = getMinimapZoom(context)
  const zoom =
    direction > 0
      ? (LEVELS.find(level => level > current) ?? 4)
      : ([...LEVELS].reverse().find(level => level < current) ?? 1)
  return setMinimapZoom(context, zoom)
}

export function setMinimapZoom(context: object, zoom: number): number {
  const value = Math.max(1, Math.min(4, zoom))
  getMinimapPreferences(context).zoom = value
  return value
}

/** Smaller overview markers, with a gentle increase up to their full size at maximum zoom. */
export function getMinimapMarkerScale(context: object): number {
  return Math.sqrt(getMinimapZoom(context) / LEVELS[LEVELS.length - 1]!)
}

/** Place icons grow from 8px in overview to 17px at maximum zoom. */
export function getMinimapPlaceScale(context: object): number {
  return 0.8 + 0.3 * (getMinimapZoom(context) - 1)
}

/** Additional troop and resource details from 300%; villagers and buildings remain visible at every zoom. */
export function showMinimapDetails(context: object): boolean {
  return getMinimapZoom(context) >= 3
}
