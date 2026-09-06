import { Assets } from 'pixi.js'
import { Resource } from '../../Resource'
import { Cell, GenerationCell } from '../../cell'
import { createDeterministicCellVariantPicker } from '../../../lib'
import type { RuntimeCell } from '../../../types/map'
import type { ResourceEntity } from '../../../types/entities'
import type { GameContextLike } from '../../../types/context'
import type { CellDefinition, MapBlueprint, MapGenerationContext, MapGenerationMap } from '../MapGenerationTypes'

type ProgressCallback = (stage: string, progress: number) => Promise<void> | void
type ResourceAssetRef = { sheet: string; frame?: number }
type ResourceAssets = string | ResourceAssetRef | ResourceAssetRef[] | Record<string, ResourceAssetRef[]>
type ResourceDefinition = {
  category?: string
  assets?: ResourceAssets
  isAnimated?: boolean
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
  return map.addChild(new Resource({ ...resource, isNaturalResource: true }, runtimeContext(map.context)))
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
    const blueprint = blueprintData
    const destroyStartedAt = performance.now()
    this.destroyGeneratedChildren()
    this.map.blueprintDestroyMs = performance.now() - destroyStartedAt
    this.map.context.performance?.record?.('blueprint.destroyGeneratedChildren', this.map.blueprintDestroyMs)
    const metadataStartedAt = performance.now()
    this.applyBlueprintMetadata(blueprint)
    this.map.context.performance?.record?.('blueprint.applyMetadata', performance.now() - metadataStartedAt)

    const startedAt = performance.now()
    const cellDefinitions = gameConfig().cells
    const pickCellVariant = createDeterministicCellVariantPicker(this.map.seed ?? 0)
    const relief = blueprint.relief ?? []
    for (let i = 0; i <= this.map.size; i++) {
      const row: RuntimeCell[] = []
      this.map.grid[i] = row
      for (let j = 0; j <= this.map.size; j++) {
        const type = blueprint.terrain[i][j]
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
      }
      if (i % 32 === 0) {
        await onProgress('loadingPregeneratedMap', 0.03 + (i / this.map.size) * 0.14)
        await this.yieldToBrowser()
      }
    }
    this.applyInteriorMasks(blueprint)
    this.map.blueprintCellCreationMs = performance.now() - startedAt
    this.map.context.performance?.record?.('blueprint.createGenerationCells', this.map.blueprintCellCreationMs)
    this.map.context.performance?.record('blueprintCellCreation', this.map.blueprintCellCreationMs)

    if (isInteriorBlueprint(blueprint)) {
      this.map.blueprintFillWaterGapsMs = 0
      this.map.blueprintNormalizeWaterMs = 0
      this.map.blueprintInitialWaterBorderMs = 0
      this.map.blueprintWaterBorderReady = true
    } else {
      const fillWaterStartedAt = performance.now()
      this.map.fillWaterGaps()
      this.map.blueprintFillWaterGapsMs = performance.now() - fillWaterStartedAt
      this.map.context.performance?.record?.('blueprint.fillWaterGaps', this.map.blueprintFillWaterGapsMs)
      await this.yieldToBrowser()
      const normalizeWaterStartedAt = performance.now()
      this.map.normalizeWaterTopology()
      this.map.blueprintNormalizeWaterMs = performance.now() - normalizeWaterStartedAt
      this.map.context.performance?.record?.('blueprint.normalizeWaterTopology', this.map.blueprintNormalizeWaterMs)
      await this.yieldToBrowser()
      const waterBorderStartedAt = performance.now()
      this.map.formatCellsWaterBorder()
      this.map.blueprintWaterBorderReady = true
      this.map.blueprintInitialWaterBorderMs = performance.now() - waterBorderStartedAt
      this.map.context.performance?.record?.('blueprint.formatWaterBorder', this.map.blueprintInitialWaterBorderMs)
    }

    const resourcesStartedAt = performance.now()
    this.loadBlueprintResources(blueprint)
    this.map.context.performance?.record?.('blueprint.loadResourcesTotal', performance.now() - resourcesStartedAt)
  }

  generateEditableFromBlueprint(blueprintData: MapBlueprint): void {
    const context = runtimeContext(this.map.context)
    const blueprint = blueprintData
    this.destroyGeneratedChildren()
    this.applyBlueprintMetadata(blueprint)

    const relief = blueprint.relief ?? []
    for (let i = 0; i <= this.map.size; i++) {
      const row: RuntimeCell[] = []
      this.map.grid[i] = row
      for (let j = 0; j <= this.map.size; j++) {
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

    if (isInteriorBlueprint(blueprint)) {
      this.map.blueprintWaterBorderReady = true
    } else {
      this.map.fillWaterGaps()
      this.map.normalizeWaterTopology()
      this.map.formatCellsWaterBorder()
    }
    this.loadBlueprintResources(blueprint)
  }

  applyBlueprintMetadata(blueprint: MapBlueprint): void {
    this.map.seed = blueprint.seed
    this.map.size = blueprint.size
    this.map.mapType = isInteriorBlueprint(blueprint) ? 'interior' : (blueprint.mapType ?? 'continent')
    this.map.playersPos = blueprint.spawns || []
    this.map.interiorExits = blueprint.exits || []
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
    if (!Array.isArray(blueprint.resources)) {
      this.map.pregeneratedResourcesLoaded = false
      this.map.blueprintResourceLoadMs = 0
      return
    }

    const startedAt = performance.now()
    this.map.resources = new Set()
    this.map.naturalResourceRespawnSlots = []
    const resourcesConfig = gameConfig().resources
    for (const resource of blueprint.resources) {
      const cell = this.map.grid[resource.i]?.[resource.j]
      if (!cell || cell.has || cell.solid) continue
      const definition = resourcesConfig[resource.type]
      const assets = definition?.assets
      const hasCompatibleTexture =
        resource.textureName ||
        definition?.isAnimated ||
        Array.isArray(assets) ||
        typeof assets === 'string' ||
        isTextureRefAsset(assets) ||
        (isTerrainAssetMap(assets) && Boolean(assets[cell.type]))
      if (!hasCompatibleTexture) continue
      try {
        this.map.resources.add(createResourceFromState(resource, this.map))
      } catch (error) {
        console.warn('Skipping invalid blueprint resource', resource, error)
      }
    }
    this.map.pregeneratedResourcesLoaded = true
    this.map.blueprintResourceLoadMs = performance.now() - startedAt
    this.map.context.performance?.record('blueprintResources', this.map.blueprintResourceLoadMs)
  }
}
