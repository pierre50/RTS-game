import { BUILDING_TYPES } from '../../constants'
import { preloadBakedLpcUnitsForPlayers } from '../../lib/lpc'
import {
  addChildWorldToCampaign,
  createInitialCampaignSave,
  enterCampaignWorld,
  updateCurrentWorldState,
} from '../../serialization/CampaignSave'
import { loadPregeneratedInteriorBlueprint } from '../../serialization/MapBlueprintLoader'
import { serializeGame } from '../../serialization/SaveSerializer'
import { BuildingInteriorTransition } from '../../ui/BuildingInteriorTransition'
import type { GameContextLike } from '../../types/context'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import type { RuntimeCell, RuntimeMap } from '../../types/map'
import type { CampaignSave, GameConfig, PlayerSetupConfig, SerializedSave } from '../../types/save'
import type { MapBlueprint, ProgressCallback } from '../../classes/map/MapGeneration'
import {
  extractPortalParty,
  withFogEnabledState,
  worldStateWithCampaignClock,
  type PortalPartyState,
} from './GameStateHelpers'
import { applyPortalPartyToRuntime, runtimeHeroUnit, type PortalTravelGame } from './GamePortalTravel'

type InteriorRuntimeMap = RuntimeMap & {
  _flushFogQueue(): void
  _initFogChunks(): void
  bakeTerrainToChunks(): void
  generateFromBlueprint(blueprint: MapBlueprint, options?: { onProgress?: ProgressCallback }): Promise<void>
  generatePlayers(playersConfig?: PlayerSetupConfig[] | null): GameContextLike['players']
  noAI?: boolean
  playersPos?: Array<{ i: number; j: number } | null>
  rebuildTerrainAppearance(): void
}

type BuildingInteriorHeroInvincibility = {
  hero: UnitEntity
  previousDevInvincible?: boolean
}

export type BuildingInteriorTravelGame = {
  _campaignSave: CampaignSave | null
  _isRestarting: boolean
  _loadingScreen?: { destroy?(): void } | BuildingInteriorTransition | null
  _restartSaveData: CampaignSave | null
  context: {
    controls?: GameContextLike['controls'] | null
    menu?: (GameContextLike['menu'] & { show?(): void }) | null
    player?: GameContextLike['player'] | null
    players?: GameContextLike['players']
  }
  _applyMapConfig(map: RuntimeMap, config?: GameConfig): void
  _autosaveCampaign(): void
  _bootFromConfig(config: GameConfig, options?: { dayNightElapsedMs?: number | null }): Promise<void>
  _bootFromSave(json: SerializedSave): Promise<void>
  _createRuntime(): void
  _createUiRuntime(): void
  _destroyRuntime(options?: { preserveLoadingScreen?: boolean }): void
  _gameContext(): GameContextLike
  _map(): InteriorRuntimeMap
  _mountRuntime(dayNightElapsedMs?: number | null): void
  _updateLoading(messageKey: string, progress: number): Promise<void>
}

function protectBuildingInteriorHero(hero: UnitEntity | null): BuildingInteriorHeroInvincibility | null {
  if (!hero) return null
  const previousDevInvincible = hero.devInvincible
  hero.devInvincible = true
  return { hero, previousDevInvincible }
}

function restoreBuildingInteriorHeroProtection(protection: BuildingInteriorHeroInvincibility | null): void {
  if (!protection) return
  if (protection.previousDevInvincible === undefined) {
    delete protection.hero.devInvincible
  } else {
    protection.hero.devInvincible = protection.previousDevInvincible
  }
}

function playerSetupFromRuntime(player: GameContextLike['player']): PlayerSetupConfig {
  return {
    civ: player.civ,
    color: player.color,
    factionId: player.factionId ?? null,
    gender: player.gender,
    heroAppearance: player.heroAppearance,
    isHuman: true,
    name: player.name,
    team: player.team ?? null,
  }
}

