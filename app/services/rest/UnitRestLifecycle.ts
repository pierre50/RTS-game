import { UNIT_TYPES } from '../../constants'
import { unitHasDeliverableResources } from '../../lib/resources/resourceDelivery'
import { shouldVillagerBeAsleep } from '../../lib/units/villagerSchedule'
import type { UnitEntity, UnitRestReason, UnitRestState } from '../../types/entities'
import {
  canSleepWithoutRestSite,
  canStartSleepRest,
  getNearestRestSite,
  getRestTransitionCell,
  getRestTransitionDurationMs,
  getShelterEntryCell,
  isUsableShelter,
  REST_MAX_RETRIES,
  type UnitRestSite,
} from './UnitRestRules'
import { enterShelterInstant, putRestingUnitToSleep, sleepOutside, waitOutsideForSleep } from './UnitRestSleep'
import { placeUnitAtCell, rememberRestState } from './UnitRestState'

type RestTransitionOptions = {
  transition?: boolean
}

function isCurrentOutsideRestSite(unit: UnitEntity, site: UnitRestSite): boolean {
  return site.location === 'outside' && site.targetCell.i === unit.i && site.targetCell.j === unit.j
}

export function sendUnitToRestSite(
  unit: UnitEntity,
  reason: UnitRestReason,
  restSite: UnitRestSite,
  options: RestTransitionOptions = {}
): boolean {
  const transition = options.transition ?? unit.context?.restTransitionsEnabled === true
  const transitionTargetCell = transition ? getRestTransitionCell(unit, restSite) : null
  const now = unit.context?.scheduler?.elapsedMs ?? 0
  rememberRestState(unit, {
    status: transition && transitionTargetCell ? 'windingDown' : 'movingToRest',
    reason,
    location: restSite.location,
    shelter: restSite.shelter,
    targetCell: restSite.targetCell,
    transitionTargetCell,
    transitionUntilMs: transition ? now + getRestTransitionDurationMs(unit, 'windingDown') : now,
    transitionStep: 0,
    startedAtMs: now,
    retryCount: 0,
  })
  unit.actionLocked = false
  unit.sendToEvt?.(transitionTargetCell ?? restSite.targetCell, null, {
    forceRepath: true,
    preserveAutonomy: true,
    allowPassageStop: restSite.location === 'shelter' && !transitionTargetCell,
  })
  return true
}

export function sendUnitToRest(unit: UnitEntity, reason: UnitRestReason, options: RestTransitionOptions = {}): boolean {
  if (reason === 'sleep' && !canStartSleepRest(unit)) return false
  if (
    reason === 'sleep' &&
    unit.type === UNIT_TYPES.villager &&
    !unit.shelterState &&
    !unit.resourceDeliveryState &&
    unitHasDeliverableResources(unit)
  ) {
    rememberRestState(unit, {
      status: 'delivering',
      reason,
      location: 'outside',
      shelter: null,
      targetCell: null,
    })
    if (unit.sendToDelivery?.() === true) return true
    unit.shelterState = null
  }
  const restSite = getNearestRestSite(unit)
  if (!restSite) {
    if (reason === 'sleep' && canSleepWithoutRestSite(unit)) {
      sleepOutside(unit, reason)
      return true
    }
    return false
  }
  if (unit.type === UNIT_TYPES.villager && isCurrentOutsideRestSite(unit, restSite)) {
    waitOutsideForSleep(unit)
    if (shouldVillagerBeAsleep(unit)) putRestingUnitToSleep(unit)
    return true
  }
  return sendUnitToRestSite(unit, reason, restSite, {
    ...options,
    transition: unit.type === UNIT_TYPES.villager ? false : options.transition,
  })
}

export function continueRestAfterDelivery(unit: UnitEntity): boolean {
  if (unit.shelterState?.reason !== 'sleep' || unit.shelterState.status !== 'delivering') return false
  const state = unit.shelterState
  const restSite = getNearestRestSite(unit)
  if (!restSite || isCurrentOutsideRestSite(unit, restSite)) {
    waitOutsideForSleep(unit)
    if (shouldVillagerBeAsleep(unit)) putRestingUnitToSleep(unit)
    return true
  }
  unit.shelterState = state
  return sendUnitToRestSite(unit, 'sleep', restSite, { transition: false })
}

export function rerouteRestUnit(unit: UnitEntity): boolean {
  const state = unit.shelterState
  if (!state?.reason) return false
  const restSite = getNearestRestSite(unit)
  if (!restSite || isCurrentOutsideRestSite(unit, restSite)) {
    waitOutsideForSleep(unit)
    if (shouldVillagerBeAsleep(unit)) putRestingUnitToSleep(unit)
    return true
  }
  unit.shelterState = state
  return sendUnitToRestSite(unit, state.reason, restSite, { transition: false })
}

export function settleUnitRestForTimeJump(unit: UnitEntity, sleep: boolean): boolean {
  if (!unit.shelterState && !sendUnitToRest(unit, 'sleep', { transition: false })) return false
  const state = unit.shelterState
  if (!state) return false
  if (state.status === 'movingToRest' && isUsableShelter(state.shelter, unit.owner)) {
    enterShelterInstant(unit, state.shelter)
  } else if (state.status === 'movingToRest') {
    if (state.location === 'outside' && state.targetCell) placeUnitAtCell(unit, state.targetCell)
    waitOutsideForSleep(unit)
  }
  if (sleep) putRestingUnitToSleep(unit, { instant: true })
  return true
}

export function retryShelterPath(unit: UnitEntity, state: UnitRestState): boolean {
  if (!state.shelter || !isUsableShelter(state.shelter, unit.owner)) return false
  const retryCount = state.retryCount ?? 0
  if (retryCount >= REST_MAX_RETRIES) return false
  const nextCell = getShelterEntryCell(unit, state.shelter)
  if (!nextCell) return false
  state.targetCell = nextCell
  state.retryCount = retryCount + 1
  state.startedAtMs = unit.context?.scheduler?.elapsedMs ?? state.startedAtMs ?? 0
  unit.sendToEvt?.(nextCell, null, {
    forceRepath: true,
    preserveAutonomy: true,
    allowPassageStop: true,
  })
  return true
}

export {
  enterShelter,
  enterShelterInstant,
  putRestingUnitToSleep,
  sleepOutside,
  sleepOutsideAtCellInstant,
  waitOutsideForSleep,
} from './UnitRestSleep'
export type { SleepOutsideVisualMode, TimedUnitRestState } from './UnitRestSleep'
export {
  finishUnitWakeTransition,
  getRestReturnTask,
  startUnitWakeTransitionFromTask,
  wakeUnit,
  wakeUnitInstant,
} from './UnitRestWake'
