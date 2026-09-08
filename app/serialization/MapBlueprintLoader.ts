import type { MapBlueprint, MapSettlement } from '../classes/map/MapGenerationTypes'
import { regionIdFromEntry, selectWorldMap } from './WorldMapBlueprintSelection'

// Must match tools/generate-maps.cjs's TERRAIN encoding order exactly.
const TERRAIN_TYPES = ['Grass', 'Desert', 'Water', 'Jungle', 'DarkForest', 'Dirt', '', 'Snow']

type WorldManifestEntry = {
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

type WorldManifest = {
  format?: string
  macroPreviewPath?: string
  maps?: WorldManifestEntry[]
  regionsHigh?: number
  regionsWide?: number
  settlements?: unknown[]
  worldSeed?: string | number
}

type InteriorBlueprintManifestEntry = {
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

type InteriorBlueprintManifestBlueprint = {
  buildingSize?: number
  exits?: number
  id: string
  kind?: string
  path: string
  seed?: string | number
  size: number
  spawns?: number
}

type InteriorBlueprintManifest = {
  blueprints?: InteriorBlueprintManifestBlueprint[]
  buildingTypes?: InteriorBlueprintManifestBuildingType[]
  interiors?: InteriorBlueprintManifestEntry[]
}

type BlueprintTimings = Partial<
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

type LoadedBlueprint = MapBlueprint & {
  id: string | number
  timings: BlueprintTimings
}

// Owned by a game session: neighboring regions share immutable decoded files.
export type WorldBlueprintFileCache = Map<string, Promise<LoadedBlueprint>>

type LoadWorldBlueprintOptions = {
  size?: number
  playerCiv?: string | null
  worldId: string
  worldRegionId?: string
}

type LoadInteriorBlueprintOptions = {
  buildingSize?: number
  buildingType?: string
  id?: string
  interiorType?: string
  random?: () => number
}

export type MapBlueprintLoadFailureReason =
  | 'manifest-fetch-failed'
  | 'manifest-invalid'
  | 'size-missing'
  | 'blueprint-id-missing'
  | 'no-compatible-map'
  | 'map-fetch-failed'
  | 'map-invalid'

export class MapBlueprintLoadError extends Error {
  reason: MapBlueprintLoadFailureReason

  constructor(reason: MapBlueprintLoadFailureReason, message: string) {
    super(message)
    this.name = 'MapBlueprintLoadError'
    this.reason = reason
  }
}

function fail(reason: MapBlueprintLoadFailureReason, message: string): never {
  throw new MapBlueprintLoadError(reason, message)
}

function decodeBase64Bytes(value: string, ArrayType: Uint8ArrayConstructor): Uint8Array
function decodeBase64Bytes(value: string, ArrayType: Int8ArrayConstructor): Int8Array
function decodeBase64Bytes(
  value: string,
  ArrayType: Uint8ArrayConstructor | Int8ArrayConstructor = Uint8Array
): Uint8Array | Int8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index)
  }
  return ArrayType === Int8Array ? new Int8Array(bytes.buffer) : new Uint8Array(bytes.buffer)
}

function toGrid<TValue extends Uint8Array | Int8Array, TResult>(
  values: TValue,
  size: number,
  mapper: (value: number, i: number, j: number) => TResult
): TResult[][] {
  const grid: TResult[][] = []
  const width = size + 1
  for (let i = 0; i <= size; i++) {
    const row: TResult[] = []
    grid[i] = row
    for (let j = 0; j <= size; j++) {
      row[j] = mapper(values[i * width + j], i, j)
    }
  }
  return grid
}

function normalizeInteriorType(type: string | null | undefined): string {
  return String(type || '').toLowerCase()
}

function normalizeBuildingType(type: string | null | undefined): string {
  return normalizeInteriorType(type)
}

function findInteriorBlueprintById(
  manifest: InteriorBlueprintManifest,
  id: string
): {
  blueprint: InteriorBlueprintManifestBlueprint | InteriorBlueprintManifestEntry
  buildingType?: string
  id?: string
} | null {
  const buildingType = manifest.buildingTypes?.find(entry => entry.id === id || entry.legacyId === id)
  const blueprint = buildingType
    ? manifest.blueprints?.find(entry => entry.id === buildingType.blueprintId)
    : manifest.blueprints?.find(entry => entry.id === id)
  if (blueprint) return { blueprint, buildingType: buildingType?.buildingType, id: buildingType?.id ?? blueprint.id }

  const legacyBlueprint = manifest.interiors?.find(entry => entry.id === id || entry.legacyId === id)
  return legacyBlueprint
    ? { blueprint: legacyBlueprint, buildingType: legacyBlueprint.interiorType, id: legacyBlueprint.id }
    : null
}

