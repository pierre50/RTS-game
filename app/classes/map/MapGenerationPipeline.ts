import { Gaia } from '../players'
import { updateInstanceVisibility } from '../../lib'
import { rehydrateAIKnowledge } from '../../services/FogOfWar'
import type { GameContextLike } from '../../types/context'
import type {
  GenerationTimer,
  MapGenerationMap,
  ProgressCallback,
  GenerateMapOptions,
} from './MapGenerationTypes'

type PipelineCallbacks = {
  generateSetsAsync: () => Promise<void>
  placeBanditCamps: () => void
  placePortal: () => void
  prepareBaseTerrain: (
    context: GameContextLike,
    timer: Pick<GenerationTimer, 'measure' | 'timings'>,
    onProgress: ProgressCallback
  ) => Promise<void>
  setInitialFogCells: (yieldEvery: number) => Promise<number>
}

export async function setInitialFogCells(
  map: MapGenerationMap,
  yieldToBrowser: () => Promise<void>,
  yieldEvery: number
): Promise<number> {
  const fogCellsStartedAt = performance.now()
  for (let i = 0; i <= map.size; i++) {
    for (let j = 0; j <= map.size; j++) {
      map.grid[i][j].setFog()
    }
    if (i % yieldEvery === 0) await yieldToBrowser()
  }
  return performance.now() - fogCellsStartedAt
}

export async function prepareBaseTerrain(
  map: MapGenerationMap,
  context: GameContextLike,
  timer: Pick<GenerationTimer, 'measure' | 'timings'>,
  onProgress: ProgressCallback,
  yieldToBrowser: () => Promise<void>
): Promise<void> {
  map.gaia = new Gaia(context)
  if (map.pregeneratedBlueprintId) {
    timer.timings.relief = 0
  } else {
    await onProgress('generatingRelief', 0.28)
    timer.measure('relief', () => map.generateMapRelief())
  }
  await yieldToBrowser()
  timer.measure('terrainRendering', () => map.rebuildTerrainAppearance())
}

export async function generateStylishMap(
  map: MapGenerationMap,
  context: GameContextLike,
  timer: GenerationTimer,
  callbacks: PipelineCallbacks,
  { onProgress = async (_stage: string, _progress: number) => {} }: GenerateMapOptions = {}
): Promise<void> {
  const { menu, player } = context
  const { timings, measure, measureAsync } = timer

  await callbacks.prepareBaseTerrain(context, { timings, measure }, onProgress)
  await onProgress('generatingPlayers', 0.48)
  measure('playerPlacement', () => map.placePlayers())
  await onProgress('generatingResources', 0.58)
  if (map.pregeneratedResourcesLoaded) {
    timings.playerResources = 0
    timings.neutralResources = 0
    timings.biomeTrees = 0
  } else {
    await measureAsync('playerResources', () => map.generateResourcesAroundPlayersAsync(map.playersPos))
    await measureAsync('neutralResources', () => map.generateNeutralResourceGroupsAsync(map.playersPos))
    await measureAsync('biomeTrees', () => map.generateBiomeTreesAsync(map.playersPos))
  }
  measure('banditCampPlacement', callbacks.placeBanditCamps)
  measure('portalPlacement', callbacks.placePortal)
  await onProgress('generatingDecorations', 0.74)
  await measureAsync('decorations', callbacks.generateSetsAsync)
  for (const viewer of map.context.players || []) {
    rehydrateAIKnowledge(viewer, map)
  }
  await initializeFogForNewGame(map, player, timings, measure, callbacks, onProgress)
  await finalizeGeneratedMap(map, menu, timings, measureAsync, onProgress, true)
}

export async function prepareTerrainForSavedState(
  map: MapGenerationMap,
  context: GameContextLike,
  timer: GenerationTimer,
  callbacks: Pick<PipelineCallbacks, 'prepareBaseTerrain' | 'setInitialFogCells'>,
  { onProgress = async (_stage: string, _progress: number) => {} }: GenerateMapOptions = {}
): Promise<void> {
  const { timings, measure, measureAsync } = timer

  await callbacks.prepareBaseTerrain(context, { timings, measure }, onProgress)
  await onProgress('generatingFog', 0.72)
  measure('fogInit', () => map._initFogChunks())

  if (!map.revealEverything) {
    timings.fogCells = await callbacks.setInitialFogCells(16)
  }

  map._fogInitComplete = true
  map._flushFogQueue()
  await finalizeGeneratedMap(map, null, timings, measureAsync, onProgress, false)
}

async function initializeFogForNewGame(
  map: MapGenerationMap,
  player: GameContextLike['player'],
  timings: GenerationTimer['timings'],
  measure: GenerationTimer['measure'],
  callbacks: Pick<PipelineCallbacks, 'setInitialFogCells'>,
  onProgress: ProgressCallback
): Promise<void> {
  await onProgress('generatingFog', 0.86)
  measure('fogInit', () => map._initFogChunks())

  if (!map.revealEverything) {
    const yieldEvery = map.pregeneratedBlueprintId ? 32 : 12
    timings.fogCells = await callbacks.setInitialFogCells(yieldEvery)
    for (let i = 0; i < player.buildings.length; i++) {
      const building = player.buildings[i]
      building.visibleCells = new Set()
      updateInstanceVisibility(building)
    }
    for (let i = 0; i < player.units.length; i++) {
      const unit = player.units[i]
      unit.visibleCells = new Set()
      updateInstanceVisibility(unit)
    }
  }

  map._fogInitComplete = true
  map._flushFogQueue()
}

async function finalizeGeneratedMap(
  map: MapGenerationMap,
  menu: GameContextLike['menu'] | null,
  timings: GenerationTimer['timings'],
  measureAsync: GenerationTimer['measureAsync'],
  onProgress: ProgressCallback,
  logTimings: boolean
): Promise<void> {
  await onProgress('finalizingWorld', logTimings ? 0.93 : 0.92)
  await measureAsync('terrainBake', () => map.bakeTerrainToChunks())
  map.ready = true
  map.generationTimings = timings
  if (logTimings) {
    console.table(
      Object.fromEntries(Object.entries(timings).map(([name, duration]) => [name, `${duration.toFixed(1)} ms`]))
    )
  }
  menu?.updateResourcesMiniMap()
}
