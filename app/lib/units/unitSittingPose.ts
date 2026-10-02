import { SHEET_TYPES } from '../../constants'
import type { UnitEntity } from '../../types/entities'
import { hasDailyRestSchedule, shouldVillagerBeAsleep, shouldVillagerWork } from './villagerSchedule'
import { isHeroControlled } from './unitControl'

function canSitDuringBreak(unit: UnitEntity): boolean {
  if (
    !hasDailyRestSchedule(unit) ||
    !unit.sittingSheet ||
    unit.isDead ||
    unit.isDestroyed ||
    unit.visible === false ||
    unit.mountedOnHorse ||
    unit.isDirectMoving ||
    isHeroControlled(unit) ||
    unit.followingHero ||
    unit.lookingAtHero ||
    unit.trainingTargetType ||
    unit.sleepVisualState ||
    unit.action ||
    unit.dest ||
    unit.pendingOrder ||
    unit.path?.length ||
    unit.combatMode ||
    unit.waitingForEnergyAction ||
    unit.inactif === false
  )
    return false

  const state = unit.shelterState
  if (
    state &&
    state.status !== 'outside' &&
    state.status !== 'wakingUp' &&
    !(state.status === 'inside' && state.reason === 'sleep')
  )
    return false
  if ((unit.restWakeLockUntilMs ?? 0) > (unit.context?.scheduler?.elapsedMs ?? 0)) return false
  return !shouldVillagerBeAsleep(unit) && !shouldVillagerWork(unit)
}

/** Pose choice is baked by gender; runtime only switches between rest and activity. */
export function getUnitRestVisualSheet(unit: UnitEntity, requestedSheet: string): string {
  if (requestedSheet !== SHEET_TYPES.standing && requestedSheet !== SHEET_TYPES.sitting) return requestedSheet
  return canSitDuringBreak(unit) ? SHEET_TYPES.sitting : SHEET_TYPES.standing
}

/** Reconcile time changes, wake-up waiting and restored saves without changing orders. */
export function syncUnitSittingPose(unit: UnitEntity): void {
  const current = unit.currentSheet
  if (!current) return
  if (current !== SHEET_TYPES.standing && current !== SHEET_TYPES.sitting) return
  const next = getUnitRestVisualSheet(unit, current)
  if (next !== current) unit.setTextures?.(next)
}
