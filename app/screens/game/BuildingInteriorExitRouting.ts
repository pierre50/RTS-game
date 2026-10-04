import {
  shouldUnitRemainAtRest,
  canRouteInteriorOccupantToExit,
  removeRuntimeInteriorOccupants,
  applyInteriorExitReturnTasks,
  clearInteriorExitState,
  resumeInteriorExitReturnTask,
} from './BuildingInteriorExitState'
import { getInteriorExitCell } from '../../lib/buildings/interiorExits'
import { serializeGame } from '../../serialization/SaveSerializer'
import {
  getBuildingInteriorSpaceForUnit,
  routeUnitOutOfBuildingInteriorSpace,
} from '../../services/BuildingInteriorSpaceSystem'
import { isSleepTime } from '../../services/rest/UnitRestRules'
import type { UnitEntity, UnitResourceDeliveryReturnTask } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import { withDebugRevealDisabled } from './GameStateHelpers'
import { extractTravelParty } from './GameTravelParty'
import {
  extractInteriorReturnOccupants,
  extractInteriorReturnOccupantsByLabel,
  moveInteriorOccupantsToSessionParent,
  returnInteriorOccupantsToParentWorld,
  sameGridPosition,
} from './BuildingInteriorReturnState'
import type { BuildingInteriorTravelGame } from './BuildingInteriorTravelTypes'

const INTERIOR_OCCUPANT_EXIT_CHECK_INTERVAL_MS = 500
const INTERIOR_OCCUPANT_EXIT_ORDER_GRACE_MS = 2500
const INTERIOR_OCCUPANT_EXIT_MAX_RETRIES = 3

function hasPendingInteriorExitOrder(unit: UnitEntity, targetCell: RuntimeCell | null | undefined): boolean {
  const pending = unit.pendingOrder
  if (!pending || !targetCell) return false
  if (pending.execute) return true
  return sameGridPosition(pending.dest as RuntimeCell | null | undefined, targetCell)
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
  if (unit.isDead || unit.isDestroyed) {
    clearInteriorExitState(unit, context.scheduler)
    return
  }
  // Waking precedes work by an hour. Keep the exit request until work starts.
  if (shouldUnitRemainAtRest(context, unit)) return
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
  const currentWorldState = withDebugRevealDisabled(serializeGame(context))
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
    if (unit.isDead || unit.isDestroyed || unit.followingHero || unit.controlMode === 'hero' || unit.type === 'Hero') {
      return
    }
    unit.interiorExitState = unit.interiorExitState ?? {
      returnTask,
      retryCount: 0,
      startedAtMs: context.scheduler?.elapsedMs ?? 0,
      targetCell: space.exitCell,
    }
    if (returnTask) unit.interiorExitState.returnTask = returnTask
    if (!shouldUnitRemainAtRest(context, unit)) routeRuntimeInteriorExit(game, unit, space)
    if (!unit.interiorExitState) return
    scheduleInteriorOccupantExitCheck(game, unit)
    return
  }
  if (shouldUnitRemainAtRest(context, unit, returnTask) || !canRouteInteriorOccupantToExit(game, unit)) return
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

  const currentWorldState = withDebugRevealDisabled(serializeGame(context))
  const party = extractTravelParty(currentWorldState)
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
