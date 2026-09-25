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
  town: boolean
}

export type MinimapPreferences = {
  zoom: number
  hiddenMarkers: string[]
}
