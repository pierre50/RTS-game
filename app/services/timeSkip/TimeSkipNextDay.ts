import { DAY_NIGHT_CONFIG } from '../../config/gameplay'
import { isGameplaySoundSuppressed, setGameplaySoundSuppressed } from '../../lib/audio/sound'
import { flushVillageSimulation } from '../../lib/units/village/villageActivity'
import type { GameContextLike } from '../../types/context'
import type { TimeSkipStartResult, TimeSkipSystem } from '../TimeSkipSystem'
import type { SleepSimulation } from '../world/SleepSimulation'
import { captureTimeSkipReport, formatTimeSkipReport } from './TimeSkipReport'

export function advanceNextDay(
  context: GameContextLike,
  sleep: SleepSimulation | undefined,
  state: Pick<TimeSkipSystem, 'active' | 'simulatingSleep' | 'suppressAudio' | 'suppressCosmetics'>,
  reset: () => void
): TimeSkipStartResult {
  if (state.active) return { ok: false, message: 'Already waiting' }
  if (context.paused) return { ok: false, message: 'Resume the game before using nextday' }
  if (!sleep || !context.scheduler.advanceSleepTime || !context.dayNight?.setElapsedMs)
    return { ok: false, message: 'Day simulation unavailable' }
  const suspended = context.scheduler.suspended ?? false
  const soundSuppressed = isGameplaySoundSuppressed()
  const target = context.dayNight.getElapsedMs() + DAY_NIGHT_CONFIG.dayLengthMs
  let before: ReturnType<typeof captureTimeSkipReport> | undefined
  let completed = false
  let failure = ''
  state.active = true
  state.simulatingSleep = true
  state.suppressAudio = true
  state.suppressCosmetics = true
  context.scheduler.suspended = true
  setGameplaySoundSuppressed(true)
  try {
    flushVillageSimulation(context)
    before = captureTimeSkipReport(context)
    sleep.begin()
    while (context.dayNight.getElapsedMs() < target && !sleep.interrupted) sleep.step(target)
    completed = context.dayNight.getElapsedMs() >= target
  } catch (error) {
    console.error('Day simulation failed', error)
    failure = 'Day simulation failed; see console.'
  } finally {
    try {
      sleep.end()
    } catch (error) {
      console.error('Unable to reconcile the world after day simulation', error)
      failure = 'Unable to reconcile day simulation; see console.'
    }
    context.scheduler.suspended = suspended
    setGameplaySoundSuppressed(soundSuppressed)
    reset()
    context.menu?.updateTopbar?.()
  }
  if (!before) return { ok: false, message: failure || 'Unable to prepare day simulation' }
  try {
    const after = captureTimeSkipReport(context)
    completed &&= !failure
    const message = formatTimeSkipReport(
      before,
      after,
      completed,
      DAY_NIGHT_CONFIG.dayLengthMs / DAY_NIGHT_CONFIG.hoursPerDay
    )
    context.performance?.markEvent?.('nextday.report', {
      completed,
      from: before.elapsed,
      to: after.elapsed,
      days: after.day - before.day,
    })
    return { ok: completed, message: failure ? `${message}\n${failure}` : message }
  } catch (error) {
    console.error('Unable to report day simulation', error)
    return { ok: false, message: 'Day simulation ended, but its report failed; see console.' }
  }
}
