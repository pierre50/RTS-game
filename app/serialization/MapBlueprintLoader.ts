import { DEFAULT_ENVIRONMENT_ID } from '../constants'

// Must match tools/generate-maps.cjs's TERRAIN encoding order exactly.
const TERRAIN_TYPES = ['Grass', 'Desert', 'Water', 'Jungle', 'DarkForest', 'Dirt', '', 'Snow']

type BlueprintManifestEntry = {
  id?: string
  mapType?: string
  environment?: string
  path: string
  size: number
  spawns: number
}

type BlueprintManifest = {
  maps?: BlueprintManifestEntry[]
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

type LoadBlueprintOptions = {
  positionsCount?: number
  random?: () => number
  size?: number
  id?: string
  environment?: string
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

function compatibleMaps(
  manifest: BlueprintManifest | undefined,
  { size, positionsCount, environment }: LoadBlueprintOptions
) {
  const wantedEnvironment = environment ?? DEFAULT_ENVIRONMENT_ID
  return (manifest?.maps || []).filter(map => {
    return (
      map.size === size &&
      !map.mapType &&
      (map.environment ?? DEFAULT_ENVIRONMENT_ID) === wantedEnvironment &&
      (!positionsCount || map.spawns >= positionsCount)
    )
  })
}

export async function loadPregeneratedMapBlueprint({
  size,
  positionsCount,
  random = Math.random,
  id,
  environment,
}: LoadBlueprintOptions = {}) {
  const timings: BlueprintTimings = {}
  let manifest: BlueprintManifest | undefined
  let manifestResponse: Response
  try {
    const manifestStartedAt = performance.now()
    manifestResponse = await fetch('maps/manifest.json', { cache: 'no-store' })
    if (!manifestResponse.ok) {
      fail('manifest-fetch-failed', `Unable to load maps/manifest.json (${manifestResponse.status})`)
    }
    timings.blueprintManifestFetch = performance.now() - manifestStartedAt
  } catch (error) {
    if (error instanceof MapBlueprintLoadError) throw error
    fail('manifest-fetch-failed', 'Unable to load maps/manifest.json')
  }
  try {
    const manifestParseStartedAt = performance.now()
    manifest = await manifestResponse.json()
    timings.blueprintManifestParse = performance.now() - manifestParseStartedAt
  } catch (error) {
    if (error instanceof MapBlueprintLoadError) throw error
    fail('manifest-invalid', 'maps/manifest.json is not valid JSON')
  }
  if (!Array.isArray(manifest?.maps)) fail('manifest-invalid', 'maps/manifest.json is invalid')
  if (size == null) fail('size-missing', 'Cannot load a map blueprint without a size')

  let selected: BlueprintManifestEntry | undefined
  if (id) {
    selected = (manifest?.maps || []).find(map => map.id === id && !map.mapType)
    if (!selected) fail('blueprint-id-missing', `Map blueprint "${id}" is not listed in maps/manifest.json`)
  } else {
    const candidates = compatibleMaps(manifest, { size, positionsCount, environment })
    if (!candidates.length) fail('no-compatible-map', `No map blueprint matches size ${size}`)
    selected = candidates[Math.floor(random() * candidates.length)]
  }
  try {
    const mapFetchStartedAt = performance.now()
    const response = await fetch(`maps/${selected.path}`, { cache: 'no-store' })
    if (!response.ok) fail('map-fetch-failed', `Unable to load maps/${selected.path} (${response.status})`)
    timings.blueprintMapFetch = performance.now() - mapFetchStartedAt
    const mapParseStartedAt = performance.now()
    const payload = await response.json()
    timings.blueprintMapParse = performance.now() - mapParseStartedAt
    if (payload.format !== 'map-blueprint' || payload.version !== 1 || payload.size !== size) {
      fail('map-invalid', `Map blueprint "${selected.path}" is invalid`)
    }

    const decodeStartedAt = performance.now()
    const terrainValues = decodeBase64Bytes(payload.terrain, Uint8Array)
    const reliefValues = decodeBase64Bytes(payload.relief, Int8Array)
    timings.blueprintDecode = performance.now() - decodeStartedAt
    const expectedCells = (size + 1) ** 2
    if (terrainValues.length !== expectedCells || reliefValues.length !== expectedCells) {
      fail('map-invalid', `Map blueprint "${selected.path}" has invalid terrain data`)
    }

    const gridStartedAt = performance.now()
    const terrain = toGrid(terrainValues, size, value => (value === 6 ? 'Water' : TERRAIN_TYPES[value] || 'Grass'))
    const relief = toGrid(reliefValues, size, value => value)
    timings.blueprintGridInflate = performance.now() - gridStartedAt

    return {
      id: payload.id || selected.id,
      size,
      mapType: 'continent',
      seed: payload.seed,
      terrain,
      relief,
      spawns: (payload.spawns || []).slice(0, positionsCount || payload.spawns?.length || 0),
      resources: Array.isArray(payload.resources) ? payload.resources : null,
      timings,
    }
  } catch (error) {
    if (error instanceof MapBlueprintLoadError) throw error
    throw new MapBlueprintLoadError('map-invalid', 'Unable to parse pregenerated map blueprint')
  }
}
