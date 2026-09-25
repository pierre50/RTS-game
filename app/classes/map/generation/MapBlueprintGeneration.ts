import { CompactResourceSet } from '../../resources/CompactResourceSet'
import { getPackedCellStore } from '../../cell/PackedCellRegistry'
import { PASSABLE_RESOURCE_TYPES } from '../../../constants'
import { PackedCellStore } from '../../cell/PackedCellStore'
import { TERRAIN_TYPES } from '../../../serialization/MapBlueprintDecoding'
import { beginLoadTrace } from '../../../lib/loadDiagnostics'
import { addInteriorWalls } from '../../../lib/graphics/interiorWalls'
import { registerPreparedMapContent, applyPreparedTerrain } from './PreparedMapContent'
import { Assets } from 'pixi.js'
import { Resource } from '../../Resource'
import { getTerrainAssets, normalizeResourceTextureRef } from '../../ResourceTexture'
import { textureRefToString } from '../../../lib/graphics/textures'
import { Cell, GenerationCell } from '../../cell'
import { createDeterministicCellVariantPicker } from '../../../lib'
import { createSquareLocalBlueprint } from './LocalMapBlueprint'
import type { RuntimeCell } from '../../../types/map'
import type { ResourceEntity } from '../../../types/entities'
import type { GameContextLike } from '../../../types/context'
import type { CellDefinition, MapBlueprint, MapGenerationContext, MapGenerationMap } from '../MapGenerationTypes'

type ProgressCallback = (stage: string, progress: number) => Promise<void> | void
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

function runtimeContext(context: MapGenerationContext): GameContextLike {
  if (!context.app || !context.gamebox || !context.map || !context.scheduler) {
    throw new Error('Map generation requires a runtime context')
  }
  return context as GameContextLike
}

