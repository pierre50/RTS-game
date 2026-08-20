import type { GameContextLike } from '../types/context'
import { t } from '../lib/lang'
import { DAY_NIGHT_COLOR_TIMELINE, DAY_NIGHT_CONFIG } from '../config/gameplay'
import type { DayNightColorAdjustment } from '../types/context'

type TickerLike = { deltaMS?: number; elapsedMS?: number; deltaTime?: number }
type DayNightPhase = 'dawn' | 'day' | 'dusk' | 'night'
type DayNightState = {
  day: number
  darkness: number
  hour: number
  minute: number
  phase: DayNightPhase
}
type DayNightSystemOptions = {
  elapsedMs?: number | null
}

const TARGET_FRAME_MS = 1000 / 60

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

function darknessForHour(hour: number): number {
  if (hour >= 22 || hour < 5) return 1
  if (hour >= 20) return 0.72 + smoothstep(20, 22, hour) * 0.28
  if (hour >= 18) return smoothstep(18, 20, hour) * 0.72
  if (hour >= 7) return 0
  return 1 - smoothstep(5, 7, hour)
}

function phaseForHour(hour: number): DayNightPhase {
  if (hour >= 5 && hour < 8) return 'dawn'
  if (hour >= 8 && hour < 18) return 'day'
  if (hour >= 18 && hour < 22) return 'dusk'
  return 'night'
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function lerp(current: number, target: number, amount: number): number {
  return current + (target - current) * amount
}

function lerpColor(from: DayNightColorAdjustment, to: DayNightColorAdjustment, amount: number): DayNightColorAdjustment {
  return {
    gamma: lerp(from.gamma, to.gamma, amount),
    contrast: lerp(from.contrast, to.contrast, amount),
    saturation: lerp(from.saturation, to.saturation, amount),
    brightness: lerp(from.brightness, to.brightness, amount),
    red: lerp(from.red, to.red, amount),
    green: lerp(from.green, to.green, amount),
    blue: lerp(from.blue, to.blue, amount),
  }
}

function colorForHour(hour: number): DayNightColorAdjustment {
  const normalizedHour = ((hour % DAY_NIGHT_CONFIG.hoursPerDay) + DAY_NIGHT_CONFIG.hoursPerDay) % DAY_NIGHT_CONFIG.hoursPerDay
  for (let index = 0; index < DAY_NIGHT_COLOR_TIMELINE.length - 1; index++) {
    const current = DAY_NIGHT_COLOR_TIMELINE[index]
    const next = DAY_NIGHT_COLOR_TIMELINE[index + 1]
    if (normalizedHour >= current.hour && normalizedHour <= next.hour) {
      return lerpColor(current.color, next.color, (normalizedHour - current.hour) / (next.hour - current.hour))
    }
  }
  return DAY_NIGHT_COLOR_TIMELINE[0].color
}

export class DayNightSystem {
  context: GameContextLike
  dayChangeListeners: Set<(day: number, previousDay: number) => void>
  elapsedMs: number
  lastTopbarMinute: number
  state: DayNightState
  _onTick: (ticker: TickerLike) => void

  constructor(context: GameContextLike, options: DayNightSystemOptions = {}) {
    this.context = context
    this.dayChangeListeners = new Set()
    this.elapsedMs = Math.max(0, Number.isFinite(options.elapsedMs) ? Number(options.elapsedMs) : 0)
    this.lastTopbarMinute = -1
    this.state = this.computeState()
    this._onTick = ticker => this.update(ticker.deltaMS ?? ticker.elapsedMS ?? TARGET_FRAME_MS)
    context.app.ticker.add(this._onTick)
  }

  update(elapsedMs: number): void {
    if (this.context.paused || this.context.defeat) return
    const previousDay = this.state.day
    this.elapsedMs += Math.min(Math.max(elapsedMs, 0), 250)
    this.state = this.computeState()
    if (this.state.day !== previousDay) {
      for (const listener of this.dayChangeListeners) listener(this.state.day, previousDay)
    }
    const totalMinute = this.state.day * 24 * 60 + this.state.hour * 60 + this.state.minute
    if (Math.floor(totalMinute / DAY_NIGHT_CONFIG.topbarUpdateMinuteStep) === this.lastTopbarMinute) return
    this.lastTopbarMinute = Math.floor(totalMinute / DAY_NIGHT_CONFIG.topbarUpdateMinuteStep)
    this.context.menu?.updateTopbar?.()
  }

  computeState(): DayNightState {
    const gameHoursElapsed = (this.elapsedMs / DAY_NIGHT_CONFIG.dayLengthMs) * DAY_NIGHT_CONFIG.hoursPerDay
    const absoluteHour = DAY_NIGHT_CONFIG.startHour + gameHoursElapsed
    const hourOfDay =
      ((absoluteHour % DAY_NIGHT_CONFIG.hoursPerDay) + DAY_NIGHT_CONFIG.hoursPerDay) %
      DAY_NIGHT_CONFIG.hoursPerDay
    const dayBoundaryIndex = Math.floor((absoluteHour - DAY_NIGHT_CONFIG.newDayHour) / DAY_NIGHT_CONFIG.hoursPerDay)
    const hour = Math.floor(hourOfDay)
    const minute = Math.floor((hourOfDay - hour) * 60)

    return {
      day: Math.max(1, dayBoundaryIndex + 1),
      darkness: darknessForHour(hourOfDay),
      hour,
      minute,
      phase: phaseForHour(hourOfDay),
    }
  }

  getDarknessLevel(): number {
    return this.state.darkness
  }

  getColorAdjustment(): DayNightColorAdjustment {
    return colorForHour(this.state.hour + this.state.minute / 60)
  }

  getElapsedMs(): number {
    return this.elapsedMs
  }

  forceNextDay(): void {
    const previousDay = this.state.day
    this.elapsedMs += DAY_NIGHT_CONFIG.dayLengthMs
    this.state = this.computeState()
    for (const listener of this.dayChangeListeners) listener(this.state.day, previousDay)
    this.context.menu?.updateTopbar?.()
  }

  getTimeLabel(): string {
    return `${pad2(this.state.hour)}:${pad2(this.state.minute)}`
  }

  getDayLabel(): string {
    return t('dayLabel', { day: this.state.day })
  }

  onDayChange(callback: (day: number, previousDay: number) => void): () => void {
    this.dayChangeListeners.add(callback)
    return () => this.dayChangeListeners.delete(callback)
  }

  debugState(): object {
    return {
      ...this.state,
      darkness: Number(this.state.darkness.toFixed(2)),
      time: this.getTimeLabel(),
    }
  }

  destroy(): void {
    this.dayChangeListeners.clear()
    this.context.app.ticker.remove(this._onTick)
  }
}
