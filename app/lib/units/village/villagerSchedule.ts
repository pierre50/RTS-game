import { isChiefUnit } from '../../chief'
import type { GameContextLike } from '../../../types/context'
import type { UnitEntity } from '../../../types/entities'

const VILLAGER_SLEEP_START_HOUR = 18
const VILLAGER_WAKE_HOUR = 6
const VILLAGER_MORNING_LINGER_MINUTES = 60
const VILLAGER_BED_HOUR = 22
const VILLAGER_SCHEDULE_VARIANCE_MINUTES = 20
// The village is awake once the last individual wake time has passed.
export const VILLAGE_WAKE_COMPLETE_HOUR = VILLAGER_WAKE_HOUR + VILLAGER_SCHEDULE_VARIANCE_MINUTES / 60
const VILLAGER_WAKE_WINDOW_START_MINUTE = VILLAGER_WAKE_HOUR * 60 - VILLAGER_SCHEDULE_VARIANCE_MINUTES

export type VillagerSchedule = {
  nightWatch?: 'early' | 'late'
  lunchStartMinute?: number
  lunchEndMinute?: number
  bedMinute: number
  workStartMinute: number
  wakeMinute: number
  workEndMinute: number
}

type ScheduledVillager = Pick<UnitEntity, 'type' | 'i' | 'j'> & { label?: string; dailySchedule?: VillagerSchedule }

function stableScheduleOffset(unit: ScheduledVillager, salt: string): number {
  const value = `${unit.label ?? `${unit.type}:${unit.i}:${unit.j}`}:${salt}`
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  const spread = VILLAGER_SCHEDULE_VARIANCE_MINUTES * 2 + 1
  return ((hash >>> 0) % spread) - VILLAGER_SCHEDULE_VARIANCE_MINUTES
}

function minuteOfDay(context: Pick<GameContextLike, 'dayNight'> | null | undefined): number {
  const hour = context?.dayNight?.state?.hour ?? 12
  const minute = context?.dayNight?.state?.minute ?? 0
  return hour * 60 + minute
}

export function getVillagerSchedule(
  unit: ScheduledVillager
): Required<Omit<VillagerSchedule, 'nightWatch'>> & Pick<VillagerSchedule, 'nightWatch'> {
  if (unit.dailySchedule?.lunchStartMinute != null && unit.dailySchedule.lunchEndMinute != null)
    return unit.dailySchedule as Required<Omit<VillagerSchedule, 'nightWatch'>> & Pick<VillagerSchedule, 'nightWatch'>
  const wakeMinute = VILLAGER_WAKE_HOUR * 60 + stableScheduleOffset(unit, 'wake')
  unit.dailySchedule ??= {
    bedMinute: VILLAGER_BED_HOUR * 60 + stableScheduleOffset(unit, 'bed'),
    wakeMinute,
    workStartMinute: wakeMinute + VILLAGER_MORNING_LINGER_MINUTES,
    workEndMinute: VILLAGER_SLEEP_START_HOUR * 60 + stableScheduleOffset(unit, 'workEnd'),
  }
  // Persist the individual meal window, including when upgrading an older save.
  const lunchStartMinute = unit.dailySchedule.lunchStartMinute ?? 12 * 60 + stableScheduleOffset(unit, 'lunchStart')
  const lunchEndMinute =
    unit.dailySchedule.lunchEndMinute ?? lunchStartMinute + 60 + stableScheduleOffset(unit, 'lunchDuration')
  return Object.assign(unit.dailySchedule, { lunchStartMinute, lunchEndMinute })
}

export type DailyRoutinePhase = 'sleep' | 'morning' | 'work' | 'meal' | 'evening'

/** Shared by live eligibility, activation and calendar deadlines; never replays transitions. */
export function getDailyRoutine(
  unit: ScheduledVillager,
  calendarMinute: number
): {
  phase: DailyRoutinePhase
  nextTransitionMinute: number
} {
  const schedule = getVillagerSchedule(unit)
  const now = ((calendarMinute % 1440) + 1440) % 1440
  const midnight = calendarMinute - now
  const phase = getDailyRoutinePhase(unit, now)
  const boundaries = [
    schedule.wakeMinute,
    schedule.workStartMinute,
    schedule.lunchStartMinute,
    schedule.lunchEndMinute,
    schedule.workEndMinute,
    schedule.bedMinute,
    ...(schedule.nightWatch ? [120, 360, 1320] : []),
  ]
  const next = Math.min(...boundaries.filter(minute => minute > now))
  return { phase, nextTransitionMinute: midnight + (Number.isFinite(next) ? next : 1440 + Math.min(...boundaries)) }
}

