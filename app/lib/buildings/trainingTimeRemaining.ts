import { DAY_NIGHT_CONFIG } from '../../config/gameplay'
import { t } from '../lang'
import type { BuildingEntity } from '../../types/entities'

type TrainingTimeSource = {
  trainingCompleteDay?: number | null
  context?: BuildingEntity['context']
}

function getTrainingHoursRemaining(source: TrainingTimeSource): number | null {
  const completeDay = source.trainingCompleteDay
  const state = source.context?.dayNight?.state
  if (completeDay == null || !state) return null
  const currentHour = state.hour + (state.minute ?? 0) / 60
  const hoursRemaining =
    (completeDay - state.day) * DAY_NIGHT_CONFIG.hoursPerDay + DAY_NIGHT_CONFIG.newDayHour - currentHour
  return Math.max(0, Math.ceil(hoursRemaining))
}

function formatTrainingHoursRemaining(hours: number | null): string | null {
  if (hours == null) return null
  if (hours <= DAY_NIGHT_CONFIG.hoursPerDay) {
    return t(hours === 1 ? 'trainingHourRemaining' : 'trainingHoursRemaining', { hours })
  }
  const days = Math.ceil(hours / DAY_NIGHT_CONFIG.hoursPerDay)
  return t(days === 1 ? 'trainingDayRemaining' : 'trainingDaysRemaining', { days })
}

export function formatTrainingTimeRemaining(building: BuildingEntity): string | null {
  return formatTrainingHoursRemaining(getTrainingHoursRemaining(building))
}

export function formatTrainingEntryTimeRemaining(
  building: BuildingEntity,
  entry: { trainingCompleteDay?: number | null }
): string | null {
  return formatTrainingHoursRemaining(getTrainingHoursRemaining({ ...entry, context: building.context }))
}
