import { UNIT_TYPES } from '../../constants'
import { getBuildingFootprintCells, getFreeLandCellAroundInstance } from '../../lib'
import { findInteriorSleepCell, hasBuildingShelterCapacity } from '../../lib/buildings/buildingOccupancy'
import { sameBuilding } from '../../lib/buildings/identity'
import { createNonReservedPassageCellCondition } from '../../lib/buildings/passageCells'
import { refreshUnitEquipmentStats } from '../../lib/equipment/equipmentStats'
import { sleepOutside } from '../../services/rest/UnitRestLifecycle'
import type { SleepOutsideVisualMode } from '../../services/rest/UnitRestLifecycle'
import { getNearestShelter, isSleepTime } from '../../services/rest/UnitRestRules'
import type { GameContextLike } from '../../types/context'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import type { RuntimeCell, RuntimeMap } from '../../types/map'
import type { SaveEntityState, SerializedSave } from '../../types/save'
import { applyPortableUnitState, type PortalPartyState } from './GameStateHelpers'
import { refreshPortalPartyFog, type PortalTravelGame } from './GamePortalTravel'

export type BuildingInteriorOccupantState = SaveEntityState & {
  sleepInInterior?: boolean
}

type BuildingInteriorOccupantGame = {
  _gameContext(): GameContextLike
}

const INTERIOR_SLEEP_ARRIVAL_INTERVAL_MS = 1500

function footprintKey(i: number, j: number): string {
  return `${i}:${j}`
}

function getPartyLabels(party: PortalPartyState): Set<string> {
  const labels = new Set<string>()
  if (party.hero?.label) labels.add(party.hero.label)
  for (const follower of party.followers) {
    if (follower.label) labels.add(follower.label)
  }
  return labels
}

function isRuntimeUnitInsideBuildingShelter(unit: UnitEntity | undefined, building: BuildingEntity): boolean {
  if (unit?.shelterState?.status !== 'inside') return false
  const shelter = unit.shelterState.shelter
  return shelter === building || Boolean(shelter?.label && shelter.label === building.label)
}

export function extractBuildingInteriorOccupants(
  state: SerializedSave,
  map: RuntimeMap,
  building: BuildingEntity,
  party: PortalPartyState,
  runtimeUnits: UnitEntity[] = []
): BuildingInteriorOccupantState[] {
  const played = state.players.find(player => player.isPlayed)
  if (!played?.units?.length) return []

  const partyLabels = getPartyLabels(party)
  const runtimeUnitsByLabel = new Map(
    runtimeUnits
      .map(unit => [unit.label, unit] as const)
      .filter((entry): entry is [string, UnitEntity] => typeof entry[0] === 'string' && entry[0].length > 0)
  )
  const footprint = new Set(
    getBuildingFootprintCells(building.i, building.j, map.grid, building.size ?? 1).map(cell =>
      footprintKey(cell.i, cell.j)
    )
  )
  if (!footprint.size) return []

  return played.units.flatMap(unit => {
    if (!unit.label || partyLabels.has(unit.label)) return []
    if (unit.isDead || unit.isDestroyed) return []
    const runtimeUnit = runtimeUnitsByLabel.get(unit.label)
    if (runtimeUnit?.followingHero) return []
    const shelteredHere = isRuntimeUnitInsideBuildingShelter(runtimeUnit, building)
    const onFootprint = footprint.has(footprintKey(unit.i, unit.j))
    if (!onFootprint && !shelteredHere) return []
    return [
      {
        ...structuredClone(unit),
        sleepInInterior: runtimeUnit?.shelterState?.reason === 'sleep' && shelteredHere,
      },
    ]
  })
}

