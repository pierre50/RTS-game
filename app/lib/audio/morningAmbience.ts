import { clamp, smoothstep } from '../interpolation'
const MORNING_AMBIENCE_MAX_VOLUME = 0.24
export const MORNING_AMBIENCE_LERP_PER_SECOND = 1.6

export function getMorningAmbienceTargetVolume(hour: number | null | undefined, minute = 0): number {
  if (!Number.isFinite(hour)) return 0
  const time = Number(hour) + (Number.isFinite(minute) ? Number(minute) : 0) / 60
  const fadeIn = smoothstep(5.5, 6, time)
  const fadeOut = 1 - smoothstep(7.5, 8.25, time)
  return clamp(fadeIn * fadeOut, 0, 1) * MORNING_AMBIENCE_MAX_VOLUME
}

export function duckNightAmbienceForMorning(morningVolume: number, nightVolume: number): number {
  const morningShare = clamp(morningVolume / MORNING_AMBIENCE_MAX_VOLUME, 0, 1)
  return nightVolume * (1 - morningShare)
}
