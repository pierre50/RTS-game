import { getFreeLandCellAroundInstance, resumeVillagerAutonomy } from '../../lib'
import { createNonReservedPassageCellCondition } from '../../lib/buildings/passageCells'
import {
  getBuildingInteriorEntryCell,
  getBuildingInteriorEntryPosition,
  getBuildingInteriorPortalId,
} from '../../lib/buildings/interiors'
import { getKnownBuildings } from '../../lib/buildings/knownBuildings'
import { updateCurrentWorldState } from '../../serialization/CampaignSave'
import { serializeGame } from '../../serialization/SaveSerializer'
import { isSleepTime } from '../../services/rest/UnitRestRules'
import type { GameContextLike } from '../../types/context'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import type { CampaignSave, SaveEntityState, SerializedSave } from '../../types/save'
import {
  extractPortalParty,
  withFogEnabledState,
  worldStateWithCampaignClock,
  type PortalPartyState,
} from './GameStateHelpers'
import { teleportRuntimeUnit, type PortalTravelGame } from './GamePortalTravel'
import {
  removeBuildingInteriorOccupants,
  type BuildingInteriorOccupantState,
} from './BuildingInteriorOccupants'
import type { BuildingInteriorSession, BuildingInteriorTravelGame } from './BuildingInteriorTravelTypes'

export function commitBuildingInteriorCampaign(game: BuildingInteriorTravelGame, campaign: CampaignSave): void {
  game._campaignSave = structuredClone(campaign)
  game._restartSaveData = structuredClone(campaign)
  game._autosaveCampaign()
}

function savedDayNightElapsedMs(state: SerializedSave): number {
  const value = state.runtime?.dayNightElapsedMs
  return Number.isFinite(value) ? Math.max(0, value ?? 0) : 0
}

export function updateCampaignWorldState(
  campaign: CampaignSave,
  worldId: string,
  state: SerializedSave,
  now: number = Date.now()
): CampaignSave {
  const world = campaign.worlds[worldId]
  if (!world) throw new Error('Invalid save file: campaign world is missing.')
  const elapsedMs = savedDayNightElapsedMs(state)
  const heroParty = campaign.heroParty ?? { followerLabels: [] }
  const node = campaign.worldGraph?.nodes?.[worldId]

  return {
    ...campaign,
    clock: {
      dayNightElapsedMs: elapsedMs,
      savedAt: now,
    },
    currentWorldId: worldId,
    heroParty: {
      ...heroParty,
      playerLabel: state.players.find(player => player.isPlayed)?.label ?? heroParty.playerLabel,
    },
    worlds: {
      ...campaign.worlds,
      [worldId]: {
        ...world,
        id: world.id ?? worldId,
        state,
        visitedAt: now,
        visitedDayNightElapsedMs: elapsedMs,
      },
    },
    worldGraph: campaign.worldGraph
      ? {
          ...campaign.worldGraph,
          nodes: {
            ...campaign.worldGraph.nodes,
            ...(node
              ? {
                  [worldId]: {
                    ...node,
                    visitedAt: now,
                  },
                }
              : {}),
          },
        }
      : campaign.worldGraph,
  }
}

function partyLabels(party: PortalPartyState): Set<string> {
  const labels = new Set<string>()
  if (party.hero?.label) labels.add(party.hero.label)
  for (const follower of party.followers) {
    if (follower.label) labels.add(follower.label)
  }
  return labels
}

export function extractInteriorReturnOccupants(
  state: SerializedSave,
  party: PortalPartyState,
  runtimeUnits: UnitEntity[] = []
): BuildingInteriorOccupantState[] {
  const played = state.players.find(player => player.isPlayed)
  if (!played?.units?.length) return []
  const excludedLabels = partyLabels(party)
  const runtimeUnitsByLabel = new Map(
    runtimeUnits
      .map(unit => [unit.label, unit] as const)
      .filter((entry): entry is [string, UnitEntity] => typeof entry[0] === 'string' && entry[0].length > 0)
  )

  return played.units.flatMap(unit => {
    if (!unit.label || excludedLabels.has(unit.label)) return []
    if (unit.isDead || unit.isDestroyed) return []
    const runtimeUnit = runtimeUnitsByLabel.get(unit.label)
    if (runtimeUnit?.followingHero) return []
    return [{ ...structuredClone(unit) }]
  })
}

