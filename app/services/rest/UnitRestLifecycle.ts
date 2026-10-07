import { selectRestSite } from './UnitRestPlanning'
import { isRestTargetAvailable } from './UnitRestShelter'
import { cancelSleepingWakeVisual, clearSleepingVisualState } from './UnitSleepVisuals'
import { sameCellMapSpace } from '../../lib/mapSpaces'
import { routeUnitToRestTarget } from './UnitRestRoute'
import { SHEET_TYPES, UNIT_TYPES } from '../../constants'
import { unitHasDeliverableResources } from '../../lib/resources/resourceDelivery'
import { hasDailyRestSchedule, shouldVillagerBeAsleep } from '../../lib/units/village/villagerSchedule'
import type { BuildingEntity, UnitEntity, UnitRestReason } from '../../types/entities'
import {
  canSleepWithoutRestSite,
  canStartSleepRest,
  getNearestRestSite,
  getRestTransitionCell,
  getRestTransitionDurationMs,
  type UnitRestSite,
} from './UnitRestRules'
import { putRestingUnitToSleep, sleepOutside, waitOutsideForSleep } from './UnitRestSleep'
import { placeUnitAtCell, rememberRestState } from './UnitRestState'

type RestTransitionOptions = {
  transition?: boolean
}

function isCurrentOutsideRestSite(unit: UnitEntity, site: UnitRestSite): boolean {
  return (
    !site.restTarget &&
    sameCellMapSpace(unit, site.targetCell) &&
    site.targetCell.i === unit.i &&
    site.targetCell.j === unit.j
  )
}

export function sendUnitToRestSite(
  unit: UnitEntity,
  reason: UnitRestReason,
  restSite: UnitRestSite,
  options: RestTransitionOptions = {}
): boolean {
  if (restSite.restTarget && !isRestTargetAvailable(unit, restSite.restTarget)) return false
  const transition = options.transition ?? unit.context?.restTransitionsEnabled === true
  const transitionTargetCell = transition ? getRestTransitionCell(unit, restSite) : null
  const now = unit.context?.scheduler?.elapsedMs ?? 0
  rememberRestState(unit, {
    status: transition && transitionTargetCell ? 'windingDown' : 'movingToRest',
    reason,
    location: restSite.location,
    shelter: restSite.shelter,
    restTarget: restSite.restTarget,
    targetCell: restSite.targetCell,
    transitionTargetCell,
    transitionUntilMs: transition ? now + getRestTransitionDurationMs(unit, 'windingDown') : now,
    transitionStep: 0,
    startedAtMs: now,
    retryCount: 0,
  })
  cancelSleepingWakeVisual(unit)
  clearSleepingVisualState(unit)
  unit.setTextures?.(SHEET_TYPES.standing)
  unit.actionLocked = false
  if (transitionTargetCell) unit.sendToEvt?.(transitionTargetCell, null, { forceRepath: true, preserveAutonomy: true })
  else if (!routeUnitToRestTarget(unit, unit.shelterState!)) {
    waitOutsideForSleep(unit)
    return false
  }
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
  return selectRestSite(unit, undefined, restSite => {
    if (!restSite) {
      if (reason === 'sleep' && canSleepWithoutRestSite(unit)) {
        sleepOutside(unit, reason)
        return true
      }
      return false
    }
    if (hasDailyRestSchedule(unit) && isCurrentOutsideRestSite(unit, restSite)) {
      waitOutsideForSleep(unit)
      if (shouldVillagerBeAsleep(unit)) putRestingUnitToSleep(unit)
      return true
    }
    return sendUnitToRestSite(unit, reason, restSite, {
      ...options,
      transition: hasDailyRestSchedule(unit) ? false : options.transition,
    })
  })
}

export function continueRestAfterDelivery(unit: UnitEntity): boolean {
  if (unit.shelterState?.reason !== 'sleep' || unit.shelterState.status !== 'delivering') return false
  const state = unit.shelterState
  return selectRestSite(unit, undefined, restSite => {
    if (!restSite || isCurrentOutsideRestSite(unit, restSite)) {
      waitOutsideForSleep(unit)
      if (shouldVillagerBeAsleep(unit)) putRestingUnitToSleep(unit)
      return true
    }
    unit.shelterState = state
    return sendUnitToRestSite(unit, 'sleep', restSite, { transition: false })
  })
}

export function rerouteRestUnit(unit: UnitEntity, excludedTarget?: BuildingEntity | null): boolean {
  const state = unit.shelterState
  if (!state?.reason) return false
  return selectRestSite(unit, excludedTarget, restSite => {
    if (!restSite || isCurrentOutsideRestSite(unit, restSite)) {
      waitOutsideForSleep(unit)
      if (shouldVillagerBeAsleep(unit)) putRestingUnitToSleep(unit)
      return true
    }
    unit.shelterState = state
    return sendUnitToRestSite(unit, 'sleep', restSite, { transition: false })
  })
}

export function settleUnitRestForTimeJump(unit: UnitEntity, sleep: boolean, refreshSite = false): boolean {
  if (unit.shelterState?.restTarget && !isRestTargetAvailable(unit, unit.shelterState.restTarget)) refreshSite = true
  if (unit.shelterState?.status === 'movingToRest' && !unit.shelterState.targetCell) refreshSite = true
  if (!unit.shelterState || refreshSite) {
    if (!canStartSleepRest(unit)) return false
    const site = getNearestRestSite(unit)
    if (site) {
      rememberRestState(unit, { status: 'movingToRest', reason: 'sleep', ...site })
      placeUnitAtCell(unit, site.targetCell)
    }
    waitOutsideForSleep(unit, { instant: true })
  }
  const state = unit.shelterState
  if (!state) return false
  if (state.status === 'movingToRest') {
    if (state.targetCell) placeUnitAtCell(unit, state.targetCell)
    waitOutsideForSleep(unit, { instant: true })
  }
  if (sleep) putRestingUnitToSleep(unit, { instant: true })
  return true
}

export { putRestingUnitToSleep, sleepOutside, waitOutsideForSleep } from './UnitRestSleep'
export type { SleepOutsideVisualMode, TimedUnitRestState } from './UnitRestSleep'
export {
  finishUnitWakeTransition,
  getRestReturnTask,
  startUnitWakeTransitionFromTask,
  wakeUnit,
  wakeUnitInstant,
} from './UnitRestWake'
