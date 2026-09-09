export type MacroWorldRegion = { x: number; y: number }
export type MacroWorldSettlement = {
  id?: string
  kind?: string
  civ?: string
  factionId?: string | null
  playerIndex?: number
  strength?: number
  world?: { i?: number; j?: number }
  region?: MacroWorldRegion
  local?: { i?: number; j?: number }
}
export type MacroWorldManifest = {
  macroPreviewPath?: string
  regionMapSize?: number
  regionsHigh?: number
  regionsWide?: number
  settlements?: MacroWorldSettlement[]
  maps?: Array<{
    id?: string
    dominantBiome?: string
    environment?: string
    region: MacroWorldRegion
    size: number
    settlements?: MacroWorldSettlement[]
  }>
}
