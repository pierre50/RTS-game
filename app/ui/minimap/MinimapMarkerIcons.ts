export type MinimapMarkerKind = 'home' | 'village' | 'cave' | 'camp' | 'hero' | 'exit'

export function minimapMarkerIcon(kind: MinimapMarkerKind): string {
  return `assets/icons/minimap/${kind}.svg`
}
