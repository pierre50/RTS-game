import { DEFAULT_ENVIRONMENT_ID } from '../constants'

const TERRAIN_TYPES = ['Grass', 'Desert', 'Water', 'Jungle', 'DarkForest', 'DeepWater']

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
  try {
    const manifestStartedAt = performance.now()
    const response = await fetch('maps/manifest.json', { cache: 'no-store' })
    if (!response.ok) return null
    timings.blueprintManifestFetch = performance.now() - manifestStartedAt
    const manifestParseStartedAt = performance.now()
    manifest = await response.json()
    timings.blueprintManifestParse = performance.now() - manifestParseStartedAt
  } catch {
    return null
  }
  if (size == null) return null

  let selected: BlueprintManifestEntry | undefined
  if (id) {
    selected = (manifest?.maps || []).find(map => map.id === id && !map.mapType)
    if (!selected) return null
  } else {
    const candidates = compatibleMaps(manifest, { size, positionsCount, environment })
    if (!candidates.length) return null
    selected = candidates[Math.floor(random() * candidates.length)]
  }
  try {
    const mapFetchStartedAt = performance.now()
    const response = await fetch(`maps/${selected.path}`, { cache: 'no-store' })
    if (!response.ok) return null
    timings.blueprintMapFetch = performance.now() - mapFetchStartedAt
    const mapParseStartedAt = performance.now()
    const payload = await response.json()
    timings.blueprintMapParse = performance.now() - mapParseStartedAt
    if (payload.format !== 'map-blueprint' || payload.version !== 1 || payload.size !== size) return null

    const decodeStartedAt = performance.now()
    const terrainValues = decodeBase64Bytes(payload.terrain, Uint8Array)
    const reliefValues = decodeBase64Bytes(payload.relief, Int8Array)
    timings.blueprintDecode = performance.now() - decodeStartedAt
    const expectedCells = (size + 1) ** 2
    if (terrainValues.length !== expectedCells || reliefValues.length !== expectedCells) return null

    const gridStartedAt = performance.now()
    const terrain = toGrid(terrainValues, size, value => TERRAIN_TYPES[value] || 'Grass')
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
    console.warn('Unable to load pregenerated map blueprint', error)
    return null
  }
}
