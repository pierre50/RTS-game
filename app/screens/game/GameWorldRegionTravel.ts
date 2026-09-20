import { isChiefUnit } from '../../lib/chief'
import { advanceCampaignEconomy } from '../../services/world/WorldEconomy'
import { economyRulesFor } from '../../services/world/WorldEconomyRuntime'
import { t } from '../../lib/lang'
import type { Container } from 'pixi.js'
import { isOutsideSpaceId } from '../../lib/mapSpaces'
import { blueprintToLocalGrid } from '../../lib/localMapLayout'
import {
  addChildWorldToCampaign,
  createInitialCampaignSave,
  enterCampaignWorld,
  updateCurrentWorldState,
} from '../../serialization/CampaignSave'
import { serializeGame } from '../../serialization/SaveSerializer'
import {
  arrivalCellForRegionEdge,
  findOpenWorldTravelCell,
  worldRegionSourceSize,
  type RegionEdge,
} from '../../services/world/WorldRegionTravelSystem'
import type { GameContextLike } from '../../types/context'
import type { RuntimeCell, RuntimeMap } from '../../types/map'
import type { CampaignSave, CampaignWorldSave, GameConfig, SaveRecord, SerializedSave } from '../../types/save'
import { playBuildingInteriorDoorTransition } from '../../ui/BuildingInteriorTransition'
import { applyTravelPartyToRuntime, extractTravelParty, runtimeHeroUnit, type TravelPartyGame } from './GameTravelParty'

type RuntimeMapInstance = RuntimeMap & {
  destroy(options?: Parameters<Container['destroy']>[0]): void
}

export type WorldMapDebugTeleportTarget = { worldI: number; worldJ: number; worldRegionId: string }

export type WorldRegionTravelGame = TravelPartyGame & {
  _campaignSave: CampaignSave | null
  _restartSaveData: SaveRecord | null
  _worldRegionTransitioning: boolean
  config: GameConfig | null
  context: {
    controls?: GameContextLike['controls'] | null
    dayNight?: GameContextLike['dayNight'] | null
    map?: RuntimeMapInstance | null
    menu?: GameContextLike['menu'] | null
    player?: GameContextLike['player'] | null
    weather?: GameContextLike['weather'] | null
  }
  _refreshSceneLighting?(): void
  _autosaveCampaign(): void
  _bootFromConfig(config: GameConfig, options?: { dayNightElapsedMs?: number | null }): Promise<void>
  _bootFromSave(json: SerializedSave): Promise<void>
  _destroyRuntime(options?: { preserveLoadingScreen?: boolean }): void
  _gameContext(): GameContextLike
  _loadRequiredWorldMapBlueprint(options: {
    playerCiv?: string | null
    size?: number
    worldId: string
    worldRegionId?: string
  }): Promise<unknown>
  _map(): RuntimeMapInstance
  togglePause?(paused: boolean, options?: { silent?: boolean }): void
}

function worldRegionTravelConfig(snapshot: SerializedSave, worldRegionId: string, sourceSize: number): GameConfig {
  return {
    ...snapshot.config,
    size: sourceSize,
    localGridLayout: undefined,
    heroOnlyStart: true,
    players: snapshot.players.map(player => ({
      civ: player.civ,
      color: player.color,
      factionId: player.factionId,
      gender: player.gender,
      heroAppearance: player.heroAppearance,
      isHuman: Boolean(player.isPlayed),
      name: player.name,
      team: player.team,
    })),
    worldId: snapshot.world?.worldId ?? snapshot.config?.worldId,
    worldRegionId,
  }
}

function savedWorldForRegion(campaign: CampaignSave | null, worldRegionId: string): CampaignWorldSave | null {
  if (!campaign) return null
  const matchesRegion = (world: CampaignWorldSave | undefined) =>
    (world?.state.world?.worldRegionId ?? world?.state.config?.worldRegionId) === worldRegionId
  const root = campaign.worlds[campaign.worldGraph.rootWorldId]
  // The starting region uses a seed-based campaign id. Prefer its original state
  // over a fresh duplicate created by older region-id-only lookups.
  if (root && matchesRegion(root)) return root
  return campaign.worlds[worldRegionId] ?? Object.values(campaign.worlds).find(matchesRegion) ?? null
}

