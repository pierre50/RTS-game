import { definedProperties } from '../../lib/definedProperties'
import { economyRulesFor, initializeCampaignEconomy } from '../../services/world/WorldEconomyRuntime'
import { placeInitialVillageUnits } from '../../services/world/InitialVillagePlacement'
import { populateVillageBase } from '../../services/world/VillageBaseState'
import { OfflineWorldSpatial } from '../../services/world/OfflineWorldSpatial'
import { applyVillageStartingState, placeStartingHeroInVillage, villageStartProfiles } from '../../services/world/VillageStartingState'
import { materializeInitialEconomy } from '../../services/world/WorldEconomy'
import { t } from '../../lib/lang'
import { preloadBakedLpcUnitsForPlayers } from '../../lib/lpc'
import { DEFAULT_WORLD_ID } from '../../config/worlds'
import { CIVILIZATIONS } from '../../config/civilizations'
import { serializeGame } from '../../serialization/SaveSerializer'
import { createInitialCampaignSave } from '../../serialization/CampaignSave'
import { PLAYER_TYPES } from '../../constants'
import { ensureNeutralPlayer } from '../../classes/players/GaiaPlayer'
import type { GameContextLike } from '../../types/context'
import type { MapBlueprint } from '../../classes/map/MapGenerationTypes'
import type { RuntimeMap } from '../../types/map'
import type { PlayerLike } from '../../types/player'
import type { GameConfig, PlayerSetupConfig, SerializedSave } from '../../types/save'
import { ensureCampaignPlayerRoster, hasSerializedGrid, saveConfig, savedRuntimeState } from './GameStateHelpers'
import { recordLoadedMapBlueprint, type BlueprintRuntimeMap } from './GameMapBlueprintRuntime'
import { buildWorldRegionPlayerConfigs, humanPlayerConfig, selectActivePlayer } from './WorldRegionPlayers'

type LoadedMapBlueprint = MapBlueprint & {
  id: string | number
  timings?: Record<string, number>
}

type RuntimeMapInstance = BlueprintRuntimeMap & {
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
  }
  prepareTerrainForSavedState(options?: { onProgress?: (messageKey: string, progress: number) => void }): Promise<void>
  stylishMap(options?: { onProgress?: (messageKey: string, progress: number) => void; deferPlayerPlacement?: boolean }): Promise<void>
}