export function extractInteriorReturnOccupantsByLabel(
  state: SerializedSave,
  units: UnitEntity[]
): BuildingInteriorOccupantState[] {
  const labels = new Set(
    units.map(unit => unit.label).filter((label): label is string => typeof label === 'string' && label.length > 0)
  )
  if (!labels.size) return []
  const played = state.players.find(player => player.isPlayed)
  if (!played?.units?.length) return []
  return played.units.flatMap(unit => {
    if (!unit.label || !labels.has(unit.label)) return []
    if (unit.isDead || unit.isDestroyed) return []
    return [{ ...structuredClone(unit) }]
  })
}

function findParentBuildingState(
  state: SerializedSave,
  entryPortalId: string | null | undefined
): SaveEntityState | null {
  if (!entryPortalId) return null
  for (const player of state.players) {
    for (const building of player.buildings ?? []) {
      if (building.label === entryPortalId) return building
      if (entryPortalId === `${building.i},${building.j}`) return building
      if (getBuildingInteriorPortalId(building as BuildingEntity) === entryPortalId) return building
    }
  }
  return null
}

function normalizeReturnedOccupant(
  occupant: SaveEntityState & { sleepInInterior?: boolean },
  building: SaveEntityState | null,
  options: { followingHero?: boolean } = {}
): SaveEntityState {
  const { sleepInInterior: _sleepInInterior, ...savedOccupant } = structuredClone(occupant)
  const entryPosition = getBuildingInteriorEntryPosition(building as BuildingEntity | null)
  return {
    ...savedOccupant,
    action: null,
    currentFrame: undefined,
    currentSheet: undefined,
    dest: null,
    followingHero: options.followingHero ?? false,
    i: entryPosition?.i ?? building?.i ?? savedOccupant.i,
    inactif: false,
    j: entryPosition?.j ?? building?.j ?? savedOccupant.j,
    loop: undefined,
    path: [],
    realDest: null,
  }
}

export function uniqueInteriorOccupants(...groups: BuildingInteriorOccupantState[][]): BuildingInteriorOccupantState[] {
  const byLabel = new Map<string, BuildingInteriorOccupantState>()
  const unlabeled: BuildingInteriorOccupantState[] = []
  for (const group of groups) {
    for (const occupant of group) {
      if (!occupant.label) {
        unlabeled.push({ ...structuredClone(occupant) })
        continue
      }
      byLabel.set(occupant.label, { ...structuredClone(occupant) })
    }
  }
  return [...unlabeled, ...byLabel.values()]
}

export function mergeInteriorReturnOccupantsIntoParentState(
  state: SerializedSave,
  occupants: BuildingInteriorOccupantState[],
  entryPortalId: string | null | undefined
): SerializedSave {
  if (!occupants.length) return state
  const building = findParentBuildingState(state, entryPortalId)
  const occupantLabels = new Set(
    occupants.map(unit => unit.label).filter((label): label is string => typeof label === 'string' && label.length > 0)
  )
  if (!occupantLabels.size) return state
  const returnedUnits = occupants.map(occupant => normalizeReturnedOccupant(occupant, building))

  return {
    ...state,
    players: state.players.map(player => {
      if (!player.isPlayed) return player
      return {
        ...player,
        units: [
          ...(player.units ?? []).filter(unit => !unit.label || !occupantLabels.has(unit.label)),
          ...returnedUnits,
        ],
      }
    }),
  }
}

