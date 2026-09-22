import { Gaia } from '../players'
import { placeCave } from './generation/CaveGeneration'
import { buildNeighborScenery } from './NeighborScenery'
import { updateInstanceVisibility } from '../../lib'
import { getEnvironmentTerrainParams } from '../../constants'
import { rehydrateAIKnowledge } from '../../services/UnitPerception'
import type { GameContextLike } from '../../types/context'
import type { GenerationTimer, MapGenerationMap, ProgressCallback, GenerateMapOptions } from './MapGenerationTypes'

type PipelineCallbacks = {
  generateSetsAsync: () => Promise<void>
  placeBanditCamps: () => void
  prepareBaseTerrain: (
    context: GameContextLike,
    timer: Pick<GenerationTimer, 'measure' | 'timings'>,
    onProgress: ProgressCallback
  ) => Promise<void>
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
  {
    onProgress = async (_stage: string, _progress: number) => {},
    deferPlayerPlacement = false,
  }: GenerateMapOptions = {}
): Promise<void> {
  const { menu, player } = context
  const { timings, measure, measureAsync } = timer

  await callbacks.prepareBaseTerrain(context, { timings, measure }, onProgress)
  await onProgress('generatingPlayers', 0.48)
  measure('cavePlacement', () => placeCave(map, context))
  if (!deferPlayerPlacement) measure('playerPlacement', () => map.placePlayers())
  await onProgress('generatingResources', 0.58)
  if (map.pregeneratedResourcesLoaded) {
    timings.neutralResources = 0
    timings.biomeTrees = 0
  } else {
    const resourceOptions = { treeTextureFamily: getEnvironmentTerrainParams(map.environment).treeTextureFamily }
    await measureAsync('neutralResources', () =>
      map.generateNeutralResourceGroupsAsync(map.playersPos, resourceOptions)
    )
    await measureAsync('biomeTrees', () => map.generateBiomeTreesAsync(map.playersPos, resourceOptions))
  }
  measure('banditCampPlacement', callbacks.placeBanditCamps)
  await onProgress('generatingDecorations', 0.74)
  await measureAsync('decorations', callbacks.generateSetsAsync)
  for (const viewer of map.context.players || []) {
    rehydrateAIKnowledge(viewer, map)
  }
  initializePlayerPerception(player)
  await finalizeGeneratedMap(map, menu, timings, measureAsync, onProgress, true)
}

export async function prepareTerrainForSavedState(
  map: MapGenerationMap,
  context: GameContextLike,
  timer: GenerationTimer,
  callbacks: Pick<PipelineCallbacks, 'prepareBaseTerrain'>,
  { onProgress = async (_stage: string, _progress: number) => {} }: GenerateMapOptions = {}
): Promise<void> {
  const { timings, measure, measureAsync } = timer

  await callbacks.prepareBaseTerrain(context, { timings, measure }, onProgress)
  await finalizeGeneratedMap(map, null, timings, measureAsync, onProgress, false)
}

function initializePlayerPerception(player: GameContextLike['player']): void {
  for (const entity of [...player.buildings, ...player.units]) {
    entity.visibleCells = new Set()
    updateInstanceVisibility(entity)
  }
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
  await measureAsync('neighborScenery', async () => buildNeighborScenery(map))
  map.ready = true
  map.generationTimings = timings
  if (logTimings) {
    console.table(
      Object.fromEntries(Object.entries(timings).map(([name, duration]) => [name, `${duration.toFixed(1)} ms`]))
    )
  }
  if (menu?.isMiniMapActive?.() !== false) menu?.updateResourcesMiniMap()
}
