import { isContinentWorld } from '../../config/continentWorlds'
import { DEFAULT_WORLD_ID } from '../../config/worlds'
import { PLAYER_TYPES } from '../../constants'
import { assignContinentVillages } from '../../lib/campaign/continentVillagePlacement'
import { restoreCampRespawnStates } from '../../lib/camps/campRespawnState'
import { t } from '../../lib/lang'
import { traceLoadAsync } from '../../lib/loadDiagnostics'
import { preloadBakedLpcUnitsForPlayers } from '../../lib/lpc'
import { createInitialCampaignSave } from '../../serialization/CampaignSave'
import {
  serializeCampaignBootstrap,
  serializeGame,
  serializeGameForPersistence,
} from '../../serialization/SaveSerializer'
import { villageStartProfiles } from '../../services/world/VillageStartingState'
import { initializeCampaignEconomy } from '../../services/world/WorldEconomyRuntime'
import type { BanditCampPlacement } from '../../types/camp'
import type { GameConfig, SerializedSave, VillageStartProfile } from '../../types/save'
import {
  materializeCampaignRegionEconomy,
  preloadSavedPlayerAssets,
  restorePreparedSettlements,
  seedStartingVillages,
} from './GameBootVillages'
import type { GameWorldBootHost, NewGameBootOptions, RuntimeMapInstance } from './GameBootContext'
import { measure, measureAsync, reportProgress } from './GameBootContext'
import { prepareBootMap } from './GameBootMap'
import { recordLoadedMapBlueprint } from './GameMapBlueprintRuntime'
import { ensureCampaignPlayerRoster, hasSerializedGrid, saveConfig, savedRuntimeState } from './GameStateHelpers'
export type { GameWorldBootHost, NewGameBootOptions } from './GameBootContext'

type PreparedBootMap = Awaited<ReturnType<typeof prepareBootMap>>

export async function bootGameFromConfig(
  game: GameWorldBootHost,
  config: GameConfig,
  options: NewGameBootOptions = {}
): Promise<void> {
  const prepared = await prepareBootMap(game, config, options)
  config = prepared.config
  const { map } = prepared
  const previousCampaign = game._campaignSave
  const profiles = villageStartProfiles(config)
  const seedSettlements = game.context.players.some(player => player.type === 'AI')
  const economy = map.worldRegionId ? previousCampaign?.economy?.regions[map.worldRegionId]?.initialState : undefined
  const seedVillages = Boolean(
    !previousCampaign && (seedSettlements || Object.keys(profiles).length || config.heroStartVillage)
  )
  const deferred = Boolean(economy) || seedVillages
  const authored = prepared.blueprint.preparedSettlements
  await measureAsync(game, 'boot.prepareTerrain', () =>
    authored
      ? map.prepareTerrainForSavedState({ onProgress: reportProgress(game) })
      : map.stylishMap({ onProgress: reportProgress(game), deferPlayerPlacement: deferred })
  )
  if (authored) await restorePreparedSettlements(game, map, prepared.blueprint, config)
  else {
    if (deferred) map.ready = false
    if (seedVillages) await seedStartingVillages(game, map, config, profiles, economy)
    await materializeCampaignRegionEconomy(game, map, previousCampaign, economy, options.dayNightElapsedMs)
  }
  if (!previousCampaign) await createBootCampaign(game, config, prepared, profiles)
  await game._updateLoading('finalizingWorld', 0.65)
  measure(game, 'boot.controlsInit', () => game.context.controls?.init?.())

  measure(game, 'boot.mountRuntime', () => game._mountRuntime(options.dayNightElapsedMs))
  if (previousCampaign) game._gameContext().unitRest?.synchronizeAfterTimeJump?.()
  game.context.performance?.setPhase?.('runtime')
  if (!previousCampaign && options.deferInitialSave) return
  await game._updateLoading('preparingSave', 0.68)
  if (!previousCampaign) {
    game._campaignSave!.worlds[game._campaignSave!.currentWorldId]!.state = measure(
      game,
      'boot.serializeCampaign',
      () => serializeGameForPersistence(game._gameContext())
    )
  }
  await saveInitialWorld(game)
}

async function createBootCampaign(
  game: GameWorldBootHost,
  config: GameConfig,
  { human, isolationTest, worldId }: PreparedBootMap,
  profiles: Record<string, VillageStartProfile>
): Promise<void> {
  // Single-region continents simulate villages locally, without a detached region economy.
  // Bootstrap its campaign metadata, then capture world entities once after mounting.
  const initialState = measure(game, 'boot.serializeInitialCampaign', () =>
    isolationTest || isContinentWorld(config.worldId)
      ? serializeCampaignBootstrap(game._gameContext())
      : serializeGame(game._gameContext())
  )
  game._campaignSave = measure(game, 'boot.createCampaign', () =>
    ensureCampaignPlayerRoster(createInitialCampaignSave(initialState))
  )
  await initializeCampaignEconomy(
    game._campaignSave,
    game._gameContext(),
    (worldRegionId, size) =>
      game._loadRequiredWorldMapBlueprint({ worldId, worldRegionId, size, playerCiv: human.civ }),
    profiles,
    initialState
  )
}