function compatibleInteriorEntries(
  manifest: InteriorBlueprintManifest,
  { buildingSize, interiorType }: LoadInteriorBlueprintOptions
): Array<{
  blueprint: InteriorBlueprintManifestBlueprint | InteriorBlueprintManifestEntry
  buildingType?: string
  id?: string
}> {
  const wantedType = normalizeBuildingType(interiorType)
  const mappings =
    manifest.buildingTypes?.filter(entry => {
      return (
        (!buildingSize || entry.buildingSize === buildingSize) &&
        (!wantedType || normalizeBuildingType(entry.buildingType) === wantedType)
      )
    }) ?? []

  const mapped = mappings.flatMap(entry => {
    const blueprint = manifest.blueprints?.find(candidate => candidate.id === entry.blueprintId)
    return blueprint ? [{ blueprint, buildingType: entry.buildingType, id: entry.id }] : []
  })
  if (mapped.length) return mapped

  const sizeBlueprints =
    buildingSize && manifest.blueprints
      ? manifest.blueprints
          .filter(blueprint => blueprint.buildingSize === buildingSize)
          .map(blueprint => ({ blueprint, buildingType: interiorType, id: blueprint.id }))
      : []
  if (sizeBlueprints.length) return sizeBlueprints

  return (manifest.interiors ?? [])
    .filter(entry => {
      return (
        (!buildingSize || entry.buildingSize === buildingSize) &&
        (!wantedType || normalizeBuildingType(entry.interiorType) === wantedType)
      )
    })
    .map(entry => ({ blueprint: entry, buildingType: entry.interiorType, id: entry.id }))
}

function stringOrNumber(value: unknown): string | number | undefined {
  return typeof value === 'string' || typeof value === 'number' ? value : undefined
}

async function decodeMapBlueprintPayload(
  payload: Record<string, unknown>,
  selected: { id?: string; path: string; size: number },
  timings: BlueprintTimings
): Promise<LoadedBlueprint> {
  const size = selected.size
  if (payload.format !== 'map-blueprint' || payload.version !== 1 || payload.size !== size) {
    fail('map-invalid', `Map blueprint "${selected.path}" is invalid`)
  }

  const decodeStartedAt = performance.now()
  const terrainValues = decodeBase64Bytes(String(payload.terrain), Uint8Array)
  const reliefValues = decodeBase64Bytes(String(payload.relief), Int8Array)
  timings.blueprintDecode = performance.now() - decodeStartedAt
  const expectedCells = (size + 1) ** 2
  if (terrainValues.length !== expectedCells || reliefValues.length !== expectedCells) {
    fail('map-invalid', `Map blueprint "${selected.path}" has invalid terrain data`)
  }

  const gridStartedAt = performance.now()
  const terrain = toGrid(terrainValues, size, value => (value === 6 ? 'Water' : TERRAIN_TYPES[value] || 'Grass'))
  const relief = toGrid(reliefValues, size, value => value)
  timings.blueprintGridInflate = performance.now() - gridStartedAt

  const payloadSpawns = Array.isArray(payload.spawns) ? payload.spawns : []
  return {
    id: stringOrNumber(payload.id) ?? selected.id ?? selected.path,
    size,
    mapType: typeof payload.mapType === 'string' ? payload.mapType : 'world-region',
    seed: stringOrNumber(payload.seed),
    terrain,
    relief,
    spawns: payloadSpawns,
    banditCampPositions: Array.isArray(payload.banditCampPositions) ? payload.banditCampPositions : [],
    settlements: Array.isArray(payload.settlements) ? (payload.settlements as MapSettlement[]) : [],
    resources: Array.isArray(payload.resources) ? payload.resources : undefined,
    timings,
  }
}

