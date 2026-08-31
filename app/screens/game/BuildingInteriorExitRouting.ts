import { getInteriorExitCell } from '../../lib/buildings/interiorExits'
import { serializeGame } from '../../serialization/SaveSerializer'
import {
  getBuildingInteriorSpaceForUnit,
  routeUnitOutOfBuildingInteriorSpace,
} from '../../services/BuildingInteriorSpaceSystem'
import { startUnitWakeTransitionFromTask } from '../../services/rest/UnitRestLifecycle'
import { isSleepTime } from '../../services/rest/UnitRestRules'
import { shouldVillagerWork } from '../../lib/units/villagerSchedule'
import { UNIT_TYPES } from '../../constants'
import type { GameContextLike } from '../../types/context'
import type { UnitEntity, UnitResourceDeliveryReturnTask } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import type { SaveEntityState, SaveReference } from '../../types/save'
import { extractPortalParty, withFogEnabledState } from './GameStateHelpers'
import {
  extractInteriorReturnOccupants,
  extractInteriorReturnOccupantsByLabel,
  moveInteriorOccupantsToSessionParent,
  returnInteriorOccupantsToParentWorld,
  sameGridPosition,
} from './BuildingInteriorReturnState'
import type { BuildingInteriorOccupantState } from './BuildingInteriorOccupants'
import type { BuildingInteriorTravelGame } from './BuildingInteriorTravelTypes'

const INTERIOR_OCCUPANT_EXIT_CHECK_INTERVAL_MS = 500
const INTERIOR_OCCUPANT_EXIT_ORDER_GRACE_MS = 2500
const INTERIOR_OCCUPANT_EXIT_MAX_RETRIES = 3

function shouldUnitRemainAtRest(context: GameContextLike, unit: UnitEntity): boolean {
  return unit.type === UNIT_TYPES.villager ? !shouldVillagerWork(unit) : isSleepTime(context)
}

function stateLabels(states: Array<Pick<SaveEntityState, 'label'> | null | undefined>): Set<string> {
  return new Set(
    states.map(unit => unit?.label).filter((label): label is string => typeof label === 'string' && label.length > 0)
  )
}

function removeRuntimeUnitsByLabels(context: GameContextLike, labels: Set<string>): UnitEntity[] {
  if (!labels.size) return []
  const { map, player } = context
  const removedUnits = player.units.filter(unit => unit.label && labels.has(unit.label))

  for (const unit of removedUnits) {
    unit.stopInterval?.()
    ;(unit as { stopTimeout?: () => void }).stopTimeout?.()
    const dest = unit.dest
    if (dest && 'isUsedBy' in dest && dest.isUsedBy === unit) dest.isUsedBy = null
    unit.path = []
    unit.action = null
    unit.dest = null
    unit.realDest = null
    unit.previousDest = null
    unit.pendingOrder = null
    unit.shelterState = null
    const currentCell = unit.currentCell || map.grid[unit.i]?.[unit.j]
    if (currentCell?.has === unit || currentCell?.has?.label === unit.label) {
      currentCell.has = null
      currentCell.solid = false
    }
    map.removeFromInstanceBucket?.(unit)
    map.removeChild?.(unit)
    unit.destroy?.({ children: true, texture: false, textureSource: false })
  }

  player.units = player.units.filter(unit => !unit.label || !labels.has(unit.label))
  player.selectedUnits = player.selectedUnits?.filter(unit => !unit.label || !labels.has(unit.label)) ?? []
  if (player.selectedUnit?.label && labels.has(player.selectedUnit.label)) player.selectedUnit = null
  context.menu?.setActionTarget?.()
  return removedUnits
}

function removeRuntimeInteriorOccupants(
  game: BuildingInteriorTravelGame,
  occupants: BuildingInteriorOccupantState[]
): void {
  removeRuntimeUnitsByLabels(game._gameContext(), stateLabels(occupants))
}

function hasPendingInteriorExitOrder(unit: UnitEntity, targetCell: RuntimeCell | null | undefined): boolean {
  const pending = unit.pendingOrder
  if (!pending || !targetCell) return false
  if (pending.execute) return true
  return sameGridPosition(pending.dest as RuntimeCell | null | undefined, targetCell)
}

function canRouteInteriorOccupantToExit(game: BuildingInteriorTravelGame, unit: UnitEntity): boolean {
  if (game._isRestarting || game._map().mapType !== 'interior') return false
  const session = game._buildingInteriorSession
  const campaign = game._campaignSave
  if (!session && !campaign) return false
  if (!session) {
    const currentWorld = campaign?.worlds[campaign.currentWorldId]
    if (!currentWorld?.parentWorldId) return false
  }
  if (unit.isDead || unit.isDestroyed || unit.followingHero) return false
  if (unit.controlMode === 'hero' || unit.type === 'Hero') return false
  return true
}

function clearInteriorExitState(unit: UnitEntity, scheduler = unit.context?.scheduler): void {
  const taskId = unit.interiorExitState?.taskId
  if (taskId != null) scheduler?.remove(taskId)
  unit.interiorExitState = null
}

