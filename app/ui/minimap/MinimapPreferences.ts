import type { MinimapPreferences } from '../../types/minimap'

const standalonePreferences = new WeakMap<object, MinimapPreferences>()

export function getMinimapPreferences(context: object): MinimapPreferences {
  const player = (context as { player?: { minimapPreferences?: MinimapPreferences } }).player
  if (player) return (player.minimapPreferences ??= { zoom: 1, hiddenMarkers: [] })
  let preferences = standalonePreferences.get(context)
  if (!preferences) {
    preferences = { zoom: 1, hiddenMarkers: [] }
    standalonePreferences.set(context, preferences)
  }
  return preferences
}
