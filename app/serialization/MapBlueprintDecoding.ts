import { decodePreparedTerrain } from './PreparedTerrainCodec'
import { createLocalMapLayout } from '../lib/localMapLayout'
import type { MapBlueprint, MapSettlement } from '../classes/map/MapGenerationTypes'
import { definedProperties } from '../lib/definedProperties'
import { fail } from './MapBlueprintErrors'
import type { BlueprintTimings, LoadedBlueprint } from './MapBlueprintTypes'
export const TERRAIN_TYPES = ['Grass', 'Desert', 'Water', 'Jungle', 'DarkForest', 'Dirt', '', 'Snow']
export function decodeBase64Bytes(value: string, ArrayType: Uint8ArrayConstructor): Uint8Array
export function decodeBase64Bytes(value: string, ArrayType: Int8ArrayConstructor): Int8Array
export function decodeBase64Bytes(
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

export function toGrid<TValue extends Uint8Array | Int8Array, TResult>(
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
      const value = values[i * width + j]
      if (value === undefined) fail('map-invalid', 'Blueprint grid is truncated')
      row[j] = mapper(value, i, j)
    }
  }
  return grid
}

function stringOrNumber(value: unknown): string | number | undefined {
  return typeof value === 'string' || typeof value === 'number' ? value : undefined
}

export async function decodeMapBlueprintPayload(
  payload: Record<string, unknown>,
  selected: { id?: string; path: string; size: number },
  timings: BlueprintTimings
): Promise<LoadedBlueprint> {
  const scenery = payload.format === 'map-scenery'
  const finalized = payload.version === 2
  const sourceSize = selected.size
  const expectedLayout = createLocalMapLayout(sourceSize)
  const expectedSize = expectedLayout.columns - 1 + Math.ceil((expectedLayout.rows - 1) / 2)
  const size = finalized ? expectedSize : sourceSize
  const layout = payload.localGridLayout as { columns?: number; rows?: number } | undefined
  if (
    finalized &&
    (payload.sourceSize !== sourceSize ||
      layout?.columns !== expectedLayout.columns ||
      layout?.rows !== expectedLayout.rows)
  ) {
    fail('map-invalid', `Map blueprint "${selected.path}" has invalid local layout`)
  }
  if (
    (!scenery && payload.format !== 'map-blueprint') ||
    (!finalized && payload.version !== 1) ||
    payload.size !== size
  ) {
    fail('map-invalid', `Map blueprint "${selected.path}" is invalid`)
  }

  let terrain: string[][]
  let relief: number[][]
  if (scenery) {
    if (!finalized || typeof payload.sceneryCells !== 'string') fail('map-invalid', 'Invalid scenery cells')
    const bytes = decodeBase64Bytes(payload.sceneryCells, Uint8Array)
    if (bytes.length % 6 !== 0) fail('map-invalid', 'Truncated scenery cells')
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    terrain = Array.from({ length: size + 1 }, () => [])
    relief = Array.from({ length: size + 1 }, () => [])
    for (let offset = 0; offset < bytes.length; offset += 6) {
      const index = view.getUint32(offset, true)
      const i = Math.floor(index / (size + 1)),
        j = index % (size + 1)
      const type = view.getUint8(offset + 4),
        z = view.getInt8(offset + 5)
      if (i > size || !TERRAIN_TYPES[type]) fail('map-invalid', 'Invalid scenery coordinates')
      terrain[i][j] = TERRAIN_TYPES[type]
      relief[i][j] = z
    }
  } else {
    const decodeStartedAt = performance.now()
    const terrainValues = decodeBase64Bytes(String(payload.terrain), Uint8Array)
    const reliefValues = decodeBase64Bytes(String(payload.relief), Int8Array)
    timings.blueprintDecode = performance.now() - decodeStartedAt
    const expectedCells = (size + 1) ** 2
    if (terrainValues.length !== expectedCells || reliefValues.length !== expectedCells) {
      fail('map-invalid', `Map blueprint "${selected.path}" has invalid terrain data`)
    }

    const gridStartedAt = performance.now()
    terrain = toGrid(terrainValues, size, value => (value === 6 ? 'Water' : TERRAIN_TYPES[value] || 'Grass'))
    relief = toGrid(reliefValues, size, value => value)
    if (finalized) {
      for (let i = 0; i <= size; i++)
        for (let j = 0; j <= size; j++) {
          if (terrainValues[i * (size + 1) + j] !== 255) continue
          delete terrain[i][j]
          delete relief[i][j]
        }
    }
    timings.blueprintGridInflate = performance.now() - gridStartedAt
  }

  const payloadSpawns = Array.isArray(payload.spawns) ? payload.spawns : []
  return definedProperties({
    id: stringOrNumber(payload.id) ?? selected.id ?? selected.path,
    size,
    localGridLayout: finalized ? expectedLayout : undefined,
    mapType: typeof payload.mapType === 'string' ? payload.mapType : 'world-region',
    seed: stringOrNumber(payload.seed),
    terrain,
    relief,
    spawns: payloadSpawns,
    animals: Array.isArray(payload.animals) ? (payload.animals as MapBlueprint['animals']) : undefined,
    terrainAppearance:
      typeof payload.terrainAppearanceData === 'string'
        ? decodePreparedTerrain(decodeBase64Bytes(payload.terrainAppearanceData, Uint8Array), size)
        : Array.isArray(payload.terrainAppearance)
          ? (payload.terrainAppearance as MapBlueprint['terrainAppearance'])
          : undefined,
    banditCampPositions: Array.isArray(payload.banditCampPositions) ? payload.banditCampPositions : [],
    settlements: Array.isArray(payload.settlements) ? (payload.settlements as MapSettlement[]) : [],
    resources: Array.isArray(payload.resources) ? payload.resources : undefined,
    timings,
  })
}
