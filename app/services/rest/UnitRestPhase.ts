import { isChiefEscort } from '../../lib/units/chiefEscort'
import { isChiefUnit } from '../../lib/chief'
import {
  hasDailyRestSchedule,
  isSoldierUnit,
  isVillagerLunchTime,
  shouldVillagerBeAsleep,
  shouldVillagerBeAwake,
  shouldVillagerReturnHome,
  shouldVillagerWork,
} from '../../lib/units/village/villagerSchedule'
import type { GameContextLike } from '../../types/context'
import type { UnitEntity } from '../../types/entities'
import { isSleepTime } from './UnitRestRules'
import { isVillager } from './UnitRestStateTransitions'

export function shouldUnitReturnHome(context: GameContextLike, unit: UnitEntity): boolean {
  if (isChiefUnit(unit) || isSoldierUnit(unit)) return !shouldVillagerWork(unit)
  return isVillager(unit)
    ? shouldVillagerReturnHome(unit) ||
        Boolean(unit.shelterState && !shouldVillagerWork(unit) && !isVillagerLunchTime(unit))
    : isSleepTime(context)
}

export function shouldUnitSleep(context: GameContextLike, unit: UnitEntity): boolean {
  return hasDailyRestSchedule(unit) ? shouldVillagerBeAsleep(unit) : isSleepTime(context)
}

export function shouldUnitWake(context: GameContextLike, unit: UnitEntity): boolean {
  return hasDailyRestSchedule(unit) ? shouldVillagerBeAwake(unit) : !isSleepTime(context)
}

export function needsUnitRestChecks(context: GameContextLike, unit: UnitEntity): boolean {
  return Boolean(
    unit.shelterState ||
      unit.suspendedRestState ||
      shouldUnitReturnHome(context, unit) ||
      (isVillager(unit) && isVillagerLunchTime(unit))
  )
}

export function canClaimPendingBed(context: GameContextLike, unit: UnitEntity): boolean {
  return (
    shouldUnitReturnHome(context, unit) &&
    !shouldUnitSleep(context, unit) &&
    (!isSoldierUnit(unit) || (shouldVillagerReturnHome(unit) && !isChiefEscort(unit)))
  )
}
