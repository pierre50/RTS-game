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
