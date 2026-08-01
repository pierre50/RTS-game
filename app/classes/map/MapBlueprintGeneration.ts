import { Assets } from 'pixi.js'
import { Resource } from '../Resource'
import { Cell, GenerationCell } from '../cell'
import type { RuntimeCell } from '../../types/map'
import type { ResourceEntity } from '../../types/entities'
import type { GameContextLike } from '../../types/context'
import type { CellDefinition, MapBlueprint, MapGenerationContext, MapGenerationMap } from './MapGeneration'

type ProgressCallback = (stage: string, progress: number) => Promise<void> | void
type ResourceAssets = string | string[] | Record<string, string[]>
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

function isTerrainAssetMap(assets: ResourceAssets | undefined): assets is Record<string, string[]> {
  return Boolean(assets && typeof assets === 'object' && !Array.isArray(assets))
}

function createResourceFromState(resource: BlueprintResourceState, map: MapGenerationMap): ResourceEntity {
  return map.addChild(new Resource(resource, runtimeContext(map.context)))
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
    this.applyBlueprintMetadata(blueprint)

    const startedAt = performance.now()
    const cellDefinitions = gameConfig().cells
    const relief = blueprint.relief ?? []
    for (let i = 0; i <= this.map.size; i++) {
      const row: RuntimeCell[] = []
      this.map.grid[i] = row
      for (let j = 0; j <= this.map.size; j++) {
        const type = blueprint.terrain[i][j]
        const cell = new GenerationCell(
          {
            i,
            j,
            z: relief[i]?.[j] || 0,
            type: String(type),
            definition: cellDefinitions[type] as CellDefinition,
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
    this.map.blueprintCellCreationMs = performance.now() - startedAt
    this.map.context.performance?.record('blueprintCellCreation', this.map.blueprintCellCreationMs)

    const fillWaterStartedAt = performance.now()
    this.map.fillWaterGaps()
    this.map.blueprintFillWaterGapsMs = performance.now() - fillWaterStartedAt
    await this.yieldToBrowser()
    const normalizeWaterStartedAt = performance.now()
    this.map.normalizeWaterTopology()
    this.map.blueprintNormalizeWaterMs = performance.now() - normalizeWaterStartedAt
    await this.yieldToBrowser()
    const waterBorderStartedAt = performance.now()
    this.map.formatCellsWaterBorder()
    this.map.blueprintWaterBorderReady = true
    this.map.blueprintInitialWaterBorderMs = performance.now() - waterBorderStartedAt

    this.loadBlueprintResources(blueprint)
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

    this.map.fillWaterGaps()
    this.map.normalizeWaterTopology()
    this.map.formatCellsWaterBorder()
    this.loadBlueprintResources(blueprint)
  }

  applyBlueprintMetadata(blueprint: MapBlueprint): void {
    this.map.seed = blueprint.seed
    this.map.size = blueprint.size
    this.map.mapType = 'continent'
    this.map.playersPos = blueprint.spawns || []
    this.map.positionsCount = this.map.playersPos.length || this.map.positionsCount
    this.map.resetRandom()
    this.map.invalidateReliefCoastDistances()
  }

  loadBlueprintResources(blueprint: MapBlueprint): void {
    if (!Array.isArray(blueprint.resources)) {
      this.map.pregeneratedResourcesLoaded = false
      this.map.blueprintResourceLoadMs = 0
      return
    }

    const startedAt = performance.now()
    this.map.resources = new Set()
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
