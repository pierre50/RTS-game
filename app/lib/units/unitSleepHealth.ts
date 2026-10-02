import { DAY_NIGHT_CONFIG } from '../../config/gameplay'
import { UNIT_TYPES } from '../../constants/entities'
import type { UnitEntity } from '../../types/entities'
import type { SaveEntityState } from '../../types/save'
import { notifyHeroHealthChanged } from './unitHealth'
import { getVillagerSchedule, hasDailyRestSchedule } from './villagerSchedule'

const HOUR_MS = DAY_NIGHT_CONFIG.dayLengthMs / DAY_NIGHT_CONFIG.hoursPerDay
const FULL_HEALTH_SLEEP_MS = 8 * HOUR_MS

type SleepHealthUnit = Pick<
  SaveEntityState,
  'type' | 'controlMode' | 'hitPoints' | 'totalHitPoints' | 'isDead' | 'isDestroyed'
>

/** Eight game hours of sleep restore one full health bar. Never revive a dead unit. */
function restoreUnitSleepHealth(unit: SleepHealthUnit, elapsedMs: number): void {
  if (unit.isDead || unit.isDestroyed) return
  const total = unit.totalHitPoints ?? 0
  const current = unit.hitPoints ?? total
  if (total <= 0 || current <= 0 || current >= total || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return
  unit.hitPoints = Math.min(total, current + (total * elapsedMs) / FULL_HEALTH_SLEEP_MS)
}

export function updateUnitSleepHealth(unit: UnitEntity, elapsedMs: number): void {
  if (unit.sleepVisualState !== 'sleeping') return
  const isHero =
    unit.type === UNIT_TYPES.hero || unit.controlMode === 'hero' || unit.context?.controls?.heroUnit === unit
  const rest = unit.shelterState
  if (!isHero && (rest?.reason !== 'sleep' || (rest.status !== 'inside' && rest.status !== 'outside'))) return
  const previousHitPoints = unit.hitPoints
  restoreUnitSleepHealth(unit, elapsedMs)
  if (unit.hitPoints !== previousHitPoints) notifyHeroHealthChanged(unit)
}

/** Integrate scheduled sleep across midnight, including partial nights on an unloaded map. */
export function restoreOfflineUnitSleepHealth(
  unit: SleepHealthUnit &
    Pick<SaveEntityState, 'i' | 'j' | 'label' | 'dailySchedule' | 'followingHero' | 'trainingTargetType'>,
  fromMinute: number,
  toMinute: number
): void {
  // The hero only rests through explicit sleep, never an NPC's offline schedule.
  if (unit.type === UNIT_TYPES.hero || unit.controlMode === 'hero' || unit.followingHero || unit.trainingTargetType)
    return
  const schedule = hasDailyRestSchedule(unit)
    ? getVillagerSchedule(unit)
    : { bedMinute: 1080, wakeMinute: 360, nightWatch: undefined }
  const windows =
    schedule.nightWatch === 'early'
      ? [[120, 360]]
      : schedule.nightWatch === 'late'
        ? [
            [0, 120],
            [1320, 1440],
          ]
        : [[schedule.bedMinute, 1440 + schedule.wakeMinute]]
  let sleepMinutes = 0
  for (let day = Math.floor(fromMinute / 1440) - 1; day <= Math.floor(toMinute / 1440); day++) {
    for (const [start, end] of windows)
      sleepMinutes += Math.max(0, Math.min(toMinute, day * 1440 + end) - Math.max(fromMinute, day * 1440 + start))
  }
  restoreUnitSleepHealth(unit, (sleepMinutes * HOUR_MS) / 60)
}
