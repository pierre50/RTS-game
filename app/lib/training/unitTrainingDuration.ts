import { DAY_NIGHT_CONFIG } from '../../config/gameplay'
import { t } from '../lang'

type UnitTrainingDurationConfig = {
  trainingDays?: number
  trainingTime?: number
}

export function getUnitTrainingDurationDays(config: UnitTrainingDurationConfig | null | undefined): number {
  return config?.trainingDays ?? config?.trainingTime ?? 1
}

export function formatUnitTrainingDuration(trainingDays: number | null | undefined): string {
  const hours = Math.max(0, Math.ceil((trainingDays ?? 1) * DAY_NIGHT_CONFIG.hoursPerDay))
  if (hours <= DAY_NIGHT_CONFIG.hoursPerDay) {
    return t(hours === 1 ? 'trainingHour' : 'trainingHours', { hours })
  }
  const days = Math.ceil(hours / DAY_NIGHT_CONFIG.hoursPerDay)
  return t(days === 1 ? 'trainingDay' : 'trainingDays', { days })
}
