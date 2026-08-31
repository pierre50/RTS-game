import type { GameContextLike } from '../../types/context'
import type { UnitEntity } from '../../types/entities'

const VILLAGER_SLEEP_START_HOUR = 18
const VILLAGER_WAKE_HOUR = 8
const VILLAGER_BED_HOUR = 22
const VILLAGER_SCHEDULE_VARIANCE_MINUTES = 20
const VILLAGER_WAKE_WINDOW_START_MINUTE = VILLAGER_WAKE_HOUR * 60 - VILLAGER_SCHEDULE_VARIANCE_MINUTES

type VillagerSchedule = {
  bedMinute: number
  wakeMinute: number
  workEndMinute: number
}

function stableScheduleOffset(unit: Pick<UnitEntity, 'label' | 'type' | 'i' | 'j'>, salt: string): number {
  const value = `${unit.label ?? `${unit.type}:${unit.i}:${unit.j}`}:${salt}`
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  const spread = VILLAGER_SCHEDULE_VARIANCE_MINUTES * 2 + 1
  return (hash >>> 0) % spread - VILLAGER_SCHEDULE_VARIANCE_MINUTES
}

function minuteOfDay(context: Pick<GameContextLike, 'dayNight'> | null | undefined): number {
  const hour = context?.dayNight?.state?.hour ?? 12
  const minute = context?.dayNight?.state?.minute ?? 0
  return hour * 60 + minute
}

function getVillagerSchedule(unit: UnitEntity): VillagerSchedule {
  return {
    bedMinute: VILLAGER_BED_HOUR * 60 + stableScheduleOffset(unit, 'bed'),
    wakeMinute: VILLAGER_WAKE_HOUR * 60 + stableScheduleOffset(unit, 'wake'),
    workEndMinute: VILLAGER_SLEEP_START_HOUR * 60 + stableScheduleOffset(unit, 'workEnd'),
  }
}

export function shouldVillagerReturnHome(unit: UnitEntity): boolean {
  const now = minuteOfDay(unit.context)
  const { workEndMinute } = getVillagerSchedule(unit)
  // Once the morning wake window starts, an already-awake villager must never begin a new
  // sleep trip just because its individual wake minute is still a few minutes away.
  return now >= workEndMinute || now < VILLAGER_WAKE_WINDOW_START_MINUTE
}

export function shouldVillagerBeAsleep(unit: UnitEntity): boolean {
  const now = minuteOfDay(unit.context)
  const { bedMinute, wakeMinute } = getVillagerSchedule(unit)
  return now >= bedMinute || now < wakeMinute
}

export function shouldVillagerRestBeforeBed(unit: UnitEntity): boolean {
  const now = minuteOfDay(unit.context)
  const { bedMinute, workEndMinute } = getVillagerSchedule(unit)
  return now >= workEndMinute && now < bedMinute
}

export function shouldVillagerWork(unit: UnitEntity): boolean {
  const now = minuteOfDay(unit.context)
  const { wakeMinute, workEndMinute } = getVillagerSchedule(unit)
  return now >= wakeMinute && now < workEndMinute
}

export function isVillagerSleepTime(context: Pick<GameContextLike, 'dayNight'> | null | undefined): boolean {
  const hour = context?.dayNight?.state?.hour ?? 12
  return hour >= VILLAGER_SLEEP_START_HOUR || hour < VILLAGER_WAKE_HOUR
}
