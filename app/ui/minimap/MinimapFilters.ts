import type { PlayerLike } from '../../types/player'

import { getMinimapPreferences } from './MinimapPreferences'

export function minimapOwnerKey(owner: Pick<PlayerLike, 'isPlayed' | 'type' | 'factionId' | 'civ' | 'label'>): string {
  if (owner.isPlayed) return 'self'
  if (owner.type === 'Bandits') return 'bandits'
  return owner.factionId ?? owner.civ ?? owner.label
}

export function isMinimapMarkerHidden(context: object, key: string): boolean {
  return getMinimapPreferences(context).hiddenMarkers.includes(key)
}

export function toggleMinimapMarker(context: object, key: string): void {
  const preferences = getMinimapPreferences(context)
  const hidden = preferences.hiddenMarkers
  preferences.hiddenMarkers = hidden.includes(key) ? hidden.filter(entry => entry !== key) : [...hidden, key]
}
