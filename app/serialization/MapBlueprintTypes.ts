import type { MapBlueprint } from '../classes/map/MapGenerationTypes'
export type WorldManifestEntry = {
  sceneryPath?: string
  dominantBiome?: string
  environment?: string
  id?: string
  mapType?: string
  path: string
  region: { x: number; y: number }
  settlements?: unknown[]
  size: number
  spawns: number
  waterRatio?: number
}

export type WorldManifest = {
  format?: string
  macroPreviewPath?: string
  maps?: WorldManifestEntry[]
  regionsHigh?: number
  regionsWide?: number
  settlements?: unknown[]
  worldSeed?: string | number
}

export type InteriorBlueprintManifestEntry = {
  buildingSize?: number
  buildingType?: string
  exits?: number
  id?: string
  interiorType?: string
  kind?: string
  legacyId?: string
  path: string
  size: number
  spawns?: number
}

type InteriorBlueprintManifestBuildingType = {
  blueprintId: string
  buildingSize?: number
  buildingType?: string
  id?: string
  legacyId?: string
}

export type InteriorBlueprintManifestBlueprint = {
  buildingSize?: number
  exits?: number
  id: string
  kind?: string
  path: string
  seed?: string | number
  size: number
  spawns?: number
}

export type InteriorBlueprintManifest = {
  blueprints?: InteriorBlueprintManifestBlueprint[]
  buildingTypes?: InteriorBlueprintManifestBuildingType[]
  interiors?: InteriorBlueprintManifestEntry[]
}

export type BlueprintTimings = Partial<
  Record<
    | 'blueprintManifestFetch'
    | 'blueprintManifestParse'
    | 'blueprintMapFetch'
    | 'blueprintMapParse'
    | 'blueprintDecode'
    | 'blueprintGridInflate',
    number
  >
>

export type LoadedBlueprint = MapBlueprint & {
  id: string | number
  timings: BlueprintTimings
}

// Owned by a game session: neighboring regions share immutable decoded files.
export type WorldBlueprintFileCache = Map<string, Promise<LoadedBlueprint>>

export type LoadWorldBlueprintOptions = {
  size?: number
  playerCiv?: string | null
  worldId: string
  worldRegionId?: string
}

export type LoadInteriorBlueprintOptions = {
  buildingSize?: number
  buildingType?: string
  id?: string
  interiorType?: string
  random?: () => number
}