export type GameWorldBootHost = {
  _campaignSave: ReturnType<typeof createInitialCampaignSave> | null
  context: {
    controls?: { init?: () => void; setEquippedItem?: GameContextLike['controls']['setEquippedItem'] } | null
    menu?: { init?: () => void } | null
    performance?: { record?: (name: string, duration: number) => void; setPhase?: (phase: string) => void } | null
    player: PlayerLike | null
    players: PlayerLike[]
    weather?: GameContextLike['weather'] | null
    worldPursuit?: GameContextLike['worldPursuit'] | null
  }
  _applyMapConfig(map: RuntimeMap, config?: GameConfig): void
  _autosaveCampaign(): void
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
  measure(game, 'boot.applyMapConfig', () => game._applyMapConfig(map, config.heroStartVillage ? { ...config, heroOnlyStart: true } : config))
  measure(game, 'boot.createUiRuntime', () => game._createUiRuntime())

  const mapGenerationStartedAt = performance.now()
  const human = humanPlayerConfig(config)
  const worldId = config.worldId ?? DEFAULT_WORLD_ID
  const blueprint = await measureAsync(game, 'boot.loadMapBlueprint', () =>
    game._loadRequiredWorldMapBlueprint({
      size: map.size,
      playerCiv: config.heroStartVillage ?? human.civ,
      worldId,
      worldRegionId: config.worldRegionId ?? undefined,
    })
  )
  if (blueprint.environment) map.environment = blueprint.environment
  await measureAsync(game, 'boot.generateFromBlueprint', () =>
    map.generateFromBlueprint(blueprint, { onProgress: reportProgress(game) })
  )
  recordLoadedMapBlueprint(map, blueprint, 'pregenerated-blueprint', mapGenerationStartedAt)
  await game._updateLoading('generatingPlayers', 0.2)
  game.context.players = measure(game, 'boot.generatePlayers', () =>
    map.generatePlayers(buildWorldRegionPlayerConfigs(config, blueprint, game._campaignSave?.factions))
  )
  game.context.player = selectActivePlayer(game.context.players)
  ensureNeutralPlayer(game._gameContext())
  measure(game, 'boot.menuInit', () => game.context.menu?.init?.())
  await measureAsync(game, 'boot.preloadUnits', () =>
    preloadBakedLpcUnitsForPlayers(game.context.players, game.context.performance, {
      villagerCivilizations: CIVILIZATIONS.map(civilization => civilization.value),
      preloadEquipment: true,
    })
  )
  const previousCampaign = game._campaignSave
  const profiles = villageStartProfiles(config)
  const economy = map.worldRegionId ? previousCampaign?.economy?.regions[map.worldRegionId]?.initialState : undefined
  const deferred = Boolean(economy || (!previousCampaign && (Object.keys(profiles).length || config.heroStartVillage)))
  await measureAsync(game, 'boot.stylishMap', () => map.stylishMap({ onProgress: reportProgress(game), deferPlayerPlacement: deferred }))
  if (deferred) map.ready = false
  const initialVillageState = () => {
    const initial = serializeGame(game._gameContext())
    const rules = economyRulesFor(initial)
    const spatial = new OfflineWorldSpatial(map.grid, initial, (b, i) => Number(rules.buildingConfig(i, b.type).size) || 2)
    initial.players.forEach((player, index) => {
      if (player.type !== 'AI' && !player.isPlayed) return
      if (player.units?.length || player.buildings?.length) return
      if (economy?.players.some(p => p.factionId && p.factionId === player.factionId)) return
      const runtime = game.context.players.find(p => p.label === player.label)
      if (!runtime) throw new Error('Missing starting player anchor')
      populateVillageBase(player, index, runtime, spatial, rules, map.startingResources, {
        heroOnly: player.isPlayed && map.heroOnlyStart, workers: map.startingUnits,
      })
    })
    return initial
  }
  if (!previousCampaign && (Object.keys(profiles).length || config.heroStartVillage)) {
    const initial = initialVillageState()
    const rules = economyRulesFor(initial)
    const generated = applyVillageStartingState(initial, profiles, map.grid, rules)
    placeInitialVillageUnits(generated, new Set(generated.players.flatMap(p => p.factionId ? [p.factionId] : [])), map.grid, rules, { includePlayed: true })
    if (config.heroStartVillage) {
      placeStartingHeroInVillage(generated, config.heroStartVillage, map.grid, rules)
    }
    await preloadSavedPlayerAssets(game, generated)
    map.mapGeneration.applySavedStateToGeneratedMap(savedRuntimeState(generated))
  }
  if (previousCampaign?.economy && map.worldRegionId) {
    const economy = previousCampaign.economy.regions[map.worldRegionId]?.initialState
    if (economy) {
      const generated = materializeInitialEconomy(initialVillageState(), economy, options.dayNightElapsedMs ?? 0)
      placeInitialVillageUnits(generated, new Set(economy.players.flatMap(p => p.factionId ? [p.factionId] : [])),
        map.grid, economyRulesFor(generated))
      await preloadSavedPlayerAssets(game, generated)
      map.mapGeneration.applySavedStateToGeneratedMap(savedRuntimeState(generated))
    }
  }
  if (!previousCampaign) {
    game._campaignSave = ensureCampaignPlayerRoster(createInitialCampaignSave(serializeGame(game._gameContext())))
    await initializeCampaignEconomy(game._campaignSave, game._gameContext(), (worldRegionId, size) =>
      game._loadRequiredWorldMapBlueprint({ worldId, worldRegionId, size, playerCiv: human.civ }),
      profiles
    )
  }
  await game._updateLoading('finalizingWorld', 0.96)
  measure(game, 'boot.controlsInit', () => game.context.controls?.init?.())

  measure(game, 'boot.mountRuntime', () => game._mountRuntime(options.dayNightElapsedMs))
  if (previousCampaign) game._gameContext().unitRest?.synchronizeAfterTimeJump?.()
  game.context.performance?.setPhase?.('runtime')
  if (!previousCampaign) {
    game._campaignSave!.worlds[game._campaignSave!.currentWorldId]!.state = serializeGame(game._gameContext())
  }
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
    localGridLayout: world.localGridLayout ?? savedConfig.localGridLayout,
    worldId: world.worldId ?? savedConfig.worldId ?? DEFAULT_WORLD_ID,
    worldRegionId: world.worldRegionId ?? savedConfig.worldRegionId ?? undefined,
    players: savedPlayers.map(player => ({
      civ: player.civ,
      gender: player.gender,
      heroAppearance: player.heroAppearance,
      isHuman: player.isPlayed && player.type === PLAYER_TYPES.human,
    })),
  }
  measure(game, 'seedSave.applyMapConfig', () => game._applyMapConfig(map, seedConfig))
  measure(game, 'seedSave.createUiRuntime', () => game._createUiRuntime())
  const blueprintId = world.pregeneratedBlueprintId
  const isInteriorWorld = world.mapType === 'interior' || savedConfig.mapType === 'interior'
  if (isInteriorWorld && !blueprintId) throw new Error(t('mapBlueprintUnavailable'))
  const blueprint = await measureAsync(game, 'seedSave.loadBlueprint', () =>
    isInteriorWorld
      ? game._loadRequiredInteriorBlueprint({ id: String(blueprintId) })
      : game._loadRequiredWorldMapBlueprint({
          size: json.world?.sourceSize ?? map.size,
          playerCiv: seedConfig.players.find(player => player.isHuman)?.civ ?? seedConfig.players[0]?.civ,
          worldId: seedConfig.worldId ?? DEFAULT_WORLD_ID,
          worldRegionId: seedConfig.worldRegionId ?? undefined,
        })
  )
  await measureAsync(game, 'seedSave.generateFromBlueprint', () =>
    map.generateFromBlueprint(
      { ...blueprint, preserveLegacyGrid: !seedConfig.localGridLayout },
      { onProgress: reportProgress(game) }
    )
  )
  recordLoadedMapBlueprint(map, blueprint, 'save-pregenerated-blueprint')
  await measureAsync(game, 'seedSave.prepareTerrainForSavedState', () =>
    map.prepareTerrainForSavedState({ onProgress: reportProgress(game) })
  )
  await preloadSavedPlayerAssets(game, json)
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
  restoreSavedRuntimeState(game, json)
  if (game._campaignSave && !game._campaignSave.economy?.initialized && !isInteriorWorld) {
    await initializeCampaignEconomy(game._campaignSave, game._gameContext(), (worldRegionId, size) =>
      game._loadRequiredWorldMapBlueprint({ worldId: seedConfig.worldId ?? DEFAULT_WORLD_ID, worldRegionId, size,
        playerCiv: game.context.player?.civ })
    )
  }
}

