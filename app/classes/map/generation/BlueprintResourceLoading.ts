import type { CellDefinition } from '../MapGenerationTypes'
import { Assets } from 'pixi.js'
import { PASSABLE_RESOURCE_TYPES } from '../../../constants'
import { textureRefToString } from '../../../lib/graphics/textures'
import { beginLoadTrace } from '../../../lib/loadDiagnostics'
import { TERRAIN_TYPES } from '../../../serialization/MapBlueprintDecoding'
import type { GameContextLike } from '../../../types/context'
import type { ResourceEntity } from '../../../types/entities'
import { getPackedCellStore } from '../../cell/PackedCellRegistry'
import { Resource } from '../../Resource'
import { CompactResourceSet } from '../../resources/CompactResourceSet'
import { getTerrainAssets, normalizeResourceTextureRef } from '../../ResourceTexture'
import type { MapBlueprint, MapGenerationContext, MapGenerationMap } from '../MapGenerationTypes'

export function runtimeContext(context: MapGenerationContext): GameContextLike {
  if (!context.app || !context.gamebox || !context.map || !context.scheduler) {
    throw new Error('Map generation requires a runtime context')
  }
  return context as GameContextLike
}

export function gameConfig(): BlueprintGameConfig {
  return Assets.cache.get('config') as BlueprintGameConfig
}

function isTextureRefAsset(assets: ResourceAssets | undefined): assets is ResourceAssetRef {
  return Boolean(assets && typeof assets === 'object' && !Array.isArray(assets) && typeof assets.sheet === 'string')
}

function isTerrainAssetMap(assets: ResourceAssets | undefined): assets is Record<string, ResourceAssetRef[]> {
  return Boolean(assets && typeof assets === 'object' && !Array.isArray(assets) && !isTextureRefAsset(assets))
}

function createResourceFromState(resource: BlueprintResourceState, map: MapGenerationMap): ResourceEntity {
  return Resource.spawn({ ...resource, isNaturalResource: true }, runtimeContext(map.context))
}

export function* loadBlueprintResourceBatches(map: MapGenerationMap, blueprint: MapBlueprint): Generator<number> {
  if (!Array.isArray(blueprint.resources)) {
    map.pregeneratedResourcesLoaded = false
    map.blueprintResourceLoadMs = 0
    return
  }

  const startedAt = performance.now()
  map.resources = new Set()
  map.naturalResourceRespawnSlots = []
  const resourcesConfig = gameConfig().resources
  const packed = !map.context.editor && getPackedCellStore(map.grid)
  const compact = packed
    ? new CompactResourceSet(
        blueprint.resources.length,
        packed.stride,
        `resource:${map.worldId ?? 'local'}:${map.worldRegionId ?? 'outside'}:${map.seed ?? 0}`,
        type => resourcesConfig[type],
        state => createResourceFromState(state, map),
        runtimeContext(map.context)
      )
    : null
  if (compact && packed) {
    map.resources = compact
    packed.resourceAt = index => compact.atCell(index)
  }
  let sliceStartedAt = performance.now()
  const trace = beginLoadTrace('blueprint.resources', {
    total: blueprint.resources.length,
    compact: Boolean(compact),
  })
  const legacyTotals: number[] = []
  let processed = 0
  for (const resource of blueprint.resources) {
    if (++processed % 1024 === 0) {
      if (processed % 16384 === 0)
        trace.progress({ processed, created: map.resources.size, materialized: compact?.materializedCount })
      if (performance.now() - sliceStartedAt >= 8) {
        yield processed
        sliceStartedAt = performance.now()
      }
    }
    const index = resource.i * (packed ? packed.stride : map.size + 1) + resource.j
    const cell = packed ? undefined : map.grid[resource.i]?.[resource.j]
    if (packed) {
      if (
        resource.i < 0 ||
        resource.j < 0 ||
        resource.i >= packed.stride ||
        resource.j >= packed.stride ||
        packed.types[index] === 255 ||
        packed.flags[index] & 1 ||
        packed.extras.get(index)?.has ||
        compact?.hasAtCell(index)
      )
        continue
    } else if (!cell || cell.solid || cell.has) continue
    const terrainType = packed
      ? (packed.extras.get(index)?.type ??
        (packed.types[index] === 6 ? 'Water' : TERRAIN_TYPES[packed.types[index]] || 'Grass'))
      : cell!.type
    const definition = resourcesConfig[resource.type]
    const assets = definition?.assets
    const hasCompatibleTexture =
      resource.textureName ||
      definition?.isAnimated ||
      Array.isArray(assets) ||
      typeof assets === 'string' ||
      isTextureRefAsset(assets) ||
      (isTerrainAssetMap(assets) && Boolean(assets[terrainType]))
    if (!hasCompatibleTexture) continue
    try {
      // Generated minerals and herbs omit their texture. Choose the same asset as
      // the normal factory before packing, preserving the map's random sequence.
      // Blueprint quantities are initial stocks, not partially harvested saves.
      // Older map files omitted each node's rolled capacity.
      let state = {
        ...resource,
        totalQuantity: resource.totalQuantity ?? resource.quantity ?? definition?.totalQuantity ?? 0,
      }
      if (compact && !resource.textureName && !definition?.isAnimated) {
        const assets = getTerrainAssets(definition?.assets, terrainType)
        const texture =
          typeof assets === 'string'
            ? { sheet: assets, frame: 0 }
            : Array.isArray(assets)
              ? map.randomItem(assets)
              : assets
        if (texture) state = { ...state, textureName: textureRefToString(normalizeResourceTextureRef(texture)) }
      }
      if (compact?.canPack(state) && packed) {
        compact.addState({ ...state, isNaturalResource: true })
        legacyTotals.push(resource.totalQuantity ?? definition?.totalQuantity ?? 0)
        if (!PASSABLE_RESOURCE_TYPES.has(resource.type)) packed.flags[resource.i * packed.stride + resource.j] |= 1
      } else map.resources.add(createResourceFromState(state, map))
    } catch (error) {
      console.warn('Skipping invalid blueprint resource', resource, error)
    }
  }
  compact?.sealBlueprintBaseline(legacyTotals)
  trace.end({
    processed,
    created: map.resources.size,
    compact: Boolean(compact),
    materialized: compact?.materializedCount,
    materializedCells: packed ? packed.materializedCount : undefined,
  })
  map.pregeneratedResourcesLoaded = true
  map.blueprintResourceLoadMs = performance.now() - startedAt
  map.context.performance?.record('blueprintResources', map.blueprintResourceLoadMs)
}

type ResourceAssetRef = { sheet: string; frame: number }
type ResourceAssets = string | ResourceAssetRef | ResourceAssetRef[] | Record<string, ResourceAssetRef[]>
type ResourceDefinition = {
  totalQuantity?: number
  totalHitPoints?: number
  isAnimated?: boolean
  category?: string
  assets?: ResourceAssets
}
type BlueprintGameConfig = {
  resources: Record<string, ResourceDefinition>
  cells: Record<string, CellDefinition>
}
type BlueprintResourceState = NonNullable<MapBlueprint['resources']>[number]
