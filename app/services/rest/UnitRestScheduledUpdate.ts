import { getChiefAudienceBuilding, isChiefEscort } from '../../lib/units/chiefEscort'
import { isChiefUnit } from '../../lib/chief'
import { clearUnitOverheadIndicator } from '../../lib/entities/overheadIndicator'
import { syncUnitSittingPose } from '../../lib/units/visuals/unitSittingPose'
import {
  isSoldierUnit,
  isVillagerLunchTime,
  shouldVillagerReturnHome,
  shouldVillagerWork,
} from '../../lib/units/village/villagerSchedule'
import type { GameContextLike } from '../../types/context'
import type { UnitEntity } from '../../types/entities'
import { putRestingUnitToSleep, sendUnitToRest, wakeUnitInstant } from './UnitRestLifecycle'
import { shouldUnitReturnHome, shouldUnitSleep, shouldUnitWake } from './UnitRestPhase'
import { isUnitRestWakeLocked, shouldRest } from './UnitRestRules'
import { wakeRestingUnitAtExit } from './UnitRestRuntimeHelpers'
import { waitOutsideForSleep } from './UnitRestSleep'
import { isVillager, updateMovingRestUnit } from './UnitRestStateTransitions'
import { playSleepingWakeVisual } from './UnitSleepVisuals'

export function updateScheduledUnitRest(context: GameContextLike, unit: UnitEntity): void {
  if (((isChiefUnit(unit) && unit.owner?.type === 'AI') || isSoldierUnit(unit)) && unit.controlMode !== 'hero') {
    updateDailyUnitRest(context, unit)
    return
  }
  if (isVillager(unit) && isVillagerLunchTime(unit)) {
    updateLunchBreak(context, unit)
    return
  }
  if (unit.shelterState?.mealBreak && shouldVillagerWork(unit)) {
    wakeUnitInstant(unit)
    return
  }
  updateNightlyRest(context, unit)
}

function updateLunchBreak(context: GameContextLike, unit: UnitEntity): void {
  // Eat near the workplace, retaining the task for the normal resume path.
  if (!unit.shelterState && !unit.lookingAtHero && shouldRest(unit)) waitOutsideForSleep(unit)
  else if (unit.shelterState) updateMovingRestUnit(unit)
  if (unit.shelterState) unit.shelterState.mealBreak = true
  settleRestPose(context, unit)
}

function restoreInterruptedSleep(context: GameContextLike, unit: UnitEntity): boolean {
  const suspended = unit.suspendedRestState
  if (!suspended || isUnitRestWakeLocked(unit) || unit.lookingAtHero || !shouldUnitReturnHome(context, unit))
    return false
  unit.suspendedRestState = null
  unit.shelterState = suspended
  return sendUnitToRest(unit, 'sleep', { transition: false })
}

function updateNightlyRest(context: GameContextLike, unit: UnitEntity): void {
  const shouldReturnHome = shouldUnitReturnHome(context, unit)
  if (shouldUnitWake(context, unit) && !shouldReturnHome) {
    unit.suspendedRestState = null
    if (unit.shelterState && unit.shelterState.status !== 'wakingUp') wakeRestingUnitAtExit(context, unit)
    else if (unit.shelterState) updateMovingRestUnit(unit)
    return
  }
  if (!unit.shelterState) {
    if (restoreInterruptedSleep(context, unit)) return
    if (shouldReturnHome && shouldRest(unit) && sendUnitToRest(unit, 'sleep')) updateMovingRestUnit(unit)
    return
  }
  updateMovingRestUnit(unit)
  settleRestPose(context, unit)
}

function wakeInPlace(unit: UnitEntity): void {
  clearUnitOverheadIndicator(unit)
  playSleepingWakeVisual(unit, () => syncUnitSittingPose(unit))
}

/** True when an AI chief holding audience keeps its current rest state for this tick. */
function holdChiefAudience(context: GameContextLike, unit: UnitEntity): boolean {
  if (!isChiefUnit(unit) || !getChiefAudienceBuilding(unit, context)) return false
  if (!unit.shelterState) return true
  if (unit.shelterState.status !== 'inside' || !shouldVillagerWork(unit)) return false
  if (unit.sleepVisualState === 'sleeping') wakeInPlace(unit)
  return true
}

function settleRestPose(context: GameContextLike, unit: UnitEntity): void {
  const state = unit.shelterState
  if (state?.reason !== 'sleep' || (state.status !== 'inside' && state.status !== 'outside')) return
  if (shouldUnitSleep(context, unit)) {
    if (!unit.sleepVisualState && !unit.lookingAtHero && !isUnitRestWakeLocked(unit)) putRestingUnitToSleep(unit)
  } else if (unit.sleepVisualState === 'sleeping') {
    // Wake in the same room and keep the reserved seat until the morning break ends.
    wakeInPlace(unit)
  } else syncUnitSittingPose(unit)
}

function updateDailyUnitRest(context: GameContextLike, unit: UnitEntity): void {
  if (holdChiefAudience(context, unit)) return
  if (shouldVillagerWork(unit)) {
    if (unit.shelterState) wakeRestingUnitAtExit(context, unit)
    return
  }
  if (!unit.shelterState) {
    if (unit.lookingAtHero || !shouldRest(unit)) return
    if (isSoldierUnit(unit) && (isChiefEscort(unit) || !shouldVillagerReturnHome(unit))) waitOutsideForSleep(unit)
    else sendUnitToRest(unit, 'sleep', { transition: false })
  }
  updateMovingRestUnit(unit)
  settleRestPose(context, unit)
}
