import { UNIT_TYPES } from '../../constants'
import { hasBuildingShelterCapacity } from '../../lib/buildings/buildingOccupancy'
import { shouldVillagerBeAsleep } from '../../lib/units/villagerSchedule'
import type { GameContextLike } from '../../types/context'
import type { BuildingEntity,UnitEntity } from '../../types/entities'
import {
expelBuildingInteriorOccupants,
getBuildingInteriorSpaceForUnit,
settleUnitAtBuildingInteriorSleepCell,
} from '../BuildingInteriorSpaceSystem'
import type { TimedUnitRestState } from './UnitRestLifecycle'
import {
enterShelter,
enterShelterInstant,
finishUnitWakeTransition,
getRestReturnTask,
rerouteRestUnit,
retryShelterPath,
sendUnitToRest,
sleepOutside,
sleepOutsideAtCellInstant,
waitOutsideForSleep,
wakeUnit,
wakeUnitInstant,
} from './UnitRestLifecycle'
import {
isShelterUnsafe,
isSleepTime,
isUsableShelter,
REST_MAX_RETRIES,
REST_ORDER_GRACE_MS,
shouldRest,
} from './UnitRestRules'
import { hasFailedTransitionPath,hasPendingRestOrder,updateWindingDownRestUnit } from './UnitRestWindDown'
import { keepSleepingOutsideVisual } from './UnitSleepVisuals'

function retrySleepSpotPath(unit: UnitEntity, state: TimedUnitRestState): boolean {
  const targetCell = state.targetCell
  if (!targetCell) return false
  const retryCount = state.retryCount ?? 0
  if (retryCount >= REST_MAX_RETRIES) return false
  state.retryCount = retryCount + 1
  state.startedAtMs = unit.context?.scheduler?.elapsedMs ?? state.startedAtMs ?? 0
  unit.sendToEvt?.(targetCell, null, {
    forceRepath: true,
    preserveAutonomy: true,
    allowPassageStop: state.location === 'shelter',
  })
  return true
}

function updateWakingUpRestUnit(unit: UnitEntity, state: TimedUnitRestState): boolean {
  if (state.status !== 'wakingUp') return false
  if (isVillager(unit) ? shouldVillagerBeAsleep(unit) : isSleepTime(unit.context!)) {
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

function settleMovingRestState(unit: UnitEntity, state: TimedUnitRestState | null | undefined): boolean {
  if (state?.status !== 'movingToRest') return false
  if (isUsableShelter(state.shelter, unit.owner)) {
    enterShelterInstant(unit, state.shelter)
    return true
  }
  if (state.reason === 'sleep' && state.location === 'outside' && state.targetCell) {
    sleepOutsideAtCellInstant(unit, state.targetCell, 'sleep')
    return true
  }
  return false
}

export function isVillager(unit: UnitEntity): boolean {
  return unit.type === UNIT_TYPES.villager
}

export function settleSleepState(unit: UnitEntity): void {
  const state = unit.shelterState as TimedUnitRestState | null | undefined
  if (state?.status === 'inside') return
  if (settleMovingRestState(unit, state)) return
  if (state?.status === 'outside') {
    sleepOutside(unit, 'sleep', { visual: 'finalFrame' })
    return
  }
  if (!shouldRest(unit, { ignoreWakeLock: true })) return
  sendUnitToRest(unit, 'sleep', { transition: false })
  const nextState = unit.shelterState as TimedUnitRestState | null | undefined
  if (settleMovingRestState(unit, nextState)) return
  if (nextState?.status === 'outside') sleepOutside(unit, 'sleep', { visual: 'finalFrame' })
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
    if (state?.shelter !== building) continue
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
  if (updateWindingDownRestUnit(unit, state)) return
  if (updateWakingUpRestUnit(unit, state)) return
  if (state.status !== 'movingToRest') return
  keepSleepingOutsideVisual(unit)
  const targetCell = state.targetCell
  const arrived = Boolean(targetCell && unit.i === targetCell.i && unit.j === targetCell.j)
  const elapsed = (unit.context?.scheduler?.elapsedMs ?? 0) - (state.startedAtMs ?? 0)
  const orderStillPending = hasPendingRestOrder(unit, targetCell)
  const failedPath =
    !orderStillPending && elapsed >= REST_ORDER_GRACE_MS && !unit.path?.length && unit.dest !== targetCell

  const interiorSpace = getBuildingInteriorSpaceForUnit(unit)
  if (interiorSpace && state.reason === 'sleep') {
    if (arrived) {
      settleUnitAtBuildingInteriorSleepCell(unit, interiorSpace, targetCell)
    } else if (failedPath) {
      if (retrySleepSpotPath(unit, state)) return
      settleUnitAtBuildingInteriorSleepCell(unit, interiorSpace, unit.currentCell ?? targetCell)
    }
    return
  }

  if (!isUsableShelter(state.shelter, unit.owner)) {
    if (state.location === 'outside' && targetCell) {
      if (arrived) {
        if (isVillager(unit) && !shouldVillagerBeAsleep(unit)) waitOutsideForSleep(unit)
        else sleepOutside(unit, state.reason)
      } else if (failedPath && !retrySleepSpotPath(unit, state)) {
        if (isVillager(unit) && !shouldVillagerBeAsleep(unit)) waitOutsideForSleep(unit)
        else sleepOutside(unit, state.reason)
      }
      return
    }
    if (isVillager(unit) && !shouldVillagerBeAsleep(unit)) waitOutsideForSleep(unit)
    else sleepOutside(unit, state.reason)
    return
  }

  if (arrived) {
    if (!hasBuildingShelterCapacity(state.shelter, unit.owner?.units ?? [], { exclude: unit })) {
      rerouteRestUnit(unit)
      return
    }
    enterShelter(unit, state.shelter)
  } else if (failedPath) {
    if (retryShelterPath(unit, state)) return
    if (isVillager(unit) && !shouldVillagerBeAsleep(unit)) waitOutsideForSleep(unit)
    else sleepOutside(unit, state.reason)
  }
}

export function wakeRestingUnitInstant(context: GameContextLike, unit: UnitEntity): void {
  const routeToInteriorExit = shouldRouteUnitToInteriorExit(context, unit)
  const returnTask = routeToInteriorExit ? getRestReturnTask(unit) : null
  wakeUnitInstant(unit, { force: true, mode: routeToInteriorExit ? 'order' : 'resume' })
  if (routeToInteriorExit) context.routeInteriorUnitToExit?.(unit, returnTask)
}