function loadWorldBlueprintFile(
  worldId: string,
  entry: Pick<WorldManifestEntry, 'id' | 'path' | 'size'>,
  cache: WorldBlueprintFileCache
): Promise<LoadedBlueprint> {
  const path = `maps/worlds/${worldId}/maps/${entry.path}`
  const key = `${path}:${entry.size}`
  const cached = cache.get(key)
  if (cached) return cached
  const promise = (async () => {
    const timings: BlueprintTimings = {}
    const startedAt = performance.now()
    const response = await fetch(path, { cache: 'no-store' })
    if (!response.ok) fail('map-fetch-failed', `Unable to load ${path} (${response.status})`)
    timings.blueprintMapFetch = performance.now() - startedAt
    const parseStartedAt = performance.now()
    const payload = await response.json()
    timings.blueprintMapParse = performance.now() - parseStartedAt
    return decodeMapBlueprintPayload(payload, entry, timings)
  })()
  cache.set(key, promise)
  void promise.catch(() => {
    if (cache.get(key) === promise) cache.delete(key)
  })
  return promise
}

export async function loadPregeneratedWorldMapBlueprint(
  { playerCiv, size = 144, worldId, worldRegionId }: LoadWorldBlueprintOptions,
  fileCache: WorldBlueprintFileCache = new Map()
) {
  const timings: BlueprintTimings = {}
  let manifest: WorldManifest | undefined
  let manifestResponse: Response
  const manifestPath = `maps/worlds/${worldId}/manifest.json`
  try {
    const manifestStartedAt = performance.now()
    manifestResponse = await fetch(manifestPath, { cache: 'no-store' })
    if (!manifestResponse.ok) {
      fail('manifest-fetch-failed', `Unable to load ${manifestPath} (${manifestResponse.status})`)
    }
    timings.blueprintManifestFetch = performance.now() - manifestStartedAt
  } catch (error) {
    if (error instanceof MapBlueprintLoadError) throw error
    fail('manifest-fetch-failed', `Unable to load ${manifestPath}`)
  }
  try {
    const manifestParseStartedAt = performance.now()
    manifest = await manifestResponse.json()
    timings.blueprintManifestParse = performance.now() - manifestParseStartedAt
  } catch (error) {
    if (error instanceof MapBlueprintLoadError) throw error
    fail('manifest-invalid', `${manifestPath} is not valid JSON`)
  }
  if (!Array.isArray(manifest?.maps)) fail('manifest-invalid', `${manifestPath} is invalid`)

  const selected = selectWorldMap(manifest, { playerCiv, size, worldRegionId })
  if (!selected) fail('no-compatible-map', `No world map blueprint matches ${worldId}`)

  try {
    const blueprint = await loadWorldBlueprintFile(worldId, selected, fileCache)
    const visualNeighbors = await Promise.all(
      manifest.maps
        .filter(
          entry =>
            entry.path !== selected.path &&
            entry.size === selected.size &&
            Math.abs(entry.region.x - selected.region.x) <= 1 &&
            Math.abs(entry.region.y - selected.region.y) <= 1
        )
        .map(async entry => {
          return { region: entry.region, blueprint: await loadWorldBlueprintFile(worldId, entry, fileCache) }
        })
    )
    return {
      ...blueprint,
      timings: { ...timings, ...blueprint.timings },
      visualNeighbors,
      environment: selected.environment,
      worldId,
      worldRegionId: selected.id || regionIdFromEntry(selected),
      worldRegion: selected.region,
      worldManifest: {
        macroPreviewPath: manifest.macroPreviewPath,
        maps: manifest.maps.map(map => ({
          id: map.id || regionIdFromEntry(map),
          region: map.region,
          size: map.size,
        })),
        regionsHigh: manifest.regionsHigh,
        regionsWide: manifest.regionsWide,
        settlements: manifest.settlements || [],
        worldSeed: manifest.worldSeed,
      },
    }
  } catch (error) {
    if (error instanceof MapBlueprintLoadError) throw error
    throw new MapBlueprintLoadError('map-invalid', 'Unable to parse pregenerated world map blueprint')
  }
}

