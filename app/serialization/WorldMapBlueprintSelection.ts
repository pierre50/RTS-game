export type WorldMapManifestEntryLike = {
  environment?: string
  id?: string
  path: string
  region: { x: number; y: number }
  settlements?: unknown[]
  size: number
}

export type WorldMapManifestLike = {
  maps?: WorldMapManifestEntryLike[]
}

type SelectWorldMapOptions = {
  playerCiv?: string | null
  size?: number
  worldRegionId?: string
}

export function regionIdFromEntry(entry: Pick<WorldMapManifestEntryLike, 'region'>): string {
  return `r${entry.region.x}-${entry.region.y}`
}

function settlementCiv(settlement: unknown): string | null {
  return typeof settlement === 'object' && settlement !== null && 'civ' in settlement
    ? String((settlement as { civ?: unknown }).civ || '')
    : null
}

function settlementKind(settlement: unknown): string | null {
  return typeof settlement === 'object' && settlement !== null && 'kind' in settlement
    ? String((settlement as { kind?: unknown }).kind || '')
    : null
}

function hasVillageForCivilization(map: WorldMapManifestEntryLike, civilization: string): boolean {
  return (map.settlements || []).some(
    settlement => settlementKind(settlement) === 'village' && settlementCiv(settlement) === civilization
  )
}

function hasVillage(map: WorldMapManifestEntryLike): boolean {
  return (map.settlements || []).some(settlement => settlementKind(settlement) === 'village')
}

export function selectWorldMap(
  manifest: WorldMapManifestLike,
  { playerCiv, size, worldRegionId }: SelectWorldMapOptions
): WorldMapManifestEntryLike | null {
  const maps = (manifest.maps || []).filter(map => map.size === size)
  if (!maps.length) return null
  if (worldRegionId) {
    return maps.find(map => map.id === worldRegionId || regionIdFromEntry(map) === worldRegionId) ?? null
  }
  if (playerCiv) {
    const playerMap = maps.find(map => hasVillageForCivilization(map, playerCiv))
    if (playerMap) return playerMap
  }
  return maps.find(hasVillage) ?? maps[0]
}