function mergeInteriorPartyIntoParentState(
  state: SerializedSave,
  party: PortalPartyState,
  entryPortalId: string | null | undefined
): SerializedSave {
  const building = findParentBuildingState(state, entryPortalId)
  const partyUnits = [
    ...(party.hero ? [{ unit: party.hero, followingHero: false }] : []),
    ...party.followers.map(unit => ({ unit, followingHero: true })),
  ].filter(({ unit }) => Boolean(unit.label))
  if (!partyUnits.length) return state

  const partyByLabel = new Map(
    partyUnits.map(({ unit, followingHero }) => [
      unit.label as string,
      normalizeReturnedOccupant(unit, building, { followingHero }),
    ])
  )
  const existingLabels = new Set<string>()

  return {
    ...state,
    players: state.players.map(player => {
      if (!player.isPlayed) return player
      const units = (player.units ?? []).map(unit => {
        if (!unit.label) return unit
        const partyUnit = partyByLabel.get(unit.label)
        if (!partyUnit) return unit
        existingLabels.add(unit.label)
        return partyUnit
      })
      for (const [label, partyUnit] of partyByLabel) {
        if (!existingLabels.has(label)) units.push(partyUnit)
      }
      return {
        ...player,
        units,
      }
    }),
  }
}

export function buildSessionParentStateFromInterior(
  session: BuildingInteriorSession,
  interiorState: SerializedSave,
  party: PortalPartyState,
  runtimeUnits: UnitEntity[] = []
): SerializedSave {
  const returningOccupants = extractInteriorReturnOccupants(interiorState, party, runtimeUnits)
  const allReturningOccupants = uniqueInteriorOccupants(session.returnedOccupants, returningOccupants)
  const withOccupants = mergeInteriorReturnOccupantsIntoParentState(
    session.sourceWorldState,
    allReturningOccupants,
    session.entryPortalId
  )
  return mergeInteriorPartyIntoParentState(withOccupants, party, session.entryPortalId)
}

export function buildBuildingInteriorSessionSaveRecord(
  game: BuildingInteriorTravelGame,
  now: number = Date.now()
): CampaignSave | null {
  const session = game._buildingInteriorSession
  if (!session) return null
  const campaign = game._campaignSave ?? session.sourceCampaign
  const interiorState = withFogEnabledState(serializeGame(game._gameContext()))
  const party = extractPortalParty(interiorState)
  const parentState = worldStateWithCampaignClock(
    buildSessionParentStateFromInterior(session, interiorState, party, game._gameContext().player?.units ?? []),
    interiorState.runtime?.dayNightElapsedMs ?? session.sourceWorldState.runtime?.dayNightElapsedMs
  )
  return updateCampaignWorldState(campaign, session.sourceWorldId, withFogEnabledState(parentState), now)
}

function commitBuildingInteriorSessionSourceState(
  game: BuildingInteriorTravelGame,
  sourceWorldState: SerializedSave,
  now: number,
  options: { autosave?: boolean; dayNightElapsedMs?: number | null } = {}
): void {
  const session = game._buildingInteriorSession
  if (!session) return
  const nextSourceWorldState = worldStateWithCampaignClock(
    withFogEnabledState(sourceWorldState),
    options.dayNightElapsedMs
  )
  const campaign = updateCampaignWorldState(
    game._campaignSave ?? session.sourceCampaign,
    session.sourceWorldId,
    nextSourceWorldState,
    now
  )
  game._buildingInteriorSession = {
    ...session,
    sourceCampaign: structuredClone(campaign),
    sourceWorldState: structuredClone(nextSourceWorldState),
  }
  game._campaignSave = structuredClone(campaign)
  game._restartSaveData = buildBuildingInteriorSessionSaveRecord(game, now) ?? structuredClone(campaign)
  if (options.autosave) game._autosaveCampaign()
}

export function moveInteriorOccupantsToSessionParent(
  game: BuildingInteriorTravelGame,
  currentWorldState: SerializedSave,
  occupants: BuildingInteriorOccupantState[],
  options: { autosave?: boolean } = {}
): void {
  const session = game._buildingInteriorSession
  if (!session || !occupants.length) return
  const sourceWorldState = mergeInteriorReturnOccupantsIntoParentState(
    session.sourceWorldState,
    occupants,
    session.entryPortalId
  )
  game._buildingInteriorSession = {
    ...session,
    returnedOccupants: uniqueInteriorOccupants(session.returnedOccupants, occupants),
    sourceWorldState,
  }
  commitBuildingInteriorSessionSourceState(game, sourceWorldState, Date.now(), {
    ...options,
    dayNightElapsedMs: currentWorldState.runtime?.dayNightElapsedMs,
  })
}