export function extractBuildingInteriorSleepArrivals(
  state: SerializedSave,
  building: BuildingEntity,
  party: PortalPartyState,
  runtimeUnits: UnitEntity[] = [],
  immediateOccupants: BuildingInteriorOccupantState[] = []
): BuildingInteriorOccupantState[] {
  const played = state.players.find(player => player.isPlayed)
  if (!played?.units?.length) return []

  const partyLabels = getPartyLabels(party)
  const immediateLabels = new Set(
    immediateOccupants
      .map(unit => unit.label)
      .filter((label): label is string => typeof label === 'string' && label.length > 0)
  )
  const runtimeUnitsByLabel = new Map(
    runtimeUnits
      .map(unit => [unit.label, unit] as const)
      .filter((entry): entry is [string, UnitEntity] => typeof entry[0] === 'string' && entry[0].length > 0)
  )
  let reservedSleepArrivals = 0

  return played.units.flatMap(unit => {
    if (!unit.label || partyLabels.has(unit.label) || immediateLabels.has(unit.label)) return []
    if (unit.type !== UNIT_TYPES.villager || unit.isDead || unit.isDestroyed || unit.followingHero) return []
    const runtimeUnit = runtimeUnitsByLabel.get(unit.label)
    if (!runtimeUnit || runtimeUnit.followingHero || runtimeUnit.shelterState) return []
    if (
      !hasBuildingShelterCapacity(building, runtimeUnits, {
        exclude: runtimeUnit,
        reserved: reservedSleepArrivals,
      })
    ) {
      return []
    }
    const sleepTarget = getNearestShelter(runtimeUnit)
    if (!sameBuilding(sleepTarget?.shelter, building)) return []
    reservedSleepArrivals += 1
    return [{ ...structuredClone(unit), sleepInInterior: true }]
  })
}

export function removeBuildingInteriorOccupants(state: SerializedSave, occupants: SaveEntityState[]): SerializedSave {
  const occupantLabels = new Set(
    occupants.map(unit => unit.label).filter((label): label is string => typeof label === 'string' && label.length > 0)
  )
  if (!occupantLabels.size) return state

  return {
    ...state,
    players: state.players.map(player => {
      if (!player.isPlayed || !player.units?.length) return player
      const selectedUnitLabels = player.selectedUnitLabels?.filter(label => !occupantLabels.has(label))
      return {
        ...player,
        selectedUnitLabel:
          player.selectedUnitLabel && occupantLabels.has(player.selectedUnitLabel)
            ? undefined
            : player.selectedUnitLabel,
        selectedUnitLabels,
        units: player.units.filter(unit => !unit.label || !occupantLabels.has(unit.label)),
      }
    }),
  }
}

function findInteriorOccupantArrivalCell(
  game: BuildingInteriorOccupantGame,
  anchor: { i: number; j: number; size?: number } | null
): RuntimeCell | null {
  const map = game._gameContext().map
  const directCell = anchor ? map.grid?.[anchor.i]?.[anchor.j] : null
  if (
    directCell &&
    !directCell.has &&
    !directCell.solid &&
    !directCell.border &&
    directCell.category !== 'Water' &&
    !directCell.terrainHidden
  ) {
    return directCell
  }
  const center = Math.round(map.size / 2)
  return getFreeLandCellAroundInstance(
    anchor ?? { i: center, j: center, size: 1 },
    map.grid,
    cells => cells[Math.floor(map.random() * cells.length)],
    createNonReservedPassageCellCondition(game._gameContext())
  )
}

function sameCell(a: RuntimeCell | null | undefined, b: RuntimeCell | null | undefined): boolean {
  return Boolean(a && b && a.i === b.i && a.j === b.j)
}

function sendOccupantToInteriorSleepCell(occupant: UnitEntity, targetCell: RuntimeCell): void {
  occupant.shelterState = {
    status: 'movingToRest',
    reason: 'sleep',
    location: 'outside',
    shelter: null,
    targetCell,
    startedAtMs: occupant.context?.scheduler?.elapsedMs ?? 0,
    retryCount: 0,
    previousDest: null,
    previousWork: null,
    previousAction: null,
    previousAutonomousJob: null,
  }
  occupant.sendToEvt?.(targetCell, null, { forceRepath: true, preserveAutonomy: true })
}

