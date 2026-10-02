import type { PlayerLike } from '../../types/player'

export type MinimapMarkerKind = 'home' | 'village' | 'city' | 'outpost' | 'cave' | 'camp' | 'hero' | 'exit'

export function settlementMarkerKind(owner: Pick<PlayerLike, 'settlementType'>): MinimapMarkerKind {
  return owner.settlementType === 'city' ? 'city' : owner.settlementType === 'outpost' ? 'outpost' : 'village'
}

export function minimapMarkerIcon(kind: MinimapMarkerKind): string {
  return `assets/icons/minimap/${kind}.svg`
}