export function returnInteriorOccupantsToParentWorld(
  game: BuildingInteriorTravelGame,
  currentWorldState: SerializedSave,
  returningOccupants: BuildingInteriorOccupantState[]
): void {
  if (!game._campaignSave || !returningOccupants.length) return
  const currentWorld = game._campaignSave.worlds[game._campaignSave.currentWorldId]
  if (!currentWorld?.parentWorldId) return
  const parentWorld = game._campaignSave.worlds[currentWorld.parentWorldId]
  if (!parentWorld) return

  const now = Date.now()
  const currentWorldStateWithoutReturningOccupants = removeBuildingInteriorOccupants(
    currentWorldState,
    returningOccupants
  )
  const parentState = mergeInteriorReturnOccupantsIntoParentState(
    parentWorld.state,
    returningOccupants,
    currentWorld.entryPortalId
  )
  const campaignWithCurrent = updateCurrentWorldState(
    game._campaignSave,
    currentWorldStateWithoutReturningOccupants,
    now
  )
  commitBuildingInteriorCampaign(game, {
    ...campaignWithCurrent,
    worlds: {
      ...campaignWithCurrent.worlds,
      [currentWorld.parentWorldId]: {
        ...parentWorld,
        state: parentState,
        visitedAt: now,
      },
    },
  })
}

export function sameGridPosition(
  a: Pick<UnitEntity, 'i' | 'j'> | RuntimeCell | null | undefined,
  b: RuntimeCell | null | undefined
): boolean {
  return Boolean(a && b && a.i === b.i && a.j === b.j)
}

export function placeParentDoorOccupants(
  game: BuildingInteriorTravelGame,
  party: PortalPartyState,
  returningOccupants: BuildingInteriorOccupantState[],
  arrivalCell: RuntimeCell | null
): void {
  if (!arrivalCell) return
  const context = game._gameContext()
  const { player, map } = context
  const partyLabelSet = partyLabels(party)
  const returningLabels = new Set(
    returningOccupants
      .map(unit => unit.label)
      .filter((label): label is string => typeof label === 'string' && label.length > 0)
  )
  const units = player.units.filter(unit => {
    if (!unit.label || partyLabelSet.has(unit.label)) return false
    if (returningLabels.has(unit.label)) return true
    return sameGridPosition(unit.currentCell ?? unit, arrivalCell)
  })
  if (!units.length) return

  units.forEach(unit => {
    const cell =
      getFreeLandCellAroundInstance(
        { i: arrivalCell.i, j: arrivalCell.j, size: 1 },
        map.grid,
        cells => cells[Math.floor(map.random() * cells.length)],
        createNonReservedPassageCellCondition(context)
      ) ?? arrivalCell
    teleportRuntimeUnit(game as PortalTravelGame, unit, cell)
    if (!isSleepTime(context) && unit.autonomousJob) resumeVillagerAutonomy?.(unit)
  })
  context.unitRest?.synchronizeAfterTimeJump?.()
}

function findBuildingInteriorParentArrivalCellInContext(
  context: GameContextLike,
  entryPortalId: string | null | undefined
): RuntimeCell | null {
  const { map } = context
  const building = getKnownBuildings(context).find(candidate => {
    if (!entryPortalId) return false
    if (getBuildingInteriorPortalId(candidate) === entryPortalId) return true
    if (candidate.label === entryPortalId) return true
    return entryPortalId === `${candidate.i},${candidate.j}`
  })
  if (!building) return null
  const entryCell = getBuildingInteriorEntryCell(building, map.grid)
  if (entryCell && entryCell.category !== 'Water' && !entryCell.terrainHidden && !entryCell.border) return entryCell
  return getFreeLandCellAroundInstance(
    building,
    map.grid,
    cells => cells[Math.floor(map.random() * cells.length)],
    createNonReservedPassageCellCondition(context)
  )
}

export function findBuildingInteriorParentArrivalCell(
  game: BuildingInteriorTravelGame,
  entryPortalId: string | null | undefined
): RuntimeCell | null {
  return findBuildingInteriorParentArrivalCellInContext(game._gameContext(), entryPortalId)
}