export function getDailyRoutinePhase(
  unit: ScheduledVillager & Pick<Partial<UnitEntity>, 'context'>,
  calendarMinute = minuteOfDay(unit.context)
): DailyRoutinePhase {
  const schedule = getVillagerSchedule(unit)
  const now = ((calendarMinute % 1440) + 1440) % 1440
  if (schedule.nightWatch && (now >= 1320 || now < 360)) {
    const duty = schedule.nightWatch === 'early' ? now >= 1320 || now < 120 : now >= 120 && now < 360
    return duty ? 'work' : 'sleep'
  }
  return !schedule.nightWatch && (now >= schedule.bedMinute || now < schedule.wakeMinute)
    ? 'sleep'
    : now < schedule.workStartMinute
      ? 'morning'
      : now >= schedule.workEndMinute
        ? 'evening'
        : now >= schedule.lunchStartMinute && now < schedule.lunchEndMinute
          ? 'meal'
          : 'work'
}

export function shouldVillagerReturnHome(unit: UnitEntity): boolean {
  const now = minuteOfDay(unit.context)
  const { workEndMinute } = getVillagerSchedule(unit)
  // Once the morning wake window starts, an already-awake villager must never begin a new
  // sleep trip just because its individual wake minute is still a few minutes away.
  if (unit.dailySchedule?.nightWatch && shouldVillagerWork(unit)) return false
  return now >= workEndMinute || now < VILLAGER_WAKE_WINDOW_START_MINUTE
}

export function shouldVillagerBeAsleep(unit: UnitEntity): boolean {
  return getDailyRoutinePhase(unit, minuteOfDay(unit.context)) === 'sleep'
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
  const { workStartMinute, lunchStartMinute, lunchEndMinute } = getVillagerSchedule(unit)
  return Math.max(0, (now >= lunchStartMinute && now < lunchEndMinute ? lunchEndMinute : workStartMinute) - now)
}

export function shouldVillagerBeAwake(unit: UnitEntity): boolean {
  return !shouldVillagerBeAsleep(unit)
}

export function shouldVillagerWork(unit: UnitEntity): boolean {
  return getDailyRoutinePhase(unit, minuteOfDay(unit.context)) === 'work'
}

export function isVillagerSleepTime(context: Pick<GameContextLike, 'dayNight'> | null | undefined): boolean {
  const hour = context?.dayNight?.state?.hour ?? 12
  return hour >= VILLAGER_SLEEP_START_HOUR || hour < VILLAGER_WAKE_HOUR
}

export function isVillagerLunchTime(unit: UnitEntity): boolean {
  return getDailyRoutinePhase(unit, minuteOfDay(unit.context)) === 'meal'
}

/** The same work windows drive live task eligibility and elapsed-time simulation. */
function getVillagerWorkWindows(unit: ScheduledVillager): [number, number][] {
  const { workStartMinute, workEndMinute, lunchStartMinute, lunchEndMinute } = getVillagerSchedule(unit)
  return [
    [workStartMinute, Math.min(workEndMinute, lunchStartMinute)],
    [Math.max(workStartMinute, lunchEndMinute), workEndMinute],
  ]
}

export function getVillagerWorkingMinutes(unit: ScheduledVillager, from: number, to: number): number {
  const windows = getVillagerWorkWindows(unit)
  let minutes = 0
  for (let day = Math.floor(from / 1440); day <= Math.floor(to / 1440); day++) {
    for (const [start, end] of windows)
      minutes += Math.max(0, Math.min(to, day * 1440 + end) - Math.max(from, day * 1440 + start))
  }
  return minutes
}

export function isSoldierUnit(unit: Pick<UnitEntity, 'type'>): boolean {
  return unit.type === 'Fantassin' || unit.type === 'Bowman'
}

/** Residents, leaders and soldiers share morning, meal, evening and sleep windows. */
export function hasDailyRestSchedule(unit: Pick<UnitEntity, 'type' | 'isChief'>): boolean {
  return unit.type === 'Villager' || isChiefUnit(unit) || isSoldierUnit(unit)
}