function returnTaskDestinationReference(
  dest: UnitResourceDeliveryReturnTask['dest'] | null | undefined
): SaveReference | null | undefined {
  if (!dest) return dest
  return [dest.i ?? 0, dest.j ?? 0, 'label' in dest ? dest.label : undefined]
}

function applyInteriorExitReturnTasks(
  occupants: BuildingInteriorOccupantState[],
  units: UnitEntity[]
): BuildingInteriorOccupantState[] {
  const tasksByLabel = new Map(
    units
      .map(unit => [unit.label, unit.interiorExitState?.returnTask] as const)
      .filter(
        (entry): entry is [string, UnitResourceDeliveryReturnTask] =>
          typeof entry[0] === 'string' && entry[0].length > 0 && Boolean(entry[1]?.dest)
      )
  )
  if (!tasksByLabel.size) return occupants

  return occupants.map(occupant => {
    const task = occupant.label ? tasksByLabel.get(occupant.label) : null
    if (!task) return occupant
    const dest = returnTaskDestinationReference(task.dest)
    return {
      ...occupant,
      action: task.action ?? null,
      autonomousJob: task.autonomousJob ?? occupant.autonomousJob ?? null,
      dest,
      previousDest: dest,
      previousWork: task.work ?? occupant.previousWork ?? null,
      work: task.work ?? occupant.work ?? null,
    }
  })
}

function resumeInteriorExitReturnTask(unit: UnitEntity, scheduler = unit.context?.scheduler): void {
  const returnTask = unit.interiorExitState?.returnTask ?? null
  clearInteriorExitState(unit, scheduler)
  if (!returnTask) return
  startUnitWakeTransitionFromTask(unit, returnTask)
}

function routeRuntimeInteriorExit(
  game: BuildingInteriorTravelGame,
  unit: UnitEntity,
  space: NonNullable<ReturnType<typeof getBuildingInteriorSpaceForUnit>>
): boolean {
  const context = game._gameContext()
  return routeUnitOutOfBuildingInteriorSpace(context, unit, space, {
    onTransferred: () => resumeInteriorExitReturnTask(unit, context.scheduler),
  })
}

function updateRuntimeInteriorExit(game: BuildingInteriorTravelGame, unit: UnitEntity): void {
  const state = unit.interiorExitState
  if (!state) return
  const context = game._gameContext()
  const space = getBuildingInteriorSpaceForUnit(unit)
  if (!space) {
    resumeInteriorExitReturnTask(unit, context.scheduler)
    return
  }
  if (shouldUnitRemainAtRest(context, unit) || unit.isDead || unit.isDestroyed) {
    clearInteriorExitState(unit, context.scheduler)
    return
  }
  const elapsed = (context.scheduler?.elapsedMs ?? 0) - (state.startedAtMs ?? 0)
  if (unit.spacePortalState || unit.path?.length || elapsed < INTERIOR_OCCUPANT_EXIT_ORDER_GRACE_MS) return
  const retryCount = state.retryCount ?? 0
  if (retryCount >= INTERIOR_OCCUPANT_EXIT_MAX_RETRIES) return
  state.retryCount = retryCount + 1
  state.startedAtMs = context.scheduler?.elapsedMs ?? state.startedAtMs ?? 0
  routeRuntimeInteriorExit(game, unit, space)
}

function completeInteriorOccupantExit(game: BuildingInteriorTravelGame, units: UnitEntity[]): void {
  if (!units.length) return
  const context = game._gameContext()
  const currentWorldState = withFogEnabledState(serializeGame(context))
  const returningOccupants = applyInteriorExitReturnTasks(
    extractInteriorReturnOccupantsByLabel(currentWorldState, units),
    units
  )
  for (const unit of units) clearInteriorExitState(unit, context.scheduler)
  if (!returningOccupants.length) return
  if (game._buildingInteriorSession) {
    moveInteriorOccupantsToSessionParent(game, currentWorldState, returningOccupants, { autosave: true })
    removeRuntimeInteriorOccupants(game, returningOccupants)
    return
  }
  returnInteriorOccupantsToParentWorld(game, currentWorldState, returningOccupants)
  removeRuntimeInteriorOccupants(game, returningOccupants)
}

