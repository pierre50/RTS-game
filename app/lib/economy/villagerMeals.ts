import { DAILY_CONSUMPTION_PER_VILLAGER } from '../../constants/consumption'
import { getVillagerSchedule, type VillagerSchedule } from '../units/village/villagerSchedule'
import { consumeVillageFood } from './villageFood'
import type { CollectiveMember } from './collectiveTasks'

type MealMember = CollectiveMember & { dailySchedule?: VillagerSchedule; lastMealAt?: number }

/** Whole portions: breakfast 1, lunch 2, supper 1 with the current daily ration of 4. */
function villagerMealWindows(unit: MealMember) {
  const schedule = getVillagerSchedule(unit)
  const ration = DAILY_CONSUMPTION_PER_VILLAGER.food ?? 0
  const small = Math.floor(ration / 3)
  return [
    { start: schedule.wakeMinute, end: schedule.workStartMinute, amount: small },
    { start: schedule.lunchStartMinute, end: schedule.lunchEndMinute, amount: ration - 2 * small },
    { start: schedule.workEndMinute, end: schedule.bedMinute, amount: small },
  ]
}

/** Absolute calendar minutes make ticks, saved games and offline replay idempotent. */
export function consumeVillagerMeals(
  unit: MealMember,
  from: number,
  to: number,
  includeCurrentPause = false,
  beforeMeal?: () => void
) {
  const result = { needed: 0, consumed: 0 }
  if (
    unit.type !== 'Villager' ||
    unit.isDead ||
    unit.isDestroyed ||
    !Number.isFinite(from) ||
    !Number.isFinite(to) ||
    to < from
  )
    return result
  const meals = villagerMealWindows(unit)
  for (let day = Math.floor(from / 1440); day <= Math.floor(to / 1440); day++) {
    for (const meal of meals) {
      const at = day * 1440 + meal.start
      const current = includeCurrentPause && at <= from && from < day * 1440 + meal.end
      if ((at <= from && !current) || at > to || at <= (unit.lastMealAt ?? -Infinity)) continue
      // A missed meal is not charged again later, even if provisions arrive afterwards.
      beforeMeal?.()
      // Catch-up may have already consumed this meal and subsequent ones.
      if (at <= (unit.lastMealAt ?? -Infinity)) continue
      unit.lastMealAt = at
      const consumed = consumeVillageFood({ units: [unit] }, meal.amount)
      result.needed += consumed.needed
      result.consumed += consumed.consumed
    }
  }
  return result
}