function savedWorldStateForTravel(
  campaign: CampaignSave | null,
  worldRegionId: string,
  snapshot: SerializedSave,
  dayNightElapsedMs: number | null
): SerializedSave | null {
  const savedWorld = savedWorldForRegion(campaign, worldRegionId)
  const state = savedWorld?.state
  if (!state) return null
  const nextState = structuredClone(state)
  const fromElapsedMs = state.runtime?.dayNightElapsedMs ?? savedWorld?.visitedDayNightElapsedMs
  const weather = snapshot.runtime?.weather ?? null
  if (dayNightElapsedMs != null || weather) {
    nextState.runtime = {
      ...(nextState.runtime ?? {}),
      ...(dayNightElapsedMs != null ? { dayNightElapsedMs } : {}),
      ...(fromElapsedMs != null && dayNightElapsedMs != null && dayNightElapsedMs > fromElapsedMs
        ? { offlineFromElapsedMs: fromElapsedMs }
        : {}),
      ...(weather ? { weather: structuredClone(weather) } : {}),
    }
  }
  return nextState
}

function focusTravelHero(game: WorldRegionTravelGame): void {
  const hero = runtimeHeroUnit(game)
  if (!hero) return
  game.context.controls?.focusHeroCamera?.()
  game.context.menu?.updateHeroStatus?.(hero)
}

function finishWorldRegionArrival(
  game: WorldRegionTravelGame,
  previousCampaign: CampaignSave | null,
  departureState: SerializedSave,
  worldRegionId: string
): void {
  if (departureState.runtime?.heroEquippedItem !== undefined) {
    game.context.controls?.setEquippedItem?.(departureState.runtime.heroEquippedItem)
  }
  focusTravelHero(game)
  const arrivedState = serializeGame(game._gameContext())
  const baseCampaign = previousCampaign ?? createInitialCampaignSave(departureState)
  const savedWorld = savedWorldForRegion(baseCampaign, worldRegionId)
  game._campaignSave = savedWorld
    ? updateCurrentWorldState(enterCampaignWorld(baseCampaign, savedWorld.id), arrivedState)
    : addChildWorldToCampaign(baseCampaign, arrivedState, {
        kind: 'world',
        name: worldRegionId,
        parentWorldId: baseCampaign.currentWorldId,
        worldId: worldRegionId,
      })
  game._gameContext().updateWorldEconomy?.()
  game._restartSaveData = structuredClone(game._campaignSave)
  ;(game.context.menu as { show?: () => void } | null | undefined)?.show?.()
  game.context.menu?.refreshMiniMap?.()
  game._autosaveCampaign()
}

async function bootWorldRegionForTravel(
  game: WorldRegionTravelGame,
  snapshot: SerializedSave,
  worldRegionId: string,
  dayNightElapsedMs: number | null
): Promise<{ freshWorld: boolean }> {
  const nextConfig = worldRegionTravelConfig(snapshot, worldRegionId, worldRegionSourceSize(game._map()))
  if (game._campaignSave?.economy && dayNightElapsedMs != null)
    advanceCampaignEconomy(game._campaignSave, dayNightElapsedMs, game.context.map?.worldRegionId ?? undefined, economyRulesFor)
  const savedState = savedWorldStateForTravel(game._campaignSave, worldRegionId, snapshot, dayNightElapsedMs)
  game._destroyRuntime({ preserveLoadingScreen: true })
  if (savedState) {
    const simulatedAbsence = savedState.runtime?.offlineFromElapsedMs != null
    game.config = savedState.config ?? nextConfig
    await game._bootFromSave(savedState)
    if (simulatedAbsence) game._gameContext().unitRest?.synchronizeAfterTimeJump?.()
    return { freshWorld: false }
  }
  game.config = nextConfig
  await game._bootFromConfig(nextConfig, { dayNightElapsedMs })
  game.context.weather?.applyState?.(snapshot.runtime?.weather)
  return { freshWorld: true }
}

