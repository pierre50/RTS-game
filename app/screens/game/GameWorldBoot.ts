import { t } from '../../lib/lang'
import { preloadBakedLpcUnitsForPlayers } from '../../lib/lpc'
import { serializeGame } from '../../serialization/SaveSerializer'
import { createInitialCampaignSave } from '../../serialization/CampaignSave'
import { PLAYER_TYPES } from '../../constants'
import type { GameContextLike } from '../../types/context'
import type { MapBlueprint } from '../../classes/map/MapGenerationTypes'
import type { RuntimeMap } from '../../types/map'
import type { PlayerLike } from '../../types/player'
import type { GameConfig, PlayerSetupConfig, SerializedSave } from '../../types/save'
import { hasSerializedGrid, saveConfig, savedRuntimeState } from './GameStateHelpers'
import { recordLoadedMapBlueprint, type BlueprintRuntimeMap } from './GameMapBlueprintRuntime'

type LoadedMapBlueprint = MapBlueprint & {
  id: string | number
  timings?: Record<string, number>
}

type RuntimeMapInstance = BlueprintRuntimeMap & {
  destroy(options?: unknown): void
  generateFromBlueprint(
    blueprint: LoadedMapBlueprint,
    options?: { onProgress?: (messageKey: string, progress: number) => void }
  ): Promise<void>
  generateFromJSON(state: ReturnType<typeof savedRuntimeState>): void
  generatePlayers(players: Array<Partial<PlayerLike> & PlayerSetupConfig> | null): PlayerLike[]
  mapGeneration: {
    applySavedStateToGeneratedMap(state: ReturnType<typeof savedRuntimeState>): void
  }
  prepareTerrainForSavedState(options?: { onProgress?: (messageKey: string, progress: number) => void }): Promise<void>
  stylishMap(options?: { onProgress?: (messageKey: string, progress: number) => void }): Promise<void>
}

export type GameWorldBootHost = {
  _campaignSave: ReturnType<typeof createInitialCampaignSave> | null
  context: {
    controls?: { init?: () => void } | null
    menu?: { init?: () => void } | null
    performance?: { setPhase?: (phase: string) => void } | null
    player: PlayerLike | null
    players: PlayerLike[]
  }
  _applyMapConfig(map: RuntimeMap, config?: GameConfig): void
  _autosaveCampaign(): void
  _createRuntime(): void
  _createUiRuntime(): void
  _gameContext(): GameContextLike
  _loadRequiredMapBlueprint(options?: {
    environment?: string
    id?: string
    positionsCount?: number
    size?: number
  }): Promise<LoadedMapBlueprint>
  _loadRequiredInteriorBlueprint(options?: {
    id?: string
    interiorType?: string
  }): Promise<LoadedMapBlueprint>
  _map(): RuntimeMapInstance
  _mountRuntime(dayNightElapsedMs?: number | null): void
  _updateLoading(messageKey: string, progress: number): Promise<void>
}

function reportProgress(game: GameWorldBootHost) {
  return (messageKey: string, progress: number) => game._updateLoading(messageKey, progress)
}

export async function bootGameFromConfig(
  game: GameWorldBootHost,
  config: GameConfig,
  options: { dayNightElapsedMs?: number | null } = {}
): Promise<void> {
  game.context.performance?.setPhase?.('load')
  game._createRuntime()
  const map = game._map()
  game._applyMapConfig(map, config)
  game._createUiRuntime()

  const mapGenerationStartedAt = performance.now()
  const blueprint = await game._loadRequiredMapBlueprint({
    size: map.size,
    environment: map.environment,
  })
  await map.generateFromBlueprint(blueprint, { onProgress: reportProgress(game) })
  recordLoadedMapBlueprint(map, blueprint, 'pregenerated-blueprint', mapGenerationStartedAt)
  await game._updateLoading('generatingPlayers', 0.2)
  game.context.players = map.generatePlayers((config.players as Array<Partial<PlayerLike> & PlayerSetupConfig>) || null)
  game.context.player = game.context.players[0]
  game.context.menu?.init?.()
  await preloadBakedLpcUnitsForPlayers(game.context.players)
  await map.stylishMap({ onProgress: reportProgress(game) })
  await game._updateLoading('finalizingWorld', 0.96)
  game.context.controls?.init?.()

  game._mountRuntime(options.dayNightElapsedMs)
  game.context.performance?.setPhase?.('runtime')
  game._campaignSave = createInitialCampaignSave(serializeGame(game._gameContext()))
  game._autosaveCampaign()
}

export async function bootGameFromSeedSave(game: GameWorldBootHost, json: SerializedSave): Promise<void> {
  game.context.performance?.setPhase?.('load')
  game._createRuntime()
  const map = game._map()
  const world = saveConfig(json.world)
  const savedConfig = saveConfig(json.config)
  const savedPlayers = Array.isArray(json.players) ? json.players : []
  const seedConfig = {
    ...savedConfig,
    seed: world.seed ?? savedConfig.seed,
    size: world.size ?? savedConfig.size,
    mapType: world.mapType ?? savedConfig.mapType,
    environment: world.environment ?? savedConfig.environment,
    players: savedPlayers.map(player => ({
      civ: player.civ,
      gender: player.gender,
      heroAppearance: player.heroAppearance,
      isHuman: player.isPlayed && player.type === PLAYER_TYPES.human,
    })),
  }
  game._applyMapConfig(map, seedConfig)
  game._createUiRuntime()
  const positionsCount =
    Number.isFinite(world.positionsCount) && Number(world.positionsCount) > 0
      ? Number(world.positionsCount)
      : savedPlayers.length || null

  const blueprintId = world.pregeneratedBlueprintId
  if (!blueprintId) throw new Error(t('mapBlueprintUnavailable'))
  const isInteriorWorld = world.mapType === 'interior' || savedConfig.mapType === 'interior'
  const blueprint = isInteriorWorld
    ? await game._loadRequiredInteriorBlueprint({ id: String(blueprintId) })
    : await game._loadRequiredMapBlueprint({
        size: map.size,
        id: String(blueprintId),
        positionsCount: positionsCount ?? undefined,
      })
  await map.generateFromBlueprint(blueprint, { onProgress: reportProgress(game) })
  recordLoadedMapBlueprint(map, blueprint, 'save-pregenerated-blueprint')
  await map.prepareTerrainForSavedState({ onProgress: reportProgress(game) })
  map.mapGeneration.applySavedStateToGeneratedMap(savedRuntimeState(json))
  game.context.controls?.init?.()
  game._mountRuntime(json.runtime?.dayNightElapsedMs)
  game.context.performance?.setPhase?.('runtime')
}

export async function bootGameFromSave(game: GameWorldBootHost, json: SerializedSave): Promise<void> {
  game.context.performance?.setPhase?.('load')
  if (!hasSerializedGrid(json)) {
    await bootGameFromSeedSave(game, json)
    return
  }
  game._createRuntime()
  const map = game._map()
  const savedMap = json.map
  map.size = Math.max(0, (savedMap?.length || 1) - 1)
  game._applyMapConfig(map, saveConfig(json.config))
  game._createUiRuntime()
  map.generateFromJSON(savedRuntimeState(json))
  game.context.controls?.init?.()
  game._mountRuntime(json.runtime?.dayNightElapsedMs)
  game.context.performance?.setPhase?.('runtime')
}
