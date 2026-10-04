import { DAY_NIGHT_CONFIG } from '../../config/gameplay'

export function getHoursUntilNextMorning(hour: number, minute = 0, targetHour = 6): number {
  const currentHour = hour + minute / 60
  const normalizedTargetHour =
    ((targetHour % DAY_NIGHT_CONFIG.hoursPerDay) + DAY_NIGHT_CONFIG.hoursPerDay) % DAY_NIGHT_CONFIG.hoursPerDay
  const hoursUntilTarget =
    currentHour < normalizedTargetHour
      ? normalizedTargetHour - currentHour
      : DAY_NIGHT_CONFIG.hoursPerDay - currentHour + normalizedTargetHour
  return hoursUntilTarget || DAY_NIGHT_CONFIG.hoursPerDay
}
