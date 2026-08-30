import type { GameContextLike } from '../../types/context'

const VILLAGER_SLEEP_START_HOUR = 18
const VILLAGER_WAKE_HOUR = 8
export function isVillagerSleepTime(context: Pick<GameContextLike, 'dayNight'> | null | undefined): boolean {
  const hour = context?.dayNight?.state?.hour ?? 12
  return hour >= VILLAGER_SLEEP_START_HOUR || hour < VILLAGER_WAKE_HOUR
}
