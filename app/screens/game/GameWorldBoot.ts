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
import { ensureCampaignPlayerRoster, hasSerializedGrid, saveConfig, savedRuntimeState } from './GameStateHelpers'
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
    performance?: { record?: (name: string, duration: number) => void; setPhase?: (phase: string) => void } | null
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
    buildingSize?: number
    buildingType?: string
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

async function measureAsync<T>(game: GameWorldBootHost, name: string, callback: () => Promise<T>): Promise<T> {
  const startedAt = performance.now()
  try {
    return await callback()
  } finally {
    game.context.performance?.record?.(name, performance.now() - startedAt)
  }
}

function measure<T>(game: GameWorldBootHost, name: string, callback: () => T): T {
  const startedAt = performance.now()
  try {
    return callback()
  } finally {
    game.context.performance?.record?.(name, performance.now() - startedAt)
  }
}

export async function bootGameFromConfig(
  game: GameWorldBootHost,
  config: GameConfig,
  options: { dayNightElapsedMs?: number | null } = {}
): Promise<void> {
  game.context.performance?.setPhase?.('load')
  measure(game, 'boot.createRuntime', () => game._createRuntime())
  const map = game._map()
  measure(game, 'boot.applyMapConfig', () => game._applyMapConfig(map, config))
  measure(game, 'boot.createUiRuntime', () => game._createUiRuntime())

  const mapGenerationStartedAt = performance.now()
  const blueprint = await measureAsync(game, 'boot.loadMapBlueprint', () =>
    game._loadRequiredMapBlueprint({
      size: map.size,
      environment: map.environment,
    })
  )
  await measureAsync(game, 'boot.generateFromBlueprint', () =>
    map.generateFromBlueprint(blueprint, { onProgress: reportProgress(game) })
  )
  recordLoadedMapBlueprint(map, blueprint, 'pregenerated-blueprint', mapGenerationStartedAt)
  await game._updateLoading('generatingPlayers', 0.2)
  game.context.players = measure(game, 'boot.generatePlayers', () =>
    map.generatePlayers((config.players as Array<Partial<PlayerLike> & PlayerSetupConfig>) || null)
  )
  game.context.player = game.context.players[0]
  measure(game, 'boot.menuInit', () => game.context.menu?.init?.())
  await measureAsync(game, 'boot.preloadUnits', () =>
    preloadBakedLpcUnitsForPlayers(game.context.players, game.context.performance, {
      preloadEquipment: true,
    })
  )
  await measureAsync(game, 'boot.stylishMap', () => map.stylishMap({ onProgress: reportProgress(game) }))
  await game._updateLoading('finalizingWorld', 0.96)
  measure(game, 'boot.controlsInit', () => game.context.controls?.init?.())

  measure(game, 'boot.mountRuntime', () => game._mountRuntime(options.dayNightElapsedMs))
  game.context.performance?.setPhase?.('runtime')
  game._campaignSave = ensureCampaignPlayerRoster(createInitialCampaignSave(serializeGame(game._gameContext())))
  game._autosaveCampaign()
}

export async function bootGameFromSeedSave(game: GameWorldBootHost, json: SerializedSave): Promise<void> {
  game.context.performance?.setPhase?.('load')
  measure(game, 'seedSave.createRuntime', () => game._createRuntime())
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
  measure(game, 'seedSave.applyMapConfig', () => game._applyMapConfig(map, seedConfig))
  measure(game, 'seedSave.createUiRuntime', () => game._createUiRuntime())
  const positionsCount =
    Number.isFinite(world.positionsCount) && Number(world.positionsCount) > 0
      ? Number(world.positionsCount)
      : savedPlayers.length || null

  const blueprintId = world.pregeneratedBlueprintId
  if (!blueprintId) throw new Error(t('mapBlueprintUnavailable'))
  const isInteriorWorld = world.mapType === 'interior' || savedConfig.mapType === 'interior'
  const blueprint = await measureAsync(game, 'seedSave.loadBlueprint', () =>
    isInteriorWorld
      ? game._loadRequiredInteriorBlueprint({ id: String(blueprintId) })
      : game._loadRequiredMapBlueprint({
          size: map.size,
          id: String(blueprintId),
          positionsCount: positionsCount ?? undefined,
        })
  )
  await measureAsync(game, 'seedSave.generateFromBlueprint', () =>
    map.generateFromBlueprint(blueprint, { onProgress: reportProgress(game) })
  )
  recordLoadedMapBlueprint(map, blueprint, 'save-pregenerated-blueprint')
  await measureAsync(game, 'seedSave.prepareTerrainForSavedState', () =>
    map.prepareTerrainForSavedState({ onProgress: reportProgress(game) })
  )
  measure(game, 'seedSave.applySavedState', () =>
    map.mapGeneration.applySavedStateToGeneratedMap(savedRuntimeState(json))
  )
  await measureAsync(game, 'seedSave.preloadUnits', () =>
    preloadBakedLpcUnitsForPlayers(game.context.players, game.context.performance, {
      preloadEquipment: true,
    })
  )
  measure(game, 'seedSave.controlsInit', () => game.context.controls?.init?.())
  measure(game, 'seedSave.mountRuntime', () => game._mountRuntime(json.runtime?.dayNightElapsedMs))
  game.context.performance?.setPhase?.('runtime')
}

export async function bootGameFromSave(game: GameWorldBootHost, json: SerializedSave): Promise<void> {
  game.context.performance?.setPhase?.('load')
  if (!hasSerializedGrid(json)) {
    await bootGameFromSeedSave(game, json)
    return
  }
  measure(game, 'save.createRuntime', () => game._createRuntime())
  const map = game._map()
  const savedMap = json.map
  map.size = Math.max(0, (savedMap?.length || 1) - 1)
  measure(game, 'save.applyMapConfig', () => game._applyMapConfig(map, saveConfig(json.config)))
  measure(game, 'save.createUiRuntime', () => game._createUiRuntime())
  measure(game, 'save.generateFromJSON', () => map.generateFromJSON(savedRuntimeState(json)))
  await measureAsync(game, 'save.preloadUnits', () =>
    preloadBakedLpcUnitsForPlayers(game.context.players, game.context.performance, {
      preloadEquipment: true,
    })
  )
  measure(game, 'save.controlsInit', () => game.context.controls?.init?.())
  measure(game, 'save.mountRuntime', () => game._mountRuntime(json.runtime?.dayNightElapsedMs))
  game.context.performance?.setPhase?.('runtime')
}
