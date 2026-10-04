import { readRoadLayer } from '../../../lib/terrain/roadLayer'
import { createDeterministicCellVariantPicker } from '../../../lib'
import { addInteriorWalls } from '../../../lib/graphics/interiorWalls'
import { beginLoadTrace } from '../../../lib/loadDiagnostics'
import type { RuntimeCell } from '../../../types/map'
import { Cell, GenerationCell } from '../../cell'
import { PackedCellStore } from '../../cell/PackedCellStore'
import type { CellDefinition, MapBlueprint, MapGenerationMap } from '../MapGenerationTypes'
import { applyInteriorMasks, isInteriorBlueprint } from './BlueprintInteriorMasks'
import { gameConfig, loadBlueprintResourceBatches, runtimeContext } from './BlueprintResourceLoading'
import { createSquareLocalBlueprint } from './LocalMapBlueprint'
import { applyPreparedTerrain, registerPreparedMapContent } from './PreparedMapContent'

type ProgressCallback = (stage: string, progress: number) => Promise<void> | void

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
    this.map.roads = readRoadLayer(blueprint.preparedSettlements?.roads, blueprint.size + 1)
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
    return applyInteriorMasks.call(this, blueprint)
  }

  loadBlueprintResources(blueprint: MapBlueprint): void {
    for (const processed of this.loadBlueprintResourceBatches(blueprint)) void processed
  }

  private *loadBlueprintResourceBatches(blueprint: MapBlueprint): Generator<number> {
    yield* loadBlueprintResourceBatches(this.map, blueprint)
  }
}
