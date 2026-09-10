import { DAY_NIGHT_CONFIG } from '../../config/gameplay'
import { UNIT_TYPES } from '../../constants/entities'
import type { UnitEntity } from '../../types/entities'
import type { SaveEntityState } from '../../types/save'
import { getVillagerSchedule } from './villagerSchedule'

const HOUR_MS = DAY_NIGHT_CONFIG.dayLengthMs / DAY_NIGHT_CONFIG.hoursPerDay
const FULL_HEALTH_SLEEP_MS = 8 * HOUR_MS

type SleepHealthUnit = Pick<
  SaveEntityState,
  'type' | 'controlMode' | 'hitPoints' | 'totalHitPoints' | 'isDead' | 'isDestroyed'
>

/** Eight game hours of sleep restore one full health bar. Never revive a dead unit. */
export function restoreUnitSleepHealth(unit: SleepHealthUnit, elapsedMs: number): void {
  if (unit.type === UNIT_TYPES.hero || unit.controlMode === 'hero' || unit.isDead || unit.isDestroyed) return
  const total = unit.totalHitPoints ?? 0
  const current = unit.hitPoints ?? total
  if (total <= 0 || current <= 0 || current >= total || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return
  unit.hitPoints = Math.min(total, current + (total * elapsedMs) / FULL_HEALTH_SLEEP_MS)
}

export function updateUnitSleepHealth(unit: UnitEntity, elapsedMs: number): void {
  const rest = unit.shelterState
  if (
    unit.context?.controls?.heroUnit === unit ||
    rest?.reason !== 'sleep' ||
    (rest.status !== 'inside' && rest.status !== 'outside') ||
    unit.sleepVisualState !== 'sleeping'
  )
    return
  restoreUnitSleepHealth(unit, elapsedMs)
}

/** Integrate scheduled sleep across midnight, including partial nights on an unloaded map. */
export function restoreOfflineUnitSleepHealth(unit: SaveEntityState, fromMinute: number, toMinute: number): void {
  if (unit.followingHero || unit.trainingTargetType) return
  const { bedMinute, wakeMinute } =
    unit.type === UNIT_TYPES.villager ? getVillagerSchedule(unit) : { bedMinute: 18 * 60, wakeMinute: 6 * 60 }
  const dayMinutes = DAY_NIGHT_CONFIG.hoursPerDay * 60
  let sleepMinutes = 0
  for (let day = Math.floor(fromMinute / dayMinutes) - 1; day <= Math.floor(toMinute / dayMinutes); day++) {
    sleepMinutes += Math.max(
      0,
      Math.min(toMinute, (day + 1) * dayMinutes + wakeMinute) - Math.max(fromMinute, day * dayMinutes + bedMinute)
    )
  }
  restoreUnitSleepHealth(unit, (sleepMinutes * HOUR_MS) / 60)
}