export function addInteriorOccupantsToRuntime(
  game: BuildingInteriorOccupantGame,
  occupants: BuildingInteriorOccupantState[],
  anchor: { i: number; j: number; size?: number } | null,
  options: { sleepVisual?: SleepOutsideVisualMode } = {}
): UnitEntity[] {
  const { player } = game._gameContext()
  if (!player || !occupants.length) return []

  const existingLabels = new Set(
    player.units
      .map(unit => unit.label)
      .filter((label): label is string => typeof label === 'string' && label.length > 0)
  )
  const created: UnitEntity[] = []

  for (const occupantState of occupants) {
    if (!occupantState.label || existingLabels.has(occupantState.label)) continue
    const arrivalCell = findInteriorOccupantArrivalCell(game, anchor)
    if (!arrivalCell) continue
    const sleepCell = occupantState.sleepInInterior ? findInteriorSleepCell(game._gameContext().map) : null
    const enterSleepingInstantly = occupantState.sleepInInterior && (options.sleepVisual ?? 'finalFrame') === 'finalFrame'
    const spawnCell = enterSleepingInstantly && sleepCell ? sleepCell : arrivalCell

    const occupant = player.createUnit?.(
      {
        i: spawnCell.i,
        j: spawnCell.j,
        appearanceVariants: occupantState.appearanceVariants
          ? { ...occupantState.appearanceVariants }
          : occupantState.gender
            ? { gender: occupantState.gender }
            : undefined,
        gender: occupantState.gender,
        label: occupantState.label,
        name: occupantState.name,
        suppressCreateSound: true,
        type: occupantState.type,
      },
      { preserveType: true }
    )
    if (!occupant) continue

    applyPortableUnitState(occupant as Partial<SaveEntityState>, occupantState, { keepAlive: true })
    occupant.followingHero = false
    if (occupantState.sleepInInterior) {
      if (enterSleepingInstantly) sleepOutside(occupant, 'sleep', { visual: 'finalFrame' })
      else if (sleepCell && !sameCell(sleepCell, arrivalCell)) sendOccupantToInteriorSleepCell(occupant, sleepCell)
      else sleepOutside(occupant, 'sleep', { visual: options.sleepVisual ?? 'finalFrame' })
    }
    refreshUnitEquipmentStats(occupant)
    existingLabels.add(occupant.label)
    created.push(occupant)
  }

  if (created.length) refreshPortalPartyFog(game as PortalTravelGame, created)
  return created
}

export function scheduleInteriorSleepArrivals(
  game: BuildingInteriorOccupantGame,
  occupants: BuildingInteriorOccupantState[],
  findArrivalCell: () => RuntimeCell | null,
  options: {
    flushImmediately?: boolean
    onArrival?: (occupant: BuildingInteriorOccupantState, units: UnitEntity[]) => void
  } = {}
): void {
  const pending = [...occupants]
  if (!pending.length) return
  const { flushImmediately = true, onArrival } = options

  let taskId: number | null = null
  const flushNext = (): void => {
    const context = game._gameContext()
    if (!isSleepTime(context)) return
    const arrivalCell = findArrivalCell()
    const occupant = pending.shift()
    if (occupant) {
      const units = addInteriorOccupantsToRuntime(game, [occupant], arrivalCell, { sleepVisual: 'animate' })
      if (units.length) onArrival?.(occupant, units)
    }
    if (!pending.length && taskId != null) {
      context.scheduler.remove(taskId)
      taskId = null
    }
  }

  taskId = game
    ._gameContext()
    .scheduler.add(flushNext, INTERIOR_SLEEP_ARRIVAL_INTERVAL_MS, 'buildingInterior.sleepArrivals')
  if (flushImmediately) flushNext()
}
