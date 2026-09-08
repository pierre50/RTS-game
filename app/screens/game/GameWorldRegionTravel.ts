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
import type { CampaignSave, GameConfig, SaveRecord, SerializedSave } from '../../types/save'
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

function savedWorldStateForTravel(
  campaign: CampaignSave | null,
  worldRegionId: string,
  snapshot: SerializedSave,
  dayNightElapsedMs: number | null
): SerializedSave | null {
  const state = campaign?.worlds[worldRegionId]?.state
  if (!state) return null
  const nextState = structuredClone(state)
  const weather = snapshot.runtime?.weather ?? null
  if (dayNightElapsedMs != null || weather) {
    nextState.runtime = {
      ...(nextState.runtime ?? {}),
      ...(dayNightElapsedMs != null ? { dayNightElapsedMs } : {}),
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
  focusTravelHero(game)
  const arrivedState = serializeGame(game._gameContext())
  const baseCampaign = previousCampaign ?? createInitialCampaignSave(departureState)
  game._campaignSave = baseCampaign.worlds[worldRegionId]
    ? updateCurrentWorldState(enterCampaignWorld(baseCampaign, worldRegionId), arrivedState)
    : addChildWorldToCampaign(baseCampaign, arrivedState, {
        kind: 'world',
        name: worldRegionId,
        parentWorldId: baseCampaign.currentWorldId,
        worldId: worldRegionId,
      })
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
  const savedState = savedWorldStateForTravel(game._campaignSave, worldRegionId, snapshot, dayNightElapsedMs)
  game._destroyRuntime({ preserveLoadingScreen: true })
  if (savedState) {
    game.config = savedState.config ?? nextConfig
    await game._bootFromSave(savedState)
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
      beforeReveal: () => game._gameContext().app.render(),
    })
  } finally {
    const heldMovement = releaseMovement?.()
    game.togglePause?.(false, { silent: true })
    game.context.controls?.setRuntimeInputEnabled?.(true)
    if (heldMovement) game.context.controls?.restoreMovementInput?.(heldMovement)
    game._worldRegionTransitioning = false
  }
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
  const previousCell = {
    i: hero?.i ?? Math.floor(context.map.size / 2),
    j: hero?.j ?? Math.floor(context.map.size / 2),
  }
  const previousLayout = context.map.localGridLayout
  const dayNightElapsedMs = context.dayNight?.getElapsedMs?.() ?? null
  const snapshot = serializeGame(context)
  const party = extractTravelParty(snapshot)
  const previousCampaign = game._campaignSave ? updateCurrentWorldState(game._campaignSave, snapshot) : null
  const previousFreeCamera = context.controls?.freeCameraActive ?? false
  const pursuers = collectWorldPursuers(context, snapshot, party)
  const departureState = removeWorldPursuers(snapshot, pursuers)
  const departureCampaign = game._campaignSave ? updateCurrentWorldState(game._campaignSave, departureState) : null
  let bootAttempted = false
  await withWorldRegionTransition(game, async () => {
    try {
      await preloadWorldRegion(game, worldRegionId)
      bootAttempted = true
      game.togglePause?.(false, { silent: true })
      const { freshWorld } = await bootWorldRegionForTravel(game, snapshot, worldRegionId, dayNightElapsedMs)
      game.togglePause?.(true, { silent: true })
      game.context.controls?.setRuntimeInputEnabled?.(false)
      game.context.controls?.setFreeCamera?.(previousFreeCamera)
      const arrivalMap = game._map()
      const departureCell =
        !previousLayout && arrivalMap.localGridLayout
          ? blueprintToLocalGrid(previousCell.i, previousCell.j, arrivalMap.localGridLayout)
          : previousCell
      const arrivalCell = arrivalCellForRegionEdge(arrivalMap, edge, departureCell, previousLayout)
      applyTravelPartyToRuntime(game, party, arrivalCell, { freshWorld })
      if (pursuers.length) {
        if (!arrivalCell) throw new Error('No arrival cell for world pursuers')
        const pursuit = game._gameContext().worldPursuit
        if (!pursuit) throw new Error('World pursuit runtime is unavailable')
        pursuit.enqueue(
          pursuers.map(pursuer => ({
            ...pursuer,
            targetLabel:
              pursuer.targetLabel === party.hero?.label
                ? (runtimeHeroUnit(game)?.label ?? pursuer.targetLabel)
                : pursuer.targetLabel,
            arrival: { i: arrivalCell.i, j: arrivalCell.j },
            remainingMs: 3000,
          }))
        )
      }
      finishWorldRegionArrival(game, departureCampaign, departureState, worldRegionId)
    } catch (error) {
      if (bootAttempted) {
        game.togglePause?.(false, { silent: true })
        game._destroyRuntime({ preserveLoadingScreen: true })
        game.config = snapshot.config ?? null
        await game._bootFromSave(snapshot)
        game._campaignSave = previousCampaign
        game._restartSaveData = previousCampaign ? structuredClone(previousCampaign) : snapshot
        ;(game.context.menu as { show?: () => void } | null | undefined)?.show?.()
        game._autosaveCampaign()
      }
      throw error
    }
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

  await withWorldRegionTransition(game, async () => {
    const { freshWorld } = await bootWorldRegionForTravel(game, snapshot, worldRegionId, dayNightElapsedMs)
    const cell = findDebugTeleportCell(game, worldI, worldJ)
    applyTravelPartyToRuntime(game, party, cell, { freshWorld })
    finishWorldRegionArrival(game, previousCampaign, snapshot, worldRegionId)
  })
}
import { collectWorldPursuers, removeWorldPursuers } from './GameWorldPursuers'
