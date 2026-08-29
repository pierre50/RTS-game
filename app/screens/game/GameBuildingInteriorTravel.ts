import {
  getBuildingInteriorPortalId,
  isBuildingInteriorSupported,
} from '../../lib/buildings/interiors'
import {
  createInitialCampaignSave,
  getCurrentWorldState,
  returnToParentWorld,
  updateCurrentWorldState,
} from '../../serialization/CampaignSave'
import { serializeGame } from '../../serialization/SaveSerializer'
import { BuildingInteriorTransition } from '../../ui/BuildingInteriorTransition'
import type { GameContextLike } from '../../types/context'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import type { CampaignSave, SerializedSave } from '../../types/save'
import {
  extractPortalParty,
  withFogEnabledState,
  worldStateWithCampaignClock,
  type PortalPartyState,
} from './GameStateHelpers'
import {
  applyPortalPartyToRuntime,
  runtimeHeroUnit,
  type PortalTravelGame,
} from './GamePortalTravel'
import {
  removeBuildingInteriorOccupants,
  type BuildingInteriorOccupantState,
} from './BuildingInteriorOccupants'
import {
  buildSessionParentStateFromInterior,
  commitBuildingInteriorCampaign,
  extractInteriorReturnOccupants,
  findBuildingInteriorParentArrivalCell,
  mergeInteriorReturnOccupantsIntoParentState,
  placeParentDoorOccupants,
  uniqueInteriorOccupants,
  updateCampaignWorldState,
} from './BuildingInteriorReturnState'
import type { BuildingInteriorSession, BuildingInteriorTravelGame } from './BuildingInteriorTravelTypes'

export { buildBuildingInteriorSessionSaveRecord } from './BuildingInteriorReturnState'
export { routeInteriorUnitToExit, synchronizeInteriorOccupantsAfterTimeJump } from './BuildingInteriorExitRouting'
export type { BuildingInteriorSession, BuildingInteriorTravelGame } from './BuildingInteriorTravelTypes'

