import type { MapBlueprint } from '../classes/map/MapGenerationTypes'
import { definedProperties } from '../lib/definedProperties'
import { decodeBase64Bytes, TERRAIN_TYPES, toGrid } from './MapBlueprintDecoding'
import { fail, MapBlueprintLoadError } from './MapBlueprintErrors'
import type {
  InteriorBlueprintManifest,
  InteriorBlueprintManifestBlueprint,
  InteriorBlueprintManifestEntry,
  LoadInteriorBlueprintOptions,
} from './MapBlueprintTypes'
type InteriorBlueprintPayload = Partial<
  Omit<MapBlueprint, 'size' | 'terrain' | 'relief' | 'floorMask' | 'borderMask'>
> & {
  id?: string | number
  size?: string | number
  terrain?: string
  relief?: string
  floorMask?: string
  borderMask?: string
}
type SelectedInterior = {
  blueprint: InteriorBlueprintManifestBlueprint | InteriorBlueprintManifestEntry
  buildingType?: string
  id?: string
}

function normalizeInteriorType(type: string | null | undefined): string {
  return String(type || '').toLowerCase()
}

function normalizeBuildingType(type: string | null | undefined): string {
  return normalizeInteriorType(type)
}

function findInteriorBlueprintById(manifest: InteriorBlueprintManifest, id: string): SelectedInterior | null {
  const buildingType = manifest.buildingTypes?.find(entry => entry.id === id || entry.legacyId === id)
  const blueprint = buildingType
    ? manifest.blueprints?.find(entry => entry.id === buildingType.blueprintId)
    : manifest.blueprints?.find(entry => entry.id === id)
  if (blueprint)
    return definedProperties({
      blueprint,
      buildingType: buildingType?.buildingType,
      id: buildingType?.id ?? blueprint.id,
    })

  const legacyBlueprint = manifest.interiors?.find(entry => entry.id === id || entry.legacyId === id)
  return legacyBlueprint
    ? definedProperties({
        blueprint: legacyBlueprint,
        buildingType: legacyBlueprint.interiorType,
        id: legacyBlueprint.id,
      })
    : null
}

function compatibleInteriorEntries(
  manifest: InteriorBlueprintManifest,
  { buildingSize, interiorType }: LoadInteriorBlueprintOptions
): SelectedInterior[] {
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
    return blueprint ? [definedProperties({ blueprint, buildingType: entry.buildingType, id: entry.id })] : []
  })
  if (mapped.length) return mapped

  const sizeBlueprints =
    buildingSize && manifest.blueprints
      ? manifest.blueprints
          .filter(blueprint => blueprint.buildingSize === buildingSize)
          .map(blueprint => definedProperties({ blueprint, buildingType: interiorType, id: blueprint.id }))
      : []
  if (sizeBlueprints.length) return sizeBlueprints

  return (manifest.interiors ?? [])
    .filter(entry => {
      return (
        (!buildingSize || entry.buildingSize === buildingSize) &&
        (!wantedType || normalizeBuildingType(entry.interiorType) === wantedType)
      )
    })
    .map(entry => definedProperties({ blueprint: entry, buildingType: entry.interiorType, id: entry.id }))
}

export async function loadPregeneratedInteriorBlueprint({
  buildingSize,
  buildingType,
  id,
  interiorType,
  random = Math.random,
}: LoadInteriorBlueprintOptions = {}) {
  const requestedBuildingType = buildingType ?? interiorType
  const interiorManifest = await loadInteriorManifest()

  let selected: SelectedInterior | undefined
  if (id) {
    selected = findInteriorBlueprintById(interiorManifest, id) ?? undefined
    if (!selected) {
      fail('blueprint-id-missing', `Interior blueprint "${id}" is not listed in maps/interiors/manifest.json`)
    }
  } else {
    const candidates = compatibleInteriorEntries(
      interiorManifest,
      definedProperties({
        buildingSize,
        interiorType: requestedBuildingType,
      })
    )
    if (!candidates.length)
      fail('no-compatible-map', `No interior blueprint matches ${requestedBuildingType || 'unknown'}`)
    selected = candidates[Math.floor(random() * candidates.length)]
  }
  if (!selected) fail('no-compatible-map', 'No interior blueprint could be selected')
  const selectedBlueprint = selected.blueprint

  try {
    const response = await fetch(`maps/interiors/${selectedBlueprint.path}`, { cache: 'no-store' })
    if (!response.ok)
      fail('map-fetch-failed', `Unable to load maps/interiors/${selectedBlueprint.path} (${response.status})`)
    const payload = await response.json()
    if (payload.format !== 'map-blueprint' || payload.version !== 1 || payload.kind !== 'interior') {
      fail('map-invalid', `Interior blueprint "${selectedBlueprint.path}" is invalid`)
    }

    return decodeInteriorPayload(payload, selected, requestedBuildingType)
  } catch (error) {
    if (error instanceof MapBlueprintLoadError) throw error
    throw new MapBlueprintLoadError('map-invalid', 'Unable to parse pregenerated interior blueprint')
  }
}

async function loadInteriorManifest(): Promise<InteriorBlueprintManifest> {
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
  return manifest
}

export function decodeInteriorPayload(
  payload: InteriorBlueprintPayload,
  selected: SelectedInterior,
  requestedBuildingType?: string
) {
  const selectedBlueprint = selected.blueprint
  const { size, terrainValues, reliefValues, floorMaskValues, borderMaskValues } = decodeInteriorGrids(payload)

  return definedProperties({
    id: selected.id || selectedBlueprint.id || payload.id || selectedBlueprint.path,
    buildingSize: payload.buildingSize ?? selectedBlueprint.buildingSize,
    kind: 'interior',
    interiorType: requestedBuildingType || selected.buildingType || payload.interiorType,
    mapType: 'interior',
    localGridLayout: payload.localGridLayout,
    preserveLegacyGrid: payload.preserveLegacyGrid,
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
  })
}

function decodeInteriorLayer(
  value: unknown,
  expectedCells: number,
  ArrayType: Uint8ArrayConstructor | Int8ArrayConstructor
): Uint8Array | Int8Array {
  if (typeof value !== 'string') fail('map-invalid', 'Interior blueprint layer is missing')
  const values = ArrayType === Int8Array ? decodeBase64Bytes(value, Int8Array) : decodeBase64Bytes(value, Uint8Array)
  if (values.length !== expectedCells) fail('map-invalid', 'Interior blueprint has invalid terrain data')
  return values
}

function decodeInteriorGrids(payload: InteriorBlueprintPayload) {
  const size = Number(payload.size)
  if (!Number.isSafeInteger(size) || size < 0) fail('map-invalid', 'Interior blueprint size is invalid')
  const expectedCells = (size + 1) ** 2
  const terrainValues = decodeInteriorLayer(payload.terrain, expectedCells, Uint8Array)
  const reliefValues = decodeInteriorLayer(payload.relief, expectedCells, Int8Array)
  const floorMaskValues =
    typeof payload.floorMask === 'string' ? decodeInteriorLayer(payload.floorMask, expectedCells, Uint8Array) : null
  const borderMaskValues =
    typeof payload.borderMask === 'string' ? decodeInteriorLayer(payload.borderMask, expectedCells, Uint8Array) : null

  return { size, terrainValues, reliefValues, floorMaskValues, borderMaskValues }
}
