import { BUILDING_TYPES } from '../../constants'
import { getFreeLandCellAroundInstance } from '../../lib'
import { getBuildingInteriorEntryCell, isBuildingInteriorSupported } from '../../lib/buildings/interiors'
import { getInteriorExitCell } from '../../lib/buildings/interiorExits'
import { preloadBakedLpcUnitsForPlayers } from '../../lib/lpc'
import {
  addChildWorldToCampaign,
  createInitialCampaignSave,
  enterCampaignWorld,
  getCurrentWorldState,
  returnToParentWorld,
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
import {
  addInteriorOccupantsToRuntime,
  extractBuildingInteriorOccupants,
  extractBuildingInteriorSleepArrivals,
  removeBuildingInteriorOccupants,
  scheduleInteriorSleepArrivals,
  type BuildingInteriorOccupantState,
} from './BuildingInteriorOccupants'

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

type BuildingWithInteriorOverride = BuildingEntity & {
  interior?: {
    type?: string
  }
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

function blueprintInteriorTypeForBuilding(building: BuildingEntity): string {
  const configuredType = (building as BuildingWithInteriorOverride).interior?.type
  if (configuredType) return configuredType
  return building.type
}

function commitBuildingInteriorCampaign(game: BuildingInteriorTravelGame, campaign: CampaignSave): void {
  game._campaignSave = structuredClone(campaign)
  game._restartSaveData = structuredClone(campaign)
  game._autosaveCampaign()
}

function saveRuntimeToCurrentCampaign(game: BuildingInteriorTravelGame, campaign: CampaignSave, now: number): CampaignSave {
  const state = withFogEnabledState(serializeGame(game._gameContext()))
  return updateCurrentWorldState(campaign, state, now)
}

function removeOccupantsFromCampaignWorld(
  campaign: CampaignSave,
  worldId: string | null | undefined,
  occupants: BuildingInteriorOccupantState[]
): CampaignSave {
  if (!worldId || !occupants.length) return campaign
  const world = campaign.worlds[worldId]
  if (!world) return campaign
  return {
    ...campaign,
    worlds: {
      ...campaign.worlds,
      [worldId]: {
        ...world,
        state: removeBuildingInteriorOccupants(world.state, occupants),
      },
    },
  }
}

function autosaveInteriorSleepArrival(
  game: BuildingInteriorTravelGame,
  occupant: BuildingInteriorOccupantState
): void {
  if (!game._campaignSave) return
  const now = Date.now()
  const currentWorld = game._campaignSave.worlds[game._campaignSave.currentWorldId]
  const withCurrentInterior = saveRuntimeToCurrentCampaign(game, game._campaignSave, now)
  const withoutParentOccupant = removeOccupantsFromCampaignWorld(withCurrentInterior, currentWorld?.parentWorldId, [occupant])
  commitBuildingInteriorCampaign(game, withoutParentOccupant)
}

function findInteriorArrivalCell(game: BuildingInteriorTravelGame): RuntimeCell | null {
  const map = game._gameContext().map as RuntimeMap & { playersPos?: Array<{ i: number; j: number } | null> }
  const exitCell = getInteriorExitCell(map)
  if (exitCell) return exitCell
  const spawn = map.playersPos?.find((pos): pos is { i: number; j: number } =>
    Boolean(pos && Number.isFinite(pos.i) && Number.isFinite(pos.j))
  )
  if (spawn) return map.grid[spawn.i]?.[spawn.j] ?? null
  const center = Math.round(map.size / 2)
  return map.grid[center]?.[center] ?? null
}

function findInteriorCenterCell(game: BuildingInteriorTravelGame): RuntimeCell | null {
  const map = game._gameContext().map
  const center = Math.round(map.size / 2)
  return map.grid[center]?.[center] ?? null
}

function canPlaceInteriorDecorationCell(cell: RuntimeCell | null | undefined): cell is RuntimeCell {
  return Boolean(cell && !cell.has && !cell.solid && !cell.border && cell.category !== 'Water' && !cell.terrainHidden)
}

function isInteriorDecorationBlockedCell(
  cell: RuntimeCell | null | undefined,
  blockedCells: Set<string>
): boolean {
  return Boolean(cell && blockedCells.has(`${cell.i}:${cell.j}`))
}

function findInteriorDecorationCell(
  game: BuildingInteriorTravelGame,
  preferred: { i: number; j: number },
  blockedCells: Set<string>
): RuntimeCell | null {
  const map = game._gameContext().map
  const directCell = map.grid[preferred.i]?.[preferred.j]
  if (canPlaceInteriorDecorationCell(directCell) && !isInteriorDecorationBlockedCell(directCell, blockedCells)) {
    return directCell
  }

  for (let radius = 1; radius <= 3; radius++) {
    for (let i = preferred.i - radius; i <= preferred.i + radius; i++) {
      for (let j = preferred.j - radius; j <= preferred.j + radius; j++) {
        const cell = map.grid[i]?.[j]
        if (canPlaceInteriorDecorationCell(cell) && !isInteriorDecorationBlockedCell(cell, blockedCells)) return cell
      }
    }
  }
  return null
}

function ensureInteriorFireCamp(game: BuildingInteriorTravelGame): BuildingEntity | null {
  const { player } = game._gameContext()
  if (!player) return null

  const existing = player.buildings.find(building => building.type === BUILDING_TYPES.fireCamp && !building.isDestroyed)
  if (existing) return existing

  const centerCell = findInteriorCenterCell(game)
  if (!centerCell || centerCell.has || centerCell.solid || centerCell.border || centerCell.category === 'Water') {
    return null
  }

  return player.createBuilding({
    i: centerCell.i,
    j: centerCell.j,
    type: BUILDING_TYPES.fireCamp,
    isBuilt: true,
    skipBuiltEffects: true,
  })
}

function interiorDecorationLayout(
  building: BuildingEntity,
  mapSize: number
): Array<{ key: string; type: string; offsetI: number; offsetJ: number }> {
  const wide = mapSize >= 15
  if (building.type === BUILDING_TYPES.house) {
    return [
      { key: 'crate-nw', type: BUILDING_TYPES.campCrate, offsetI: -2, offsetJ: -1 },
      { key: 'jar-se', type: BUILDING_TYPES.campJarSmall, offsetI: 2, offsetJ: 1 },
      { key: 'bucket-s', type: BUILDING_TYPES.campBucket, offsetI: 0, offsetJ: 2 },
    ]
  }
  return [
    { key: 'crate-nw', type: BUILDING_TYPES.campCrate, offsetI: -3, offsetJ: -2 },
    { key: 'jar-ne', type: BUILDING_TYPES.campJarLarge, offsetI: 3, offsetJ: -2 },
    { key: 'bucket-sw', type: BUILDING_TYPES.campBucket, offsetI: -3, offsetJ: 2 },
    { key: 'rock-se', type: BUILDING_TYPES.campRockPile, offsetI: 3, offsetJ: 2 },
    ...(wide ? [{ key: 'jar-s', type: BUILDING_TYPES.campJarSmall, offsetI: 0, offsetJ: 3 }] : []),
  ]
}

function ensureInteriorDecorations(game: BuildingInteriorTravelGame, sourceBuilding: BuildingEntity): void {
  const { map, player } = game._gameContext()
  if (!player) return
  const center = Math.round(map.size / 2)
  const exitCell = getInteriorExitCell(map)
  const blockedCells = new Set<string>()
  if (exitCell) blockedCells.add(`${exitCell.i}:${exitCell.j}`)

  for (const decoration of interiorDecorationLayout(sourceBuilding, map.size)) {
    const label = `interior-${sourceBuilding.type}-${decoration.key}`
    if (player.buildings.some(building => building.label === label)) continue
    const cell = findInteriorDecorationCell(game, {
      i: center + decoration.offsetI,
      j: center + decoration.offsetJ,
    }, blockedCells)
    if (!cell) continue
    player.createBuilding({
      i: cell.i,
      j: cell.j,
      label,
      type: decoration.type,
      isBuilt: true,
      skipBuiltEffects: true,
    })
  }
}

function findBuildingInteriorParentArrivalCell(
  game: BuildingInteriorTravelGame,
  entryPortalId: string | null | undefined
): RuntimeCell | null {
  const { map, player } = game._gameContext()
  const building = player.buildings.find(candidate => {
    if (!entryPortalId) return false
    if (candidate.label === entryPortalId) return true
    return entryPortalId === `${candidate.i},${candidate.j}`
  })
  if (!building) return null
  const entryCell = getBuildingInteriorEntryCell(building, map.grid)
  if (entryCell && entryCell.category !== 'Water' && !entryCell.terrainHidden && !entryCell.border) return entryCell
  return getFreeLandCellAroundInstance(building, map.grid, cells => cells[Math.floor(map.random() * cells.length)])
}

async function bootBuildingInteriorParentWorld(
  game: BuildingInteriorTravelGame,
  campaign: CampaignSave,
  worldState: SerializedSave,
  party: PortalPartyState,
  entryPortalId: string | null | undefined,
  now: number,
  equippedItem: GameContextLike['controls']['equippedItem'] = null
): Promise<{ heroProtection: BuildingInteriorHeroInvincibility | null }> {
  game._campaignSave = structuredClone(campaign)
  game._restartSaveData = structuredClone(campaign)
  game._destroyRuntime({ preserveLoadingScreen: true })
  await game._bootFromSave(withFogEnabledState(structuredClone(worldState)))
  const arrivalCell = findBuildingInteriorParentArrivalCell(game, entryPortalId)
  applyPortalPartyToRuntime(game as PortalTravelGame, party, arrivalCell, { equippedItem })
  const arrivalHero = runtimeHeroUnit(game as PortalTravelGame)
  commitBuildingInteriorCampaign(game, saveRuntimeToCurrentCampaign(game, campaign, now))
  return {
    heroProtection: protectBuildingInteriorHero(arrivalHero),
  }
}

async function bootInteriorBlueprintWorld(
  game: BuildingInteriorTravelGame,
  building: BuildingEntity,
  sourceState: SerializedSave,
  party: PortalPartyState,
  now: number,
  occupants: BuildingInteriorOccupantState[] = [],
  sleepArrivals: BuildingInteriorOccupantState[] = [],
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
    interiorType: blueprintInteriorTypeForBuilding(building),
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
  const fireCamp = ensureInteriorFireCamp(game)
  ensureInteriorDecorations(game, building)
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
  addInteriorOccupantsToRuntime(game, occupants, findInteriorArrivalCell(game) ?? fireCamp)
  scheduleInteriorSleepArrivals(game, sleepArrivals, () => findInteriorArrivalCell(game), {
    flushImmediately: false,
    onArrival: occupant => autosaveInteriorSleepArrival(game, occupant),
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
  building: BuildingEntity,
  worldState: SerializedSave,
  party: PortalPartyState,
  now: number,
  occupants: BuildingInteriorOccupantState[] = [],
  sleepArrivals: BuildingInteriorOccupantState[] = [],
  equippedItem: GameContextLike['controls']['equippedItem'] = null
): Promise<{ heroProtection: BuildingInteriorHeroInvincibility | null }> {
  game._campaignSave = structuredClone(campaign)
  game._restartSaveData = structuredClone(campaign)
  game._destroyRuntime({ preserveLoadingScreen: true })
  await game._bootFromSave(withFogEnabledState(structuredClone(worldState)))
  game._map().revealEverything = false
  applyPortalPartyToRuntime(game as PortalTravelGame, party, findInteriorArrivalCell(game), { equippedItem })
  const fireCamp = ensureInteriorFireCamp(game)
  ensureInteriorDecorations(game, building)
  addInteriorOccupantsToRuntime(game, occupants, findInteriorArrivalCell(game) ?? fireCamp)
  scheduleInteriorSleepArrivals(game, sleepArrivals, () => findInteriorArrivalCell(game), {
    flushImmediately: false,
    onArrival: occupant => autosaveInteriorSleepArrival(game, occupant),
  })
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
  game._isRestarting = true
  let departureHeroProtection: BuildingInteriorHeroInvincibility | null = null
  let arrivalHeroProtection: BuildingInteriorHeroInvincibility | null = null
  const now = Date.now()
  const currentWorldState = withFogEnabledState(serializeGame(game._gameContext()))
  const party = extractPortalParty(currentWorldState)
  const buildingOccupants = extractBuildingInteriorOccupants(
    currentWorldState,
    game._map(),
    building,
    party,
    game._gameContext().player?.units ?? []
  )
  const buildingSleepArrivals = extractBuildingInteriorSleepArrivals(
    currentWorldState,
    building,
    party,
    game._gameContext().player?.units ?? [],
    buildingOccupants
  )
  const sourceWorldState = removeBuildingInteriorOccupants(currentWorldState, buildingOccupants)
  const previousEquippedItem = game._gameContext().controls.equippedItem ?? null
  const departureHero = runtimeHeroUnit(game as PortalTravelGame)
  const campaign = game._campaignSave
    ? updateCurrentWorldState(game._campaignSave, sourceWorldState, now)
    : createInitialCampaignSave(sourceWorldState, { now })
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
      const arrival = await bootExistingInteriorWorld(
        game,
        nextCampaign,
        building,
        targetState,
        party,
        now,
        buildingOccupants,
        buildingSleepArrivals,
        previousEquippedItem
      )
      arrivalHeroProtection = arrival.heroProtection
    } else {
      const parentWorldId = campaign.currentWorldId
      const arrival = await bootInteriorBlueprintWorld(
        game,
        building,
        sourceWorldState,
        party,
        now,
        buildingOccupants,
        buildingSleepArrivals,
        previousEquippedItem
      )
      arrivalHeroProtection = arrival.heroProtection
      const nextCampaign = addChildWorldToCampaign(campaign, arrival.state, {
        color: 'neutral',
        entryPortalId: building.label || `${building.i},${building.j}`,
        kind: 'interior',
        name: `Interieur ${building.type}`,
        now,
        parentWorldId,
        worldId: targetWorldId,
      })
      commitBuildingInteriorCampaign(game, nextCampaign)
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

export async function travelOutOfBuildingInterior(game: BuildingInteriorTravelGame): Promise<void> {
  if (game._isRestarting || game._map().mapType !== 'interior' || !game._campaignSave) return
  const currentCampaignWorld = game._campaignSave.worlds[game._campaignSave.currentWorldId]
  if (!currentCampaignWorld?.parentWorldId) return

  game._isRestarting = true
  let departureHeroProtection: BuildingInteriorHeroInvincibility | null = null
  let arrivalHeroProtection: BuildingInteriorHeroInvincibility | null = null
  const now = Date.now()
  const currentWorldState = withFogEnabledState(serializeGame(game._gameContext()))
  const party = extractPortalParty(currentWorldState)
  const previousEquippedItem = game._gameContext().controls.equippedItem ?? null
  const departureHero = runtimeHeroUnit(game as PortalTravelGame)
  const campaign = updateCurrentWorldState(game._campaignSave, currentWorldState, now)
  const entryPortalId = campaign.worlds[campaign.currentWorldId]?.entryPortalId
  const nextCampaign = returnToParentWorld(campaign, now)
  const parentState = worldStateWithCampaignClock(getCurrentWorldState(nextCampaign), nextCampaign.clock?.dayNightElapsedMs)
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
      previousEquippedItem
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
