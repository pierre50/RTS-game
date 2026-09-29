import type { MapBlueprint } from '../../classes/map/MapGenerationTypes'
import { traceLoad, traceLoadAsync } from '../../lib/loadDiagnostics'
import type { SaveProgress } from '../../serialization/AsyncSaveStorage'
import type { createInitialCampaignSave } from '../../serialization/CampaignSave'
import type { GameContextLike } from '../../types/context'
import type { RuntimeMap } from '../../types/map'
import type { PlayerLike } from '../../types/player'
import type { GameConfig, PlayerSetupConfig } from '../../types/save'
import { type BlueprintRuntimeMap } from './GameMapBlueprintRuntime'
import type { savedRuntimeState } from './GameStateHelpers'

type LoadedMapBlueprint = MapBlueprint & {
  id: string | number
  timings?: Record<string, number>
}

export type RuntimeMapInstance = BlueprintRuntimeMap & {
  noAI?: boolean
  startingUnits?: number
  destroy(options?: unknown): void
  generateFromBlueprint(
    blueprint: LoadedMapBlueprint,
    options?: { onProgress?: (messageKey: string, progress: number) => void }
  ): Promise<void>
  generateFromJSON(state: ReturnType<typeof savedRuntimeState>): void
  generatePlayers(players: Array<Partial<PlayerLike> & PlayerSetupConfig> | null): PlayerLike[]
  mapGeneration: {
    applySavedStateToGeneratedMap(state: ReturnType<typeof savedRuntimeState>): void
    applySavedStateToGeneratedMapAsync?(
      state: ReturnType<typeof savedRuntimeState>,
      onProgress: (stage: string, progress: number) => Promise<void>
    ): Promise<void>
  }
  prepareTerrainForSavedState(options?: { onProgress?: (messageKey: string, progress: number) => void }): Promise<void>
  stylishMap(options?: {
    onProgress?: (messageKey: string, progress: number) => void
    deferPlayerPlacement?: boolean
  }): Promise<void>
}

export type GameWorldBootHost = {
  _initialSaveFailed?: boolean
  _campaignSave: ReturnType<typeof createInitialCampaignSave> | null
  context: {
    paused?: boolean
    controls?: { init?: () => void; setEquippedItem?: GameContextLike['controls']['setEquippedItem'] } | null
    menu?: { init?: () => void } | null
    performance?: { record?: (name: string, duration: number) => void; setPhase?: (phase: string) => void } | null
    player: PlayerLike | null
    players: PlayerLike[]
    weather?: GameContextLike['weather'] | null
  }
  _applyMapConfig(map: RuntimeMap, config?: GameConfig): void
  _autosaveCampaign(onProgress?: (progress: SaveProgress) => void): void | Promise<boolean>
  _createRuntime(): void
  _createUiRuntime(): void
  _gameContext(): GameContextLike
  _loadRequiredWorldMapBlueprint(options: {
    playerCiv?: string | null
    size?: number
    worldId: string
    worldRegionId?: string
  }): Promise<LoadedMapBlueprint>
  _loadRequiredInteriorBlueprint(options?: {
    buildingSize?: number
    buildingType?: string
    id?: string
    interiorType?: string
  }): Promise<LoadedMapBlueprint>
  _map(): RuntimeMapInstance
  _mountRuntime(dayNightElapsedMs?: number | null): void
  _updateLoading(messageKey: string, progress: number): Promise<void>
}

export function reportProgress(game: GameWorldBootHost) {
  return (messageKey: string, progress: number) => game._updateLoading(messageKey, 0.12 + progress * 0.55)
}

export async function measureAsync<T>(game: GameWorldBootHost, name: string, callback: () => Promise<T>): Promise<T> {
  const startedAt = performance.now()
  try {
    return await traceLoadAsync(name, callback)
  } finally {
    game.context.performance?.record?.(name, performance.now() - startedAt)
  }
}

export function measure<T>(game: GameWorldBootHost, name: string, callback: () => T): T {
  const startedAt = performance.now()
  try {
    return traceLoad(name, callback)
  } finally {
    game.context.performance?.record?.(name, performance.now() - startedAt)
  }
}

export type NewGameBootOptions = {
  /** Keep simulation suspended until the opening has been revealed. */
  startPaused?: boolean
  dayNightElapsedMs?: number | null
  startingSetup?: Promise<Pick<GameConfig, 'heroOnlyStart' | 'heroStartVillage' | 'villageStarts'>>
}