function getInteriorWorldId(currentWorldId: string | null | undefined, building: BuildingEntity): string {
  const parentId = currentWorldId || 'world'
  const buildingId = building.label || `${building.i}-${building.j}-${building.type}`
  return `${parentId}-interior-${building.type}-${buildingId}`.replace(/[^a-zA-Z0-9_-]/g, '-')
}

function findInteriorArrivalCell(game: BuildingInteriorTravelGame): RuntimeCell | null {
  const map = game._gameContext().map as RuntimeMap & { playersPos?: Array<{ i: number; j: number } | null> }
  const spawn = map.playersPos?.find((pos): pos is { i: number; j: number } =>
    Boolean(pos && Number.isFinite(pos.i) && Number.isFinite(pos.j))
  )
  if (spawn) return map.grid[spawn.i]?.[spawn.j] ?? null
  const center = Math.round(map.size / 2)
  return map.grid[center]?.[center] ?? null
}

async function bootInteriorBlueprintWorld(
  game: BuildingInteriorTravelGame,
  building: BuildingEntity,
  sourceState: SerializedSave,
  party: PortalPartyState,
  now: number,
  equippedItem: GameContextLike['controls']['equippedItem'] = null
): Promise<{
  heroProtection: BuildingInteriorHeroInvincibility | null
  state: SerializedSave
}> {
  const sourceConfig = sourceState.config ?? {}
  const sourcePlayer = game._gameContext().player
  game._destroyRuntime({ preserveLoadingScreen: true })
  game._createRuntime()
  const map = game._map()
  game._applyMapConfig(map, {
    ...sourceConfig,
    humanStartsWithoutBase: true,
    mapType: 'interior',
    players: [playerSetupFromRuntime(sourcePlayer)],
    portalEncounter: undefined,
    revealEverything: false,
    revealTerrain: false,
    size: 15,
  })
  map.noAI = true
  game._createUiRuntime()

  const blueprint = await loadPregeneratedInteriorBlueprint({
    interiorType: building.type,
    random: () => map.random(),
  })
  await map.generateFromBlueprint(blueprint, {
    onProgress: (messageKey: string, progress: number) => game._updateLoading(messageKey, progress),
  })
  map.pregeneratedBlueprintId = blueprint.id
  map.mapType = 'interior'
  game.context.players = map.generatePlayers([playerSetupFromRuntime(sourcePlayer)])
  game.context.player = game.context.players[0] ?? null
  game.context.menu?.init?.()
  const arrivalCell = findInteriorArrivalCell(game)
  if (arrivalCell)
    game.context.player?.createUnit?.({ i: arrivalCell.i, j: arrivalCell.j, type: party.hero?.type || 'Hero' })
  await preloadBakedLpcUnitsForPlayers(game.context.players)
  await game._updateLoading('generatingTerrain', 0.64)
  map.gaia = null
  map.rebuildTerrainAppearance()
  map._initFogChunks()
  if (!map.revealEverything) {
    for (let i = 0; i <= map.size; i++) {
      for (let j = 0; j <= map.size; j++) {
        map.grid[i][j].setFog()
      }
    }
  }
  map._flushFogQueue()
  map.bakeTerrainToChunks()
  map.ready = true
  game.context.controls?.init?.()
  game._mountRuntime(sourceState.runtime?.dayNightElapsedMs)
  applyPortalPartyToRuntime(game as PortalTravelGame, party, findInteriorArrivalCell(game), {
    equippedItem,
    freshWorld: true,
  })
  const arrivalHero = runtimeHeroUnit(game as PortalTravelGame)
  const state = withFogEnabledState(serializeGame(game._gameContext()))
  return {
    heroProtection: protectBuildingInteriorHero(arrivalHero),
    state,
  }
}

