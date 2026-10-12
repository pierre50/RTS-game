/** Last observed building state, independent of the current live entity. */
export type MinimapBuildingMemory = {
  id: string
  spaceId: string
  x: number
  y: number
  i: number
  j: number
  size: number
  color: string
  ownerKey: string
  settlementId?: string
  settlementKind?: 'village' | 'city' | 'outpost'
  town: boolean
}

export type MinimapPreferences = {
  zoom: number
  hiddenMarkers: string[]
}

/** Only locations actually painted on the map can be inspected. */
export type MinimapPlace = { x: number; y: number; name: string; description: string }