function findDebugTeleportCell(game: WorldRegionTravelGame, worldI: number, worldJ: number): RuntimeCell | null {
  const map = game._map()
  const region = map.worldRegion
  const regionMapSize = worldRegionSourceSize(map)
  const targetI = Math.round(worldI - (region?.y ?? 0) * regionMapSize)
  const targetJ = Math.round(worldJ - (region?.x ?? 0) * regionMapSize)
  if (map.localGridLayout) {
    const start = blueprintToLocalGrid(
      Math.max(0, Math.min(regionMapSize, targetI)),
      Math.max(0, Math.min(regionMapSize, targetJ)),
      map.localGridLayout
    )
    return findOpenWorldTravelCell(map, start, Math.max(map.localGridLayout.columns, map.localGridLayout.rows), 2)
  }
  const inset = 1
  const start = {
    i: Math.max(inset, Math.min(map.size - inset, targetI)),
    j: Math.max(inset, Math.min(map.size - inset, targetJ)),
  }
  return findOpenWorldTravelCell(map, start, Math.max(8, Math.ceil(map.size / 2)), inset)
}

export async function preloadWorldRegion(game: WorldRegionTravelGame, worldRegionId: string): Promise<void> {
  const map = game.context.map
  if (!map?.worldId) return
  await game._loadRequiredWorldMapBlueprint({
    playerCiv: game.context.player?.civ,
    size: worldRegionSourceSize(map),
    worldId: map.worldId,
    worldRegionId,
  })
}

async function withWorldRegionTransition(game: WorldRegionTravelGame, travel: () => Promise<void>): Promise<void> {
  const releaseMovement = game.context.controls?.captureMovementInput?.()
  game._worldRegionTransitioning = true
  try {
    game.context.controls?.setRuntimeInputEnabled?.(false)
    game.togglePause?.(true, { silent: true })
    await playBuildingInteriorDoorTransition(travel, {
      blockInput: true,
      beforeReveal: () => {
        game._refreshSceneLighting?.()
        game._gameContext().app.render()
      },
    })
  } finally {
    const heldMovement = releaseMovement?.()
    game._worldRegionTransitioning = false
    if (game.context.map && game.context.map.ready !== false) {
      game.togglePause?.(false, { silent: true })
      game.context.controls?.setRuntimeInputEnabled?.(true)
      if (heldMovement) game.context.controls?.restoreMovementInput?.(heldMovement)
    }
  }
}

async function changeWorldRegion(
  game: WorldRegionTravelGame,
  snapshot: SerializedSave,
  previousCampaign: CampaignSave | null,
  worldRegionId: string,
  dayNightElapsedMs: number | null,
  arrive: (freshWorld: boolean) => void
): Promise<void> {
  const freeCamera = game.context.controls?.freeCameraActive ?? false
  let bootAttempted = false
  await withWorldRegionTransition(game, async () => {
    try {
      await preloadWorldRegion(game, worldRegionId)
      game.togglePause?.(false, { silent: true })
      bootAttempted = true
      const { freshWorld } = await bootWorldRegionForTravel(game, snapshot, worldRegionId, dayNightElapsedMs)
      game.togglePause?.(true, { silent: true })
      game.context.controls?.setRuntimeInputEnabled?.(false)
      game.context.controls?.setFreeCamera?.(freeCamera)
      arrive(freshWorld)
    } catch (error) {
      if (bootAttempted) {
        try {
          game._destroyRuntime({ preserveLoadingScreen: true })
          game.config = snapshot.config ?? null
          await game._bootFromSave(snapshot)
          game.context.controls?.setFreeCamera?.(freeCamera)
          game._campaignSave = previousCampaign
          game._restartSaveData = previousCampaign ? structuredClone(previousCampaign) : snapshot
          ;(game.context.menu as { show?: () => void } | null | undefined)?.show?.()
          game._autosaveCampaign()
        } catch (restoreError) {
          if (game.context.map) game.context.map.ready = false
          throw new AggregateError([error, restoreError], 'World region load and restoration failed')
        }
      }
      throw error
    }
  })
}