export async function loadPregeneratedInteriorBlueprint({
  buildingSize,
  buildingType,
  id,
  interiorType,
  random = Math.random,
}: LoadInteriorBlueprintOptions = {}) {
  const requestedBuildingType = buildingType ?? interiorType
  let manifest: InteriorBlueprintManifest | undefined
  let manifestResponse: Response
  try {
    manifestResponse = await fetch('maps/interiors/manifest.json', { cache: 'no-store' })
    if (!manifestResponse.ok) {
      fail('manifest-fetch-failed', `Unable to load maps/interiors/manifest.json (${manifestResponse.status})`)
    }
  } catch (error) {
    if (error instanceof MapBlueprintLoadError) throw error
    fail('manifest-fetch-failed', 'Unable to load maps/interiors/manifest.json')
  }
  try {
    manifest = await manifestResponse.json()
  } catch (error) {
    if (error instanceof MapBlueprintLoadError) throw error
    fail('manifest-invalid', 'maps/interiors/manifest.json is not valid JSON')
  }
  const hasCompactManifest = Array.isArray(manifest?.blueprints) && Array.isArray(manifest?.buildingTypes)
  const hasLegacyManifest = Array.isArray(manifest?.interiors)
  if (!hasCompactManifest && !hasLegacyManifest) fail('manifest-invalid', 'maps/interiors/manifest.json is invalid')
  if (!manifest) fail('manifest-invalid', 'maps/interiors/manifest.json is invalid')
  const interiorManifest = manifest

  let selected:
    | {
        blueprint: InteriorBlueprintManifestBlueprint | InteriorBlueprintManifestEntry
        buildingType?: string
        id?: string
      }
    | undefined
  if (id) {
    selected = findInteriorBlueprintById(interiorManifest, id) ?? undefined
    if (!selected) {
      fail('blueprint-id-missing', `Interior blueprint "${id}" is not listed in maps/interiors/manifest.json`)
    }
  } else {
    const candidates = compatibleInteriorEntries(interiorManifest, {
      buildingSize,
      interiorType: requestedBuildingType,
    })
    if (!candidates.length)
      fail('no-compatible-map', `No interior blueprint matches ${requestedBuildingType || 'unknown'}`)
    selected = candidates[Math.floor(random() * candidates.length)]
  }
  const selectedBlueprint = selected.blueprint

  try {
    const response = await fetch(`maps/interiors/${selectedBlueprint.path}`, { cache: 'no-store' })
    if (!response.ok)
      fail('map-fetch-failed', `Unable to load maps/interiors/${selectedBlueprint.path} (${response.status})`)
    const payload = await response.json()
    if (payload.format !== 'map-blueprint' || payload.version !== 1 || payload.kind !== 'interior') {
      fail('map-invalid', `Interior blueprint "${selectedBlueprint.path}" is invalid`)
    }

    const size = Number(payload.size)
    const expectedCells = (size + 1) ** 2
    const terrainValues = decodeBase64Bytes(payload.terrain, Uint8Array)
    const reliefValues = decodeBase64Bytes(payload.relief, Int8Array)
    const floorMaskValues =
      typeof payload.floorMask === 'string' ? decodeBase64Bytes(payload.floorMask, Uint8Array) : null
    const borderMaskValues =
      typeof payload.borderMask === 'string' ? decodeBase64Bytes(payload.borderMask, Uint8Array) : null
    if (
      terrainValues.length !== expectedCells ||
      reliefValues.length !== expectedCells ||
      (floorMaskValues && floorMaskValues.length !== expectedCells) ||
      (borderMaskValues && borderMaskValues.length !== expectedCells)
    ) {
      fail('map-invalid', `Interior blueprint "${selectedBlueprint.path}" has invalid terrain data`)
    }

    return {
      id: selected.id || selectedBlueprint.id || payload.id,
      buildingSize: payload.buildingSize ?? selectedBlueprint.buildingSize,
      kind: 'interior',
      interiorType: requestedBuildingType || selected.buildingType || payload.interiorType,
      mapType: 'interior',
      localGridLayout: payload.localGridLayout,
      size,
      seed: payload.seed,
      terrain: toGrid(terrainValues, size, value => (value === 6 ? 'Water' : TERRAIN_TYPES[value] || 'Grass')),
      relief: toGrid(reliefValues, size, value => value),
      spawns: Array.isArray(payload.spawns) ? payload.spawns : [],
      exits: Array.isArray(payload.exits) ? payload.exits : [],
      resources: Array.isArray(payload.resources) ? payload.resources : [],
      floorMask: floorMaskValues ? toGrid(floorMaskValues, size, value => value) : undefined,
      borderMask: borderMaskValues ? toGrid(borderMaskValues, size, value => value) : undefined,
      floorShape: payload.floorShape ?? null,
    }
  } catch (error) {
    if (error instanceof MapBlueprintLoadError) throw error
    throw new MapBlueprintLoadError('map-invalid', 'Unable to parse pregenerated interior blueprint')
  }
}
