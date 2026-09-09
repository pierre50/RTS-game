import { definedProperties } from '../lib/definedProperties'
import { decodeMapBlueprintPayload } from './MapBlueprintDecoding'
import { fail, MapBlueprintLoadError } from './MapBlueprintErrors'
import type {
  BlueprintTimings,
  LoadedBlueprint,
  LoadWorldBlueprintOptions,
  WorldBlueprintFileCache,
  WorldManifest,
  WorldManifestEntry,
} from './MapBlueprintTypes'
import { regionIdFromEntry, selectWorldMap } from './WorldMapBlueprintSelection'
export { loadPregeneratedInteriorBlueprint } from './InteriorBlueprintLoader'
export { MapBlueprintLoadError } from './MapBlueprintErrors'
export type { WorldBlueprintFileCache } from './MapBlueprintTypes'
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

  const selected = selectWorldMap(manifest, definedProperties({ playerCiv, size, worldRegionId }))
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
          return definedProperties({
            region: entry.region,
            blueprint: await loadWorldBlueprintFile(
              worldId,
              { ...entry, path: entry.sceneryPath ?? entry.path },
              fileCache
            ),
          })
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