async function bootExistingInteriorWorld(
  game: BuildingInteriorTravelGame,
  campaign: CampaignSave,
  worldState: SerializedSave,
  party: PortalPartyState,
  now: number,
  equippedItem: GameContextLike['controls']['equippedItem'] = null
): Promise<{ heroProtection: BuildingInteriorHeroInvincibility | null }> {
  game._campaignSave = structuredClone(campaign)
  game._restartSaveData = structuredClone(campaign)
  game._destroyRuntime({ preserveLoadingScreen: true })
  await game._bootFromSave(withFogEnabledState(structuredClone(worldState)))
  game._map().revealEverything = false
  applyPortalPartyToRuntime(game as PortalTravelGame, party, findInteriorArrivalCell(game), { equippedItem })
  const arrivalHero = runtimeHeroUnit(game as PortalTravelGame)
  const targetState = withFogEnabledState(serializeGame(game._gameContext()))
  const committedCampaign = updateCurrentWorldState(campaign, targetState, now)
  game._campaignSave = structuredClone(committedCampaign)
  game._restartSaveData = structuredClone(committedCampaign)
  game._autosaveCampaign()
  return {
    heroProtection: protectBuildingInteriorHero(arrivalHero),
  }
}

export async function travelIntoBuildingInterior(
  game: BuildingInteriorTravelGame,
  building: BuildingEntity
): Promise<void> {
  if (game._isRestarting || building.type !== BUILDING_TYPES.townCenter || !building.isBuilt) return
  game._isRestarting = true
  let departureHeroProtection: BuildingInteriorHeroInvincibility | null = null
  let arrivalHeroProtection: BuildingInteriorHeroInvincibility | null = null
  const now = Date.now()
  const currentWorldState = withFogEnabledState(serializeGame(game._gameContext()))
  const party = extractPortalParty(currentWorldState)
  const previousEquippedItem = game._gameContext().controls.equippedItem ?? null
  const departureHero = runtimeHeroUnit(game as PortalTravelGame)
  const campaign = game._campaignSave
    ? updateCurrentWorldState(game._campaignSave, currentWorldState, now)
    : createInitialCampaignSave(currentWorldState, { now })
  const targetWorldId = getInteriorWorldId(campaign.currentWorldId, building)
  const existingTarget = campaign.worlds[targetWorldId]
  const transition = new BuildingInteriorTransition()
  game._loadingScreen = transition

  try {
    departureHeroProtection = protectBuildingInteriorHero(departureHero)
    await transition.playDeparture()
    transition.update('generatingWorld', 0.02)

    if (existingTarget) {
      const nextCampaign = enterCampaignWorld(campaign, targetWorldId, now)
      const targetState = worldStateWithCampaignClock(
        structuredClone(existingTarget.state),
        nextCampaign.clock?.dayNightElapsedMs
      )
      const arrival = await bootExistingInteriorWorld(game, nextCampaign, targetState, party, now, previousEquippedItem)
      arrivalHeroProtection = arrival.heroProtection
    } else {
      const parentWorldId = campaign.currentWorldId
      const arrival = await bootInteriorBlueprintWorld(
        game,
        building,
        currentWorldState,
        party,
        now,
        previousEquippedItem
      )
      arrivalHeroProtection = arrival.heroProtection
      const nextCampaign = addChildWorldToCampaign(campaign, arrival.state, {
        color: 'neutral',
        entryPortalId: building.label || `${building.i},${building.j}`,
        name: `Interieur ${building.type}`,
        now,
        parentWorldId,
        worldId: targetWorldId,
      })
      game._campaignSave = structuredClone(nextCampaign)
      game._restartSaveData = structuredClone(nextCampaign)
      game._autosaveCampaign()
    }
    game.context.menu?.show?.()
  } finally {
    const loadingScreen = game._loadingScreen
    if (loadingScreen instanceof BuildingInteriorTransition) await loadingScreen.finish()
    else loadingScreen?.destroy?.()
    restoreBuildingInteriorHeroProtection(arrivalHeroProtection)
    restoreBuildingInteriorHeroProtection(departureHeroProtection)
    game._loadingScreen = null
    game._isRestarting = false
  }
}
