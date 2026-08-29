import type { CommandResult } from '../DevCommandRegistry'
import type { DevConsoleContext } from '../types'

const MIN_NEXT_HOURS = 1
const MAX_NEXT_HOURS = 12

function parseNextHours(value?: string): number | null {
  const hours = Number(value)
  if (!Number.isInteger(hours) || hours < MIN_NEXT_HOURS || hours > MAX_NEXT_HOURS) return null
  return hours
}

export function advanceTime(context: DevConsoleContext, value?: string): CommandResult {
  const hours = parseNextHours(value)
  if (hours == null) return { ok: false, message: 'Usage: next <1-12>' }
  if (!context.timeSkip?.start) return { ok: false, message: 'Time skip system unavailable' }
  return context.timeSkip.start(hours)
}