async function saveInitialWorld(game: GameWorldBootHost): Promise<void> {
  await game._updateLoading('savingWorld', 0.7)
  game._initialSaveFailed = false
  const saved = await traceLoadAsync('boot.autosaveCampaign', async () =>
    game._autosaveCampaign(progress => {
      const ratio = progress.total ? progress.completed / progress.total : 0
      const label =
        progress.phase === 'publish'
          ? t('publishingSave')
          : `${t('savingWorld')} ${progress.completed} / ${progress.total || '…'}`
      void game._updateLoading(label, 0.7 + Math.min(1, ratio) * 0.29)
    })
  )
  if (saved === false) {
    game._initialSaveFailed = true
    console.warn('[load] Initial autosave failed; opening the ready world without a new save. See [save] error above.')
  }
}

function seedSaveConfig(world: GameConfig, savedConfig: GameConfig, json: SerializedSave) {
  const savedPlayers = Array.isArray(json.players) ? json.players : []
  return {
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
}

type SeedSaveConfig = ReturnType<typeof seedSaveConfig>

async function loadSeedSaveBlueprint(
  game: GameWorldBootHost,
  map: RuntimeMapInstance,
  json: SerializedSave,
  seedConfig: SeedSaveConfig,
  interior: { isInteriorWorld: boolean; blueprintId: string | number | null | undefined }
) {
  const loadedBlueprint = await measureAsync(game, 'seedSave.loadBlueprint', () =>
    interior.isInteriorWorld
      ? game._loadRequiredInteriorBlueprint({ id: String(interior.blueprintId) })
      : game._loadRequiredWorldMapBlueprint({
          size: json.world?.sourceSize ?? map.size,
          playerCiv: seedConfig.players.find(player => player.isHuman)?.civ ?? seedConfig.players[0]?.civ,
          worldId: seedConfig.worldId ?? DEFAULT_WORLD_ID,
          worldRegionId: seedConfig.worldRegionId ?? undefined,
        })
  )
  return isContinentWorld(seedConfig.worldId) ? assignContinentVillages(loadedBlueprint) : loadedBlueprint
}

async function applySeedSavedState(game: GameWorldBootHost, map: RuntimeMapInstance, json: SerializedSave) {
  await measureAsync(game, 'seedSave.applySavedState', async () => {
    const state = savedRuntimeState(json)
    if (map.mapGeneration.applySavedStateToGeneratedMapAsync)
      await map.mapGeneration.applySavedStateToGeneratedMapAsync(state, async (stage, progress) => {
        await game._updateLoading(stage, 0.68 + progress * 0.27)
      })
    else map.mapGeneration.applySavedStateToGeneratedMap(state)
  })
}

export async function bootGameFromSeedSave(game: GameWorldBootHost, json: SerializedSave): Promise<void> {
  game.context.performance?.setPhase?.('load')
  measure(game, 'seedSave.createRuntime', () => game._createRuntime())
  const map = game._map()
  const world = saveConfig(json.world)
  const savedConfig = saveConfig(json.config)
  const seedConfig = seedSaveConfig(world, savedConfig, json)
  measure(game, 'seedSave.applyMapConfig', () => game._applyMapConfig(map, seedConfig))
  measure(game, 'seedSave.createUiRuntime', () => game._createUiRuntime())
  const blueprintId = world.pregeneratedBlueprintId
  const isInteriorWorld = world.mapType === 'interior' || savedConfig.mapType === 'interior'
  if (isInteriorWorld && !blueprintId) throw new Error(t('mapBlueprintUnavailable'))
  await game._updateLoading('readingMap', 0.12)
  const blueprint = await loadSeedSaveBlueprint(game, map, json, seedConfig, { isInteriorWorld, blueprintId })
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
  await game._updateLoading('restoringResources', 0.68)
  await applySeedSavedState(game, map, json)
  await game._updateLoading('finishingLoad', 0.95)
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
      game._loadRequiredWorldMapBlueprint({
        worldId: seedConfig.worldId ?? DEFAULT_WORLD_ID,
        worldRegionId,
        size,
        playerCiv: game.context.player?.civ,
      })
    )
  }
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
  const map = game._map() as RuntimeMapInstance & { banditCampPositions?: BanditCampPlacement[] }
  const camps =
    json.runtime?.banditCamps ??
    (map.banditCampPositions ?? [])
      .filter(camp => camp.profile && camp.unitTypes?.length)
      .map(camp => ({
        id: `camp:${camp.i}:${camp.j}`,
        i: camp.i,
        j: camp.j,
        unitTypes: [...camp.unitTypes!],
        generation: 0,
        ...(camp.caveId ? { caveId: camp.caveId } : {}),
      }))
  restoreCampRespawnStates(map, camps)
  if (json.runtime?.heroEquippedItem !== undefined) {
    game.context.controls?.setEquippedItem?.(json.runtime.heroEquippedItem)
  }
  game.context.weather?.applyState?.(json.runtime?.weather)
  game.context.performance?.setPhase?.('runtime')
}
