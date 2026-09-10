import type { GameContextLike } from '../../types/context'
import type { UnitEntity } from '../../types/entities'

const VILLAGER_SLEEP_START_HOUR = 18
const VILLAGER_WAKE_HOUR = 6
const VILLAGER_MORNING_LINGER_MINUTES = 60
const VILLAGER_BED_HOUR = 22
const VILLAGER_SCHEDULE_VARIANCE_MINUTES = 20
const VILLAGER_WAKE_WINDOW_START_MINUTE = VILLAGER_WAKE_HOUR * 60 - VILLAGER_SCHEDULE_VARIANCE_MINUTES

type VillagerSchedule = {
  bedMinute: number
  workStartMinute: number
  wakeMinute: number
  workEndMinute: number
}

type ScheduledVillager = Pick<UnitEntity, 'type' | 'i' | 'j'> & { label?: string }

function stableScheduleOffset(unit: ScheduledVillager, salt: string): number {
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

export function getVillagerSchedule(unit: ScheduledVillager): VillagerSchedule {
  const wakeMinute = VILLAGER_WAKE_HOUR * 60 + stableScheduleOffset(unit, 'wake')
  return {
    bedMinute: VILLAGER_BED_HOUR * 60 + stableScheduleOffset(unit, 'bed'),
    wakeMinute,
    workStartMinute: wakeMinute + VILLAGER_MORNING_LINGER_MINUTES,
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

export function getMinutesUntilVillagerBed(unit: UnitEntity): number {
  const now = minuteOfDay(unit.context)
  const { bedMinute } = getVillagerSchedule(unit)
  return Math.max(0, bedMinute - now)
}

export function getMinutesUntilVillagerWorkEnds(unit: UnitEntity): number {
  const now = minuteOfDay(unit.context)
  const { workEndMinute } = getVillagerSchedule(unit)
  return Math.max(0, workEndMinute - now)
}

export function getMinutesUntilVillagerWorkStarts(unit: UnitEntity): number {
  const now = minuteOfDay(unit.context)
  const { workStartMinute } = getVillagerSchedule(unit)
  return Math.max(0, workStartMinute - now)
}

export function shouldVillagerBeAwake(unit: UnitEntity): boolean {
  return !shouldVillagerBeAsleep(unit)
}

export function shouldVillagerWork(unit: UnitEntity): boolean {
  const now = minuteOfDay(unit.context)
  const { workStartMinute, workEndMinute } = getVillagerSchedule(unit)
  return now >= workStartMinute && now < workEndMinute
}

export function isVillagerSleepTime(context: Pick<GameContextLike, 'dayNight'> | null | undefined): boolean {
  const hour = context?.dayNight?.state?.hour ?? 12
  return hour >= VILLAGER_SLEEP_START_HOUR || hour < VILLAGER_WAKE_HOUR
}
