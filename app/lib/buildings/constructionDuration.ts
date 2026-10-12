import units from '../../../public/assets/data/gameplay/units.json'
import { DAY_NIGHT_CONFIG } from '../../config/gameplay'
import { getWorkCycleMs } from '../economy/workTiming'
import { getWorkToolTier } from '../equipment/workTools'
import { getBuildRateXpMultiplier } from '../units/unitExperience'
import type { UnitConfig } from '../../types/config'

export type ConstructionDurationEstimate = {
  workers: number
  toolMaterial: 'stone' | 'bronze'
  workHoursPerDay: number
  activeGameHours: number
  workingDays: number
  unit: 'minutes' | 'hours' | 'days'
  value: number
}

/** Reference used by the construction catalogue and economy report, after full delivery.
 * Two novice workers, normal difficulty, 7–18h minus a one-hour meal, tools ready.
 * This is a workload estimate, not a completion deadline or a remaining-time counter.
 */
export function estimateConstructionDuration(
  work: number | null | undefined,
  level = 0
): ConstructionDurationEstimate | null {
  if (work == null || !Number.isFinite(work) || work <= 0) return null
  const workers = 2
  const workHoursPerDay = 10
  const toolMaterial = level > 0 ? 'bronze' : 'stone'
  const worker = {
    experience: undefined,
    inventory: { activeWeapons: { tool: toolMaterial === 'bronze' ? 'hammer_bronze' : 'hammer_ceramic' } },
  }
  const multiplier = getBuildRateXpMultiplier(worker) * (1 + getWorkToolTier(worker) * 0.25)
  const milliseconds = (work * getWorkCycleMs(units.Villager as UnitConfig, 'builder')) / (workers * multiplier)
  const activeGameHours = milliseconds / (DAY_NIGHT_CONFIG.dayLengthMs / DAY_NIGHT_CONFIG.hoursPerDay)
  const workingDays = activeGameHours / workHoursPerDay
  const unit = workingDays >= 1 - 1e-8 ? 'days' : 'hours'
  const value = Math.max(1, Math.ceil((unit === 'days' ? workingDays : activeGameHours) - 1e-8))
  return { workers, toolMaterial, workHoursPerDay, activeGameHours, workingDays, unit, value }
}
