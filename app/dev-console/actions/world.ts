import type { CommandResult } from '../DevCommandRegistry'
import type { DevConsoleContext, DevWeatherPhase } from '../types'

export const WEATHER_PHASES: DevWeatherPhase[] = [
  'sunny',
  'clouding',
  'stormBuildUp',
  'rainLight',
  'rainHeavy',
  'snow',
  'sandstorm',
  'clearing',
  'night',
]

function formatDebugState(state: object | undefined): string {
  return JSON.stringify(state ?? {}, null, 2)
}

function parseTimeInput(value: string): { hour: number; minute: number } | null {
  const match = value.trim().match(/^(\d{1,2})(?::|h)?(\d{2})?$/i)
  if (!match) return null
  const hour = Number(match[1])
  const minute = match[2] == null ? 0 : Number(match[2])
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null
  }
  return { hour, minute }
}

export function forceNextDay(context: DevConsoleContext): CommandResult {
  if (!context.dayNight?.forceNextDay) return { ok: false, message: 'Day/night system unavailable' }
  context.dayNight.forceNextDay()
  return {
    ok: true,
    message:
      `Advanced to ${context.dayNight.getDayLabel?.() ?? 'next day'} ${context.dayNight.getTimeLabel?.() ?? ''}`.trim(),
  }
}

export function showTimeState(context: DevConsoleContext): CommandResult {
  if (!context.dayNight) return { ok: false, message: 'Day/night system unavailable' }
  return {
    ok: true,
    message: context.dayNight.debugState
      ? formatDebugState(context.dayNight.debugState())
      : `${context.dayNight.getDayLabel?.() ?? 'Day'} ${context.dayNight.getTimeLabel?.() ?? ''}`.trim(),
  }
}

export function setTime(context: DevConsoleContext, value?: string): CommandResult {
  if (!value) return showTimeState(context)
  if (!context.dayNight?.setTime) return { ok: false, message: 'Day/night system unavailable' }

  const parsed = parseTimeInput(value)
  if (!parsed) return { ok: false, message: 'Usage: time [HH[:MM]]' }

  context.dayNight.setTime(parsed.hour, parsed.minute)
  return {
    ok: true,
    message:
      `Time set to ${context.dayNight.getDayLabel?.() ?? 'Day'} ${context.dayNight.getTimeLabel?.() ?? value}`.trim(),
  }
}

export function setWeatherPhase(context: DevConsoleContext, phase?: string): CommandResult {
  if (!context.weather?.forcePhase) return { ok: false, message: 'Weather system unavailable' }
  if (!phase) {
    return {
      ok: true,
      message: context.weather.debugState
        ? formatDebugState(context.weather.debugState())
        : `Weather: ${context.weather.phase ?? 'unknown'}`,
    }
  }
  if (!WEATHER_PHASES.includes(phase as DevWeatherPhase)) {
    return { ok: false, message: `Usage: weather <${WEATHER_PHASES.join('|')}>` }
  }
  context.weather.forcePhase(phase as DevWeatherPhase)
  return {
    ok: true,
    message: context.weather.debugState ? formatDebugState(context.weather.debugState()) : `Weather forced to ${phase}`,
  }
}