export async function travelToWorldRegion(
  game: WorldRegionTravelGame,
  worldRegionId: string,
  edge: RegionEdge
): Promise<void> {
  if (game._worldRegionTransitioning) return
  const context = game._gameContext()
  const hero = runtimeHeroUnit(game)
  if (hero && !isOutsideSpaceId(hero.spaceId)) return
  if (!isChiefUnit(hero)) {
    context.menu?.showMessage?.(t('heroCannotLeaveMapYet'), 'warning')
    return
  }
  const previousCell = {
    i: hero?.i ?? Math.floor(context.map.size / 2),
    j: hero?.j ?? Math.floor(context.map.size / 2),
  }
  const previousLayout = context.map.localGridLayout
  const dayNightElapsedMs = context.dayNight?.getElapsedMs?.() ?? null
  const snapshot = serializeGame(context)
  const party = extractTravelParty(snapshot)
  const previousCampaign = game._campaignSave ? updateCurrentWorldState(game._campaignSave, snapshot) : null
  await changeWorldRegion(game, snapshot, previousCampaign, worldRegionId, dayNightElapsedMs, freshWorld => {
    const arrivalMap = game._map()
    const departureCell =
      !previousLayout && arrivalMap.localGridLayout
        ? blueprintToLocalGrid(previousCell.i, previousCell.j, arrivalMap.localGridLayout)
        : previousCell
    const arrivalCell = arrivalCellForRegionEdge(arrivalMap, edge, departureCell, previousLayout)
    applyTravelPartyToRuntime(game, party, arrivalCell, { freshWorld })
    finishWorldRegionArrival(game, previousCampaign, snapshot, worldRegionId)
  })
}

export async function debugTeleportWorldMap(
  game: WorldRegionTravelGame,
  { worldI, worldJ, worldRegionId }: WorldMapDebugTeleportTarget
): Promise<void> {
  if (game._worldRegionTransitioning) return
  const context = game._gameContext()
  if (!context.map.worldId || context.map.mapType === 'interior') return
  const hero = runtimeHeroUnit(game)
  if (hero && !isOutsideSpaceId(hero.spaceId)) return
  const snapshot = serializeGame(context)
  const party = extractTravelParty(snapshot)
  const currentRegionId = context.map.worldRegionId ?? null
  if (currentRegionId === worldRegionId) {
    const cell = findDebugTeleportCell(game, worldI, worldJ)
    if (!cell) {
      context.menu?.showMessage?.('Aucune cellule libre ici.', 'error')
      return
    }
    await withWorldRegionTransition(game, async () => {
      applyTravelPartyToRuntime(game, party, cell)
      if (snapshot.runtime?.heroEquippedItem !== undefined) {
        game.context.controls?.setEquippedItem?.(snapshot.runtime.heroEquippedItem)
      }
      focusTravelHero(game)
      context.menu?.refreshMiniMap?.()
      if (game._campaignSave)
        game._campaignSave = updateCurrentWorldState(game._campaignSave, serializeGame(game._gameContext()))
      game._restartSaveData = game._campaignSave ? structuredClone(game._campaignSave) : game._restartSaveData
      game._autosaveCampaign()
    })
    return
  }

  const dayNightElapsedMs = context.dayNight?.getElapsedMs?.() ?? null
  const previousCampaign = game._campaignSave ? updateCurrentWorldState(game._campaignSave, snapshot) : null

  await changeWorldRegion(game, snapshot, previousCampaign, worldRegionId, dayNightElapsedMs, freshWorld => {
    const cell = findDebugTeleportCell(game, worldI, worldJ)
    applyTravelPartyToRuntime(game, party, cell, { freshWorld })
    finishWorldRegionArrival(game, previousCampaign, snapshot, worldRegionId)
  })
}