function updateInteriorOccupantExit(game: BuildingInteriorTravelGame, unit: UnitEntity): void {
  const state = unit.interiorExitState
  if (!state) return
  const context = game._gameContext()
  if (getBuildingInteriorSpaceForUnit(unit)) {
    updateRuntimeInteriorExit(game, unit)
    return
  }
  if (shouldUnitRemainAtRest(context, unit) || !canRouteInteriorOccupantToExit(game, unit)) {
    clearInteriorExitState(unit, context.scheduler)
    return
  }

  const targetCell = state.targetCell ?? getInteriorExitCell(context.map)
  if (!targetCell) {
    completeInteriorOccupantExit(game, [unit])
    return
  }
  state.targetCell = targetCell

  if (sameGridPosition(unit.currentCell, targetCell) || sameGridPosition(unit, targetCell)) {
    completeInteriorOccupantExit(game, [unit])
    return
  }

  const elapsed = (context.scheduler?.elapsedMs ?? 0) - (state.startedAtMs ?? 0)
  const destinationStillSet = sameGridPosition(unit.dest as RuntimeCell | null | undefined, targetCell)
  const failedPath =
    !hasPendingInteriorExitOrder(unit, targetCell) &&
    !destinationStillSet &&
    !unit.path?.length &&
    elapsed >= INTERIOR_OCCUPANT_EXIT_ORDER_GRACE_MS
  if (!failedPath) return

  const retryCount = state.retryCount ?? 0
  if (retryCount >= INTERIOR_OCCUPANT_EXIT_MAX_RETRIES) {
    completeInteriorOccupantExit(game, [unit])
    return
  }
  state.retryCount = retryCount + 1
  state.startedAtMs = context.scheduler?.elapsedMs ?? state.startedAtMs ?? 0
  unit.sendToEvt?.(targetCell, null, {
    forceRepath: true,
    preserveAutonomy: true,
    allowPassageStop: true,
  })
}

function scheduleInteriorOccupantExitCheck(game: BuildingInteriorTravelGame, unit: UnitEntity): void {
  const state = unit.interiorExitState
  const scheduler = unit.context?.scheduler ?? game._gameContext().scheduler
  if (!state || !scheduler || state.taskId != null) return
  const taskId = scheduler.add(
    () => updateInteriorOccupantExit(game, unit),
    INTERIOR_OCCUPANT_EXIT_CHECK_INTERVAL_MS,
    'buildingInterior.exitOccupant'
  )
  state.taskId = taskId
}

export function routeInteriorUnitToExit(
  game: BuildingInteriorTravelGame,
  unit: UnitEntity,
  returnTask: UnitResourceDeliveryReturnTask | null = null
): void {
  const context = game._gameContext()
  const space = getBuildingInteriorSpaceForUnit(unit)
  if (space) {
    if (
      shouldUnitRemainAtRest(context, unit) ||
      unit.isDead ||
      unit.isDestroyed ||
      unit.followingHero ||
      unit.controlMode === 'hero' ||
      unit.type === 'Hero'
    ) {
      return
    }
    unit.interiorExitState = {
      returnTask,
      retryCount: 0,
      startedAtMs: context.scheduler?.elapsedMs ?? 0,
      targetCell: space.exitCell,
    }
    routeRuntimeInteriorExit(game, unit, space)
    if (!unit.interiorExitState) return
    scheduleInteriorOccupantExitCheck(game, unit)
    return
  }
  if (shouldUnitRemainAtRest(context, unit) || !canRouteInteriorOccupantToExit(game, unit)) return
  const targetCell = getInteriorExitCell(context.map)
  if (
    targetCell &&
    unit.interiorExitState?.taskId != null &&
    sameGridPosition(unit.interiorExitState.targetCell, targetCell)
  ) {
    return
  }
  unit.interiorExitState = unit.interiorExitState ?? {
    retryCount: 0,
    returnTask,
    startedAtMs: context.scheduler?.elapsedMs ?? 0,
    targetCell,
  }
  unit.interiorExitState.returnTask = returnTask
  unit.interiorExitState.targetCell = targetCell

  if (!targetCell || sameGridPosition(unit.currentCell, targetCell) || sameGridPosition(unit, targetCell)) {
    completeInteriorOccupantExit(game, [unit])
    return
  }

  unit.interiorExitState.startedAtMs = context.scheduler?.elapsedMs ?? 0
  unit.sendToEvt?.(targetCell, null, {
    forceRepath: true,
    preserveAutonomy: true,
    allowPassageStop: true,
  })
  scheduleInteriorOccupantExitCheck(game, unit)
}

export function synchronizeInteriorOccupantsAfterTimeJump(game: BuildingInteriorTravelGame): void {
  const context = game._gameContext()
  if (game._map().mapType !== 'interior') {
    context.unitRest?.synchronizeAfterTimeJump?.()
    return
  }
  if (isSleepTime(context)) return
  if (!game._buildingInteriorSession && !game._campaignSave) return

  const currentWorldState = withFogEnabledState(serializeGame(context))
  const party = extractPortalParty(currentWorldState)
  const returningOccupants = extractInteriorReturnOccupants(currentWorldState, party, context.player?.units ?? [])
  if (!returningOccupants.length) return

  if (game._buildingInteriorSession) {
    moveInteriorOccupantsToSessionParent(game, currentWorldState, returningOccupants, { autosave: true })
    removeRuntimeInteriorOccupants(game, returningOccupants)
    return
  }
  returnInteriorOccupantsToParentWorld(game, currentWorldState, returningOccupants)
  removeRuntimeInteriorOccupants(game, returningOccupants)
}