function gameConfig(): BlueprintGameConfig {
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

function isInteriorBlueprint(blueprint: MapBlueprint): boolean {
  return blueprint.kind === 'interior' || blueprint.mapType === 'interior'
}

function maskValue(mask: MapBlueprint['floorMask'], i: number, j: number): boolean {
  return mask?.[i]?.[j] === 1
}

function isBlueprintExitCell(blueprint: MapBlueprint, i: number, j: number): boolean {
  return Boolean(blueprint.exits?.some(exit => exit?.i === i && exit?.j === j))
}

export class MapBlueprintGeneration {
  map: MapGenerationMap
  yieldToBrowser: () => Promise<void>
  destroyGeneratedChildren: () => void

  constructor(map: MapGenerationMap, yieldToBrowser: () => Promise<void>, destroyGeneratedChildren: () => void) {
    this.map = map
    this.yieldToBrowser = yieldToBrowser
    this.destroyGeneratedChildren = destroyGeneratedChildren
  }

  async generateFromBlueprint(
    blueprintData: MapBlueprint,
    { onProgress = async (_stage: string, _progress: number) => {} }: { onProgress?: ProgressCallback } = {}
  ): Promise<void> {
    const context = runtimeContext(this.map.context)
    const blueprint = createSquareLocalBlueprint(blueprintData)
    const destroyStartedAt = performance.now()
    this.destroyGeneratedChildren()
    this.map.blueprintDestroyMs = performance.now() - destroyStartedAt
    this.map.context.performance?.record?.('blueprint.destroyGeneratedChildren', this.map.blueprintDestroyMs)
    const metadataStartedAt = performance.now()
    this.applyBlueprintMetadata(blueprint)
    this.map.context.performance?.record?.('blueprint.applyMetadata', performance.now() - metadataStartedAt)

    const startedAt = performance.now()
    const trace = beginLoadTrace('blueprint.createCells', {
      rows: this.map.size + 1,
      gridSlots: (this.map.size + 1) ** 2,
    })
    let createdCells = 0
    try {
      const cellDefinitions = gameConfig().cells
      const pickCellVariant = createDeterministicCellVariantPicker(this.map.seed ?? 0)
      const relief = blueprint.relief ?? []
      const packed =
        blueprint.packedTerrain && !context.editor
          ? new PackedCellStore(
              blueprint.packedTerrain.types.slice(),
              blueprint.packedTerrain.heights.slice(),
              this.map.size + 1,
              context,
              cellDefinitions,
              GenerationCell.prototype
            )
          : null
      if (packed) this.map.grid = packed.createLazyGrid()
      let sliceStartedAt = performance.now()
      for (let i = 0; i <= this.map.size; i++) {
        if (packed) {
          createdCells += packed.indexTerrainRow(i)
        } else {
          const row: RuntimeCell[] = []
          this.map.grid[i] = row
          for (let j = 0; j <= this.map.size; j++) {
            const type = blueprint.terrain[i][j]
            if (type == null) continue
            const definition = cellDefinitions[type] as CellDefinition
            const cell = new GenerationCell(
              {
                i,
                j,
                z: relief[i]?.[j] || 0,
                type: String(type),
                definition,
                textureName: pickCellVariant(definition?.assets, i, j) ?? undefined,
              },
              context
            )
            row[j] = cell
            createdCells++
            if (createdCells % 100000 === 0) trace.progress({ createdCells, row: i })
          }
        }
        if (i % 32 === 0 && performance.now() - sliceStartedAt >= 8) {
          await onProgress('loadingPregeneratedMap', 0.03 + (i / this.map.size) * 0.14)
          await this.yieldToBrowser()
          sliceStartedAt = performance.now()
        }
      }
      this.applyInteriorMasks(blueprint)
      if (isInteriorBlueprint(blueprint)) addInteriorWalls(blueprint, this.map)
      trace.end({
        indexedCells: createdCells,
        createdCells: packed?.materializedCount ?? createdCells,
        materializedCells: packed?.materializedCount ?? createdCells,
        packed: Boolean(packed),
        sparseCellStates: packed?.extras.size ?? 0,
      })
    } catch (error) {
      trace.fail(error)
      throw error
    }
    this.map.blueprintCellCreationMs = performance.now() - startedAt
    this.map.context.performance?.record?.('blueprint.createGenerationCells', this.map.blueprintCellCreationMs)
    this.map.context.performance?.record('blueprintCellCreation', this.map.blueprintCellCreationMs)

    if (isInteriorBlueprint(blueprint)) {
      this.map.blueprintFillWaterGapsMs = 0
      this.map.blueprintNormalizeWaterMs = 0
      this.map.blueprintInitialWaterBorderMs = 0
      this.map.blueprintWaterBorderReady = true
    } else {
      this.map.blueprintFillWaterGapsMs = 0
      this.map.blueprintNormalizeWaterMs = 0
      const waterBorderStartedAt = performance.now()
      if (blueprint.terrainAppearance) applyPreparedTerrain(this.map, blueprint.terrainAppearance, true)
      else this.map.formatCellsWaterBorder()
      this.map.blueprintWaterBorderReady = true
      this.map.blueprintInitialWaterBorderMs = performance.now() - waterBorderStartedAt
      this.map.context.performance?.record?.('blueprint.formatWaterBorder', this.map.blueprintInitialWaterBorderMs)
    }

    const resourcesStartedAt = performance.now()
    for (const processed of this.loadBlueprintResourceBatches(blueprint)) {
      await onProgress('loadingMapResources', 0.17 + (0.08 * processed) / Math.max(1, blueprint.resources?.length ?? 0))
      await this.yieldToBrowser()
    }
    this.map.context.performance?.record?.('blueprint.loadResourcesTotal', performance.now() - resourcesStartedAt)
  }

  generateEditableFromBlueprint(blueprintData: MapBlueprint): void {
    const context = runtimeContext(this.map.context)
    const blueprint = createSquareLocalBlueprint(blueprintData)
    this.destroyGeneratedChildren()
    this.applyBlueprintMetadata(blueprint)

    const relief = blueprint.relief ?? []
    for (let i = 0; i <= this.map.size; i++) {
      const row: RuntimeCell[] = []
      this.map.grid[i] = row
      for (let j = 0; j <= this.map.size; j++) {
        if (blueprint.terrain[i][j] == null) continue
        const cell = new Cell(
          {
            i,
            j,
            z: relief[i]?.[j] || 0,
            type: String(blueprint.terrain[i][j]),
          },
          context
        )
        this.map.addChild(cell)
        row[j] = cell
      }
    }
    this.applyInteriorMasks(blueprint)
    if (isInteriorBlueprint(blueprint)) addInteriorWalls(blueprint, this.map)

    if (isInteriorBlueprint(blueprint)) {
      this.map.blueprintWaterBorderReady = true
    } else {
      if (blueprint.terrainAppearance) applyPreparedTerrain(this.map, blueprint.terrainAppearance, true)
      else this.map.formatCellsWaterBorder()
    }
    this.loadBlueprintResources(blueprint)
  }

  applyBlueprintMetadata(blueprint: MapBlueprint): void {
    registerPreparedMapContent(this.map, blueprint)
    this.map.seed = blueprint.seed
    this.map.size = blueprint.size
    this.map.localGridLayout = blueprint.localGridLayout
    this.map.mapType = isInteriorBlueprint(blueprint) ? 'interior' : (blueprint.mapType ?? 'world-region')
    this.map.playersPos = blueprint.spawns || []
    this.map.interiorExits = blueprint.exits || []
    this.map.banditCampPositions = blueprint.banditCampPositions || []
    this.map.settlements = blueprint.settlements || []
    this.map.worldId = blueprint.worldId ?? null
    this.map.worldRegionId = blueprint.worldRegionId ?? null
    this.map.worldRegion = blueprint.worldRegion ?? null
    this.map.worldManifest = blueprint.worldManifest ?? null
    this.map.positionsCount = this.map.playersPos.length || this.map.positionsCount
    this.map.resetRandom()
    this.map.invalidateReliefCoastDistances()
  }

  applyInteriorMasks(blueprint: MapBlueprint): void {
    if (!isInteriorBlueprint(blueprint) || !blueprint.floorMask) return

    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i]?.[j]
        if (!cell) continue
        const isFloor = maskValue(blueprint.floorMask, i, j)
        const isBorder = maskValue(blueprint.borderMask, i, j)
        const isExit = isBlueprintExitCell(blueprint, i, j)
        cell.terrainHidden = !isFloor
        cell.border = isBorder && !isExit
        cell.waterBorder = false
        if (!cell.has) cell.solid = !isFloor
        const sprite = 'sprite' in cell ? (cell.sprite as { renderable?: boolean } | null | undefined) : null
        if (sprite) sprite.renderable = isFloor && cell.category !== 'Water'
      }
    }
  }

  loadBlueprintResources(blueprint: MapBlueprint): void {
    for (const processed of this.loadBlueprintResourceBatches(blueprint)) void processed
  }

  private *loadBlueprintResourceBatches(blueprint: MapBlueprint): Generator<number> {
    if (!Array.isArray(blueprint.resources)) {
      this.map.pregeneratedResourcesLoaded = false
      this.map.blueprintResourceLoadMs = 0
      return
    }

    const startedAt = performance.now()
    this.map.resources = new Set()
    this.map.naturalResourceRespawnSlots = []
    const resourcesConfig = gameConfig().resources
    const packed = !this.map.context.editor && getPackedCellStore(this.map.grid)
    const compact = packed
      ? new CompactResourceSet(
          blueprint.resources.length,
          packed.stride,
          `resource:${this.map.worldId ?? 'local'}:${this.map.worldRegionId ?? 'outside'}:${this.map.seed ?? 0}`,
          type => resourcesConfig[type],
          state => createResourceFromState(state, this.map),
          runtimeContext(this.map.context)
        )
      : null
    if (compact && packed) {
      this.map.resources = compact
      packed.resourceAt = index => compact.atCell(index)
    }
    let sliceStartedAt = performance.now()
    const trace = beginLoadTrace('blueprint.resources', {
      total: blueprint.resources.length,
      compact: Boolean(compact),
    })
    let processed = 0
    for (const resource of blueprint.resources) {
      if (++processed % 1024 === 0) {
        if (processed % 16384 === 0)
          trace.progress({ processed, created: this.map.resources.size, materialized: compact?.materializedCount })
        if (performance.now() - sliceStartedAt >= 8) {
          yield processed
          sliceStartedAt = performance.now()
        }
      }
      const index = resource.i * (packed ? packed.stride : this.map.size + 1) + resource.j
      const cell = packed ? undefined : this.map.grid[resource.i]?.[resource.j]
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
        let state = resource
        if (compact && !resource.textureName && !definition?.isAnimated) {
          const assets = getTerrainAssets(definition?.assets, terrainType)
          const texture =
            typeof assets === 'string'
              ? { sheet: assets, frame: 0 }
              : Array.isArray(assets)
                ? this.map.randomItem(assets)
                : assets
          if (texture) state = { ...resource, textureName: textureRefToString(normalizeResourceTextureRef(texture)) }
        }
        if (compact?.canPack(state) && packed) {
          compact.addState({ ...state, isNaturalResource: true })
          if (!PASSABLE_RESOURCE_TYPES.has(resource.type)) packed.flags[resource.i * packed.stride + resource.j] |= 1
        } else this.map.resources.add(createResourceFromState(state, this.map))
      } catch (error) {
        console.warn('Skipping invalid blueprint resource', resource, error)
      }
    }
    compact?.sealBlueprintBaseline()
    trace.end({
      processed,
      created: this.map.resources.size,
      compact: Boolean(compact),
      materialized: compact?.materializedCount,
      materializedCells: packed ? packed.materializedCount : undefined,
    })
    this.map.pregeneratedResourcesLoaded = true
    this.map.blueprintResourceLoadMs = performance.now() - startedAt
    this.map.context.performance?.record('blueprintResources', this.map.blueprintResourceLoadMs)
  }
}