type BuildingInteriorHeroInvincibility = {
  hero: UnitEntity
  previousDevInvincible?: boolean
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

function getInteriorWorldId(currentWorldId: string | null | undefined, building: BuildingEntity): string {
  const parentId = currentWorldId || 'world'
  const buildingId = getBuildingInteriorPortalId(building)
  return `${parentId}-interior-${building.type}-${buildingId}`.replace(/[^a-zA-Z0-9_-]/g, '-')
}

function getLegacyInteriorWorldId(currentWorldId: string | null | undefined, building: BuildingEntity): string {
  const parentId = currentWorldId || 'world'
  const buildingId = building.label || `${building.i}-${building.j}-${building.type}`
  return `${parentId}-interior-${building.type}-${buildingId}`.replace(/[^a-zA-Z0-9_-]/g, '-')
}

function removeCampaignWorlds(campaign: CampaignSave, worldIds: Array<string | null | undefined>): CampaignSave {
  const removableWorldIds = new Set(
    worldIds.filter((worldId): worldId is string =>
      Boolean(worldId && worldId !== campaign.currentWorldId && campaign.worlds[worldId])
    )
  )
  if (!removableWorldIds.size) return campaign

  const worlds = { ...campaign.worlds }
  for (const worldId of removableWorldIds) delete worlds[worldId]

  if (!campaign.worldGraph) return { ...campaign, worlds }

  const nodes = Object.fromEntries(
    Object.entries(campaign.worldGraph.nodes)
      .filter(([worldId]) => !removableWorldIds.has(worldId))
      .map(([worldId, node]) => [
        worldId,
        {
          ...node,
          children: node.children.filter(childId => !removableWorldIds.has(childId)),
        },
      ])
  )

  return {
    ...campaign,
    worlds,
    worldGraph: {
      ...campaign.worldGraph,
      nodes,
    },
  }
}

function saveRuntimeToCurrentCampaign(
  game: BuildingInteriorTravelGame,
  campaign: CampaignSave,
  now: number
): CampaignSave {
  const state = withFogEnabledState(serializeGame(game._gameContext()))
  return updateCurrentWorldState(campaign, state, now)
}

async function bootBuildingInteriorParentWorld(
  game: BuildingInteriorTravelGame,
  campaign: CampaignSave,
  worldState: SerializedSave,
  party: PortalPartyState,
  entryPortalId: string | null | undefined,
  now: number,
  equippedItem: GameContextLike['controls']['equippedItem'] = null,
  returningOccupants: BuildingInteriorOccupantState[] = []
): Promise<{ heroProtection: BuildingInteriorHeroInvincibility | null }> {
  game._campaignSave = structuredClone(campaign)
  game._restartSaveData = structuredClone(campaign)
  game._destroyRuntime({ preserveLoadingScreen: true })
  await game._bootFromSave(withFogEnabledState(structuredClone(worldState)))
  const arrivalCell = findBuildingInteriorParentArrivalCell(game, entryPortalId)
  placeParentDoorOccupants(game, party, returningOccupants, arrivalCell)
  applyPortalPartyToRuntime(game as PortalTravelGame, party, arrivalCell, { equippedItem })
  const arrivalHero = runtimeHeroUnit(game as PortalTravelGame)
  commitBuildingInteriorCampaign(game, saveRuntimeToCurrentCampaign(game, campaign, now))
  return {
    heroProtection: protectBuildingInteriorHero(arrivalHero),
  }
}

export async function travelIntoBuildingInterior(
  game: BuildingInteriorTravelGame,
  building: BuildingEntity
): Promise<void> {
  if (game._isRestarting || !isBuildingInteriorSupported(building)) return
  if (!game._openBuildingInteriorLayer) return
  const now = Date.now()
  game._isRestarting = true
  try {
    const currentWorldState = withFogEnabledState(serializeGame(game._gameContext()))
    const baseCampaign = game._campaignSave
      ? updateCurrentWorldState(game._campaignSave, currentWorldState, now)
      : createInitialCampaignSave(currentWorldState, { now })
    const campaign = removeCampaignWorlds(baseCampaign, [
      getInteriorWorldId(baseCampaign.currentWorldId, building),
      getLegacyInteriorWorldId(baseCampaign.currentWorldId, building),
    ])
    commitBuildingInteriorCampaign(game, campaign)
    await game._openBuildingInteriorLayer(building)
  } finally {
    game._isRestarting = false
  }
}

async function travelOutOfBuildingInteriorSession(
  game: BuildingInteriorTravelGame,
  session: BuildingInteriorSession
): Promise<void> {
  game._isRestarting = true
  let departureHeroProtection: BuildingInteriorHeroInvincibility | null = null
  let arrivalHeroProtection: BuildingInteriorHeroInvincibility | null = null
  const now = Date.now()
  const currentWorldState = withFogEnabledState(serializeGame(game._gameContext()))
  const party = extractPortalParty(currentWorldState)
  const currentReturningOccupants = extractInteriorReturnOccupants(
    currentWorldState,
    party,
    game._gameContext().player?.units ?? []
  )
  const returningOccupants = uniqueInteriorOccupants(session.returnedOccupants, currentReturningOccupants)
  const parentState = worldStateWithCampaignClock(
    buildSessionParentStateFromInterior(session, currentWorldState, party, game._gameContext().player?.units ?? []),
    currentWorldState.runtime?.dayNightElapsedMs ?? session.sourceCampaign.clock?.dayNightElapsedMs
  )
  const previousEquippedItem = game._gameContext().controls.equippedItem ?? null
  const departureHero = runtimeHeroUnit(game as PortalTravelGame)
  const campaign = updateCampaignWorldState(
    game._campaignSave ?? session.sourceCampaign,
    session.sourceWorldId,
    withFogEnabledState(parentState),
    now
  )
  const transition = new BuildingInteriorTransition()
  game._loadingScreen = transition

  try {
    departureHeroProtection = protectBuildingInteriorHero(departureHero)
    await transition.playDeparture()
    transition.update('loadingSave', 0.72)
    game._buildingInteriorSession = null
    const arrival = await bootBuildingInteriorParentWorld(
      game,
      campaign,
      parentState,
      party,
      session.entryPortalId,
      now,
      previousEquippedItem,
      returningOccupants
    )
    arrivalHeroProtection = arrival.heroProtection
    game.context.menu?.show?.()
  } catch (error) {
    game._buildingInteriorSession = session
    throw error
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

export async function travelOutOfBuildingInterior(game: BuildingInteriorTravelGame): Promise<void> {
  if (game._isBuildingInteriorLayerOpen?.()) {
    const now = Date.now()
    await game._closeBuildingInteriorLayer?.()
    const currentWorldState = withFogEnabledState(serializeGame(game._gameContext()))
    const campaign = game._campaignSave
      ? updateCurrentWorldState(game._campaignSave, currentWorldState, now)
      : createInitialCampaignSave(currentWorldState, { now })
    commitBuildingInteriorCampaign(game, campaign)
    return
  }
  if (game._isRestarting || game._map().mapType !== 'interior') return
  const session = game._buildingInteriorSession
  if (session) {
    await travelOutOfBuildingInteriorSession(game, session)
    return
  }
  if (!game._campaignSave) return
  const currentCampaignWorld = game._campaignSave.worlds[game._campaignSave.currentWorldId]
  if (!currentCampaignWorld?.parentWorldId) return

  game._isRestarting = true
  let departureHeroProtection: BuildingInteriorHeroInvincibility | null = null
  let arrivalHeroProtection: BuildingInteriorHeroInvincibility | null = null
  const now = Date.now()
  const currentWorldState = withFogEnabledState(serializeGame(game._gameContext()))
  const party = extractPortalParty(currentWorldState)
  const returningOccupants = extractInteriorReturnOccupants(
    currentWorldState,
    party,
    game._gameContext().player?.units ?? []
  )
  const currentWorldStateWithoutReturningOccupants = removeBuildingInteriorOccupants(
    currentWorldState,
    returningOccupants
  )
  const previousEquippedItem = game._gameContext().controls.equippedItem ?? null
  const departureHero = runtimeHeroUnit(game as PortalTravelGame)
  const campaign = updateCurrentWorldState(game._campaignSave, currentWorldStateWithoutReturningOccupants, now)
  const entryPortalId = campaign.worlds[campaign.currentWorldId]?.entryPortalId
  const nextCampaign = returnToParentWorld(campaign, now)
  const parentState = worldStateWithCampaignClock(
    mergeInteriorReturnOccupantsIntoParentState(getCurrentWorldState(nextCampaign), returningOccupants, entryPortalId),
    nextCampaign.clock?.dayNightElapsedMs
  )
  const transition = new BuildingInteriorTransition()
  game._loadingScreen = transition

  try {
    departureHeroProtection = protectBuildingInteriorHero(departureHero)
    await transition.playDeparture()
    transition.update('loadingSave', 0.72)
    const arrival = await bootBuildingInteriorParentWorld(
      game,
      nextCampaign,
      parentState,
      party,
      entryPortalId,
      now,
      previousEquippedItem,
      returningOccupants
    )
    arrivalHeroProtection = arrival.heroProtection
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
