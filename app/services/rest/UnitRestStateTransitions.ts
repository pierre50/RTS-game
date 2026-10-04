import { clearUnitSpacePortalRoute } from '../spacePortal/SpacePortalSystem'
import { sameCellMapSpace } from '../../lib/mapSpaces'
import { routeUnitToRestTarget } from './UnitRestRoute'
import { isRestTargetAvailable } from './UnitRestShelter'
import { UNIT_TYPES } from '../../constants'
import { hasDailyRestSchedule, shouldVillagerBeAsleep } from '../../lib/units/village/villagerSchedule'
import type { GameContextLike } from '../../types/context'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import { expelBuildingInteriorOccupants, getBuildingInteriorSpaceForUnit } from '../BuildingInteriorSpaceSystem'
import type { TimedUnitRestState } from './UnitRestLifecycle'
import {
  finishUnitWakeTransition,
  getRestReturnTask,
  rerouteRestUnit,
  sendUnitToRest,
  settleUnitRestForTimeJump,
  sleepOutside,
  waitOutsideForSleep,
  wakeUnit,
  wakeUnitInstant,
} from './UnitRestLifecycle'
import { isShelterUnsafe, isSleepTime, REST_MAX_RETRIES, REST_ORDER_GRACE_MS } from './UnitRestRules'
import { hasFailedTransitionPath, hasPendingRestOrder, updateWindingDownRestUnit } from './UnitRestWindDown'
import { keepSleepingOutsideVisual } from './UnitSleepVisuals'

function retrySleepSpotPath(unit: UnitEntity, state: TimedUnitRestState): boolean {
  const targetCell = state.targetCell
  if (!targetCell) return false
  const retryCount = state.retryCount ?? 0
  if (retryCount >= REST_MAX_RETRIES) return false
  state.retryCount = retryCount + 1
  state.startedAtMs = unit.context?.scheduler?.elapsedMs ?? state.startedAtMs ?? 0
  return routeUnitToRestTarget(unit, state)
}

function updateWakingUpRestUnit(unit: UnitEntity, state: TimedUnitRestState): boolean {
  if (state.status !== 'wakingUp') return false
  if (hasDailyRestSchedule(unit) ? shouldVillagerBeAsleep(unit) : isSleepTime(unit.context!)) {
    sendUnitToRest(unit, 'sleep')
    return true
  }

  const now = unit.context?.scheduler?.elapsedMs ?? 0
  const transitionCell = state.transitionTargetCell
  const arrived = Boolean(transitionCell && unit.i === transitionCell.i && unit.j === transitionCell.j)
  const failedPath = hasFailedTransitionPath(unit, transitionCell, arrived, state.startedAtMs)

  if (now < (state.transitionUntilMs ?? now) && !failedPath) return true
  finishUnitWakeTransition(unit, state)
  return true
}

export function isVillager(unit: UnitEntity): boolean {
  return unit.type === UNIT_TYPES.villager
}

export function settleSleepState(unit: UnitEntity): void {
  settleUnitRestForTimeJump(unit, true)
}

export function shouldRouteUnitToInteriorExit(context: GameContextLike, unit: UnitEntity): boolean {
  return (
    (context.map?.mapType === 'interior' || Boolean(getBuildingInteriorSpaceForUnit(unit))) &&
    unit.shelterState?.reason === 'sleep' &&
    Boolean(context.routeInteriorUnitToExit)
  )
}

export function evacuateUnitsFromShelter(building: BuildingEntity, options: { force?: boolean } = {}): void {
  const expelled = building.context ? expelBuildingInteriorOccupants(building.context, building) : []
  for (const unit of building.owner?.units ?? []) {
    const state = unit.shelterState
    if (state?.shelter !== building && state?.restTarget !== building) continue
    if (!expelled.includes(unit)) wakeUnit(unit, { force: options.force ?? true })
    if (isSleepTime(unit.context!) && !unit.shelterState) sendUnitToRest(unit, 'sleep')
  }
}

export function evacuateUnitsIfShelterUnsafe(building: BuildingEntity): void {
  if (!isShelterUnsafe(building)) return
  evacuateUnitsFromShelter(building, { force: true })
}

export function updateMovingRestUnit(unit: UnitEntity): void {
  const state = unit.shelterState as TimedUnitRestState | null | undefined
  if (!state) return
  if (state.restTarget && !isRestTargetAvailable(unit, state.restTarget)) {
    clearUnitSpacePortalRoute(unit)
    state.restTarget = null
    state.targetCell = null
    rerouteRestUnit(unit)
    return
  }
  if (unit.spacePortalState) return
  if (updateWindingDownRestUnit(unit, state)) return
  if (updateWakingUpRestUnit(unit, state)) return
  if (state.status !== 'movingToRest') return
  keepSleepingOutsideVisual(unit)
  const targetCell = state.targetCell
  const arrived = Boolean(
    targetCell && sameCellMapSpace(unit, targetCell) && unit.i === targetCell.i && unit.j === targetCell.j
  )
  const elapsed = (unit.context?.scheduler?.elapsedMs ?? 0) - (state.startedAtMs ?? 0)
  const orderStillPending = hasPendingRestOrder(unit, targetCell)
  const failedPath =
    !orderStillPending && elapsed >= REST_ORDER_GRACE_MS && !unit.path?.length && unit.dest !== targetCell

  if (arrived) {
    if (hasDailyRestSchedule(unit) && !shouldVillagerBeAsleep(unit)) waitOutsideForSleep(unit)
    else sleepOutside(unit, state.reason)
  } else if (failedPath && !retrySleepSpotPath(unit, state)) {
    const failedTarget = state.restTarget
    state.restTarget = null
    state.targetCell = null
    if (failedTarget) rerouteRestUnit(unit, failedTarget)
    else {
      waitOutsideForSleep(unit)
      if (shouldVillagerBeAsleep(unit)) sleepOutside(unit, state.reason)
    }
  }
}

export function wakeRestingUnitInstant(context: GameContextLike, unit: UnitEntity): void {
  const routeToInteriorExit = shouldRouteUnitToInteriorExit(context, unit)
  const returnTask = routeToInteriorExit ? getRestReturnTask(unit) : null
  wakeUnitInstant(unit, { force: true, mode: routeToInteriorExit ? 'order' : 'resume' })
  if (routeToInteriorExit) context.routeInteriorUnitToExit?.(unit, returnTask)
}
