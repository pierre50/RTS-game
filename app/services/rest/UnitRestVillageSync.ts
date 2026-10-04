import { reconcileHouseholds } from '../../lib/housing/households'
import { configureVillageNightWatch } from '../../lib/units/village/villageNightWatch'
import { settleChiefEscortAtPost } from './ChiefEscortPlacement'
import { SHEET_TYPES } from '../../constants'
import { setUnitVisualSheet } from '../../lib/units/visuals/unitVisualTransition'
import { waitOutsideForSleep } from './UnitRestSleep'
import { getChiefAudienceBuilding, isChiefEscort } from '../../lib/units/chiefEscort'
import { isChiefUnit } from '../../lib/chief'
import { clearUnitOverheadIndicator } from '../../lib/entities/overheadIndicator'
import { syncUnitSittingPose } from '../../lib/units/visuals/unitSittingPose'
import {
  isSoldierUnit,
  isVillagerLunchTime,
  shouldVillagerBeAsleep,
  shouldVillagerReturnHome,
  shouldVillagerWork,
} from '../../lib/units/village/villagerSchedule'
import type { GameContextLike } from '../../types/context'
import type { UnitEntity } from '../../types/entities'
import { putRestingUnitToSleep, settleUnitRestForTimeJump } from './UnitRestLifecycle'
import { shouldRest } from './UnitRestRules'
import { isVillager, wakeRestingUnitInstant } from './UnitRestStateTransitions'
import { clearSleepingVisualState, setDetachedShadowsVisible } from './UnitSleepVisuals'

/** Reconcile only the returning base, before any suspended walking order resumes. */
export function synchronizeVillageRestUnits(context: GameContextLike, units: UnitEntity[]): void {
  // Escorts can rest only after their chief has settled.
  const ordered = [...units].sort((a, b) => Number(isChiefUnit(b)) - Number(isChiefUnit(a)))
  for (const owner of new Set(units.map(unit => unit.owner)))
    if (owner) {
      reconcileHouseholds(owner)
      configureVillageNightWatch(owner)
    }
  for (const unit of ordered) synchronizeUnitRest(context, unit)
}

function isRestSyncSkipped(unit: UnitEntity, chief: boolean, soldier: boolean): boolean {
  return Boolean(
    (!isVillager(unit) && !chief && !soldier) ||
      unit.isDead ||
      unit.isDestroyed ||
      unit.lookingAtHero ||
      unit.pendingOrder ||
      unit.spacePortalState ||
      !shouldRest(unit)
  )
}

function synchronizeUnitRest(context: GameContextLike, unit: UnitEntity): void {
  const chief = isChiefUnit(unit)
  const soldier = isSoldierUnit(unit)
  if (soldier) settleChiefEscortAtPost(unit, context)
  if (isRestSyncSkipped(unit, chief, soldier)) return
  if (unit.shelterState) unit.shelterState.mealBreak = isVillagerLunchTime(unit)
  if (soldier) {
    synchronizeSoldierRest(context, unit)
    return
  }
  if (chief && getChiefAudienceBuilding(unit, context)) return
  const returningHome = !shouldVillagerWork(unit) && !isVillagerLunchTime(unit)
  if (!returningHome && !shouldVillagerBeAsleep(unit)) {
    synchronizeAwakeVillager(context, unit)
    return
  }
  // Keep an established outdoor sleeper outside; passage safety still applies.
  if (unit.shelterState?.status === 'outside' && unit.sleepVisualState === 'sleeping') {
    settleRestPhase(unit)
    return
  }
  settleUnitRestForTimeJump(unit, shouldVillagerBeAsleep(unit), !unit.shelterState)
  settleRestPhase(unit)
}

function synchronizeSoldierRest(context: GameContextLike, unit: UnitEntity): void {
  if (shouldVillagerWork(unit)) {
    if (unit.shelterState) wakeRestingUnitInstant(context, unit)
    return
  }
  if (!unit.shelterState && (!shouldVillagerReturnHome(unit) || isChiefEscort(unit)))
    waitOutsideForSleep(unit, { instant: true })
  settleUnitRestForTimeJump(unit, shouldVillagerBeAsleep(unit), shouldVillagerReturnHome(unit) && !isChiefEscort(unit))
  if (!shouldVillagerBeAsleep(unit)) settleAwakeRestPose(unit)
}

function synchronizeAwakeVillager(context: GameContextLike, unit: UnitEntity): void {
  if (isVillagerLunchTime(unit)) {
    if (!unit.shelterState) waitOutsideForSleep(unit, { instant: true })
    if (unit.shelterState) unit.shelterState.mealBreak = true
    settleAwakeRestPose(unit)
  } else if (unit.shelterState) wakeRestingUnitInstant(context, unit)
}

function settleRestPhase(unit: UnitEntity): void {
  if (shouldVillagerBeAsleep(unit)) putRestingUnitToSleep(unit, { instant: true })
  else settleAwakeRestPose(unit)
}

function settleAwakeRestPose(unit: UnitEntity): void {
  clearSleepingVisualState(unit)
  clearUnitOverheadIndicator(unit)
  setDetachedShadowsVisible(unit, true)
  setUnitVisualSheet(unit, SHEET_TYPES.standing, { play: 'stop' })
  syncUnitSittingPose(unit)
}