async function preloadSavedPlayerAssets(game: GameWorldBootHost, json: SerializedSave): Promise<void> {
  // Saved units need their owner's appearance sheets before their constructors run.
  const players = [
    ...json.players,
    ...(json.runtime?.worldPursuers ?? []).flatMap(entry => (entry.owner ? [entry.owner] : [])),
  ]
    .flatMap(player => [
      player,
      ...[...(player.units ?? []), ...(player.corpses ?? [])]
        .filter(unit => unit.assetCiv)
        .map(unit => ({ ...player, civ: unit.assetCiv })),
    ])
    .map(player =>
      definedProperties({
        civ: player.civ,
        gender: player.gender,
        label: player.label ?? '',
        heroAppearance: player.heroAppearance,
      })
    )
  await measureAsync(game, 'save.preloadPlayerAssets', () =>
    preloadBakedLpcUnitsForPlayers(players, game.context.performance, { preloadEquipment: true })
  )
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
  await preloadSavedPlayerAssets(game, json)
  measure(game, 'save.generateFromJSON', () => map.generateFromJSON(savedRuntimeState(json)))
  await measureAsync(game, 'save.preloadUnits', () =>
    preloadBakedLpcUnitsForPlayers(game.context.players, game.context.performance, {
      preloadEquipment: true,
    })
  )
  measure(game, 'save.controlsInit', () => game.context.controls?.init?.())
  measure(game, 'save.mountRuntime', () => game._mountRuntime(json.runtime?.dayNightElapsedMs))
  restoreSavedRuntimeState(game, json)
}

function restoreSavedRuntimeState(game: GameWorldBootHost, json: SerializedSave): void {
  if (json.runtime?.heroEquippedItem !== undefined) {
    game.context.controls?.setEquippedItem?.(json.runtime.heroEquippedItem)
  }
  game.context.worldPursuit?.restore(json.runtime?.worldPursuers)
  game.context.weather?.applyState?.(json.runtime?.weather)
  game.context.performance?.setPhase?.('runtime')
}
