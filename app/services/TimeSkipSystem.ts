import { DAY_NIGHT_CONFIG } from '../config/gameplay'
import { isGameplaySoundSuppressed, setGameplaySoundSuppressed } from '../lib/audio/sound'
import type { GameContextLike } from '../types/context'

const FAST_FORWARD_SPEED = 72
const FAST_FORWARD_DAY_NIGHT_MAX_DELTA_MS = 1000

type TimeSkipOverlay = {
  fill: HTMLElement
  label: HTMLElement
  root: HTMLElement
}

type TimeSkipSnapshot = {
  previousSchedulerScale: number | null
  previousSoundSuppressed: boolean
  previousTickerSpeed: number
}

type TimeSkipEndReason = 'completed' | 'cancelled'

export type TimeSkipStartOptions = {
  completedMessage?: string
  onComplete?: () => void
}

export type TimeSkipStartResult = {
  ok: boolean
  message: string
}

export function getHoursUntilNextMorning(hour: number, minute = 0, targetHour = 7): number {
  const currentHour = hour + minute / 60
  const normalizedTargetHour = ((targetHour % DAY_NIGHT_CONFIG.hoursPerDay) + DAY_NIGHT_CONFIG.hoursPerDay) %
    DAY_NIGHT_CONFIG.hoursPerDay
  const hoursUntilTarget =
    currentHour < normalizedTargetHour
      ? normalizedTargetHour - currentHour
      : DAY_NIGHT_CONFIG.hoursPerDay - currentHour + normalizedTargetHour
  return hoursUntilTarget || DAY_NIGHT_CONFIG.hoursPerDay
}

export class TimeSkipSystem {
  active: boolean
  context: GameContextLike
  completedMessage: string | null
  dayNightMaxDeltaMs: number | undefined
  hours: number
  onComplete: (() => void) | null
  overlay: TimeSkipOverlay | null
  snapshot: TimeSkipSnapshot | null
  startElapsedMs: number
  suppressAudio: boolean
  suppressCosmetics: boolean
  targetElapsedMs: number
  _onKeyDown: (evt: KeyboardEvent) => void
  _onTick: (ticker?: { deltaMS?: number; elapsedMS?: number }) => void

  constructor(context: GameContextLike) {
    this.context = context
    this.active = false
    this.completedMessage = null
    this.dayNightMaxDeltaMs = undefined
    this.hours = 0
    this.onComplete = null
    this.overlay = null
    this.snapshot = null
    this.startElapsedMs = 0
    this.suppressAudio = false
    this.suppressCosmetics = false
    this.targetElapsedMs = 0
    this._onKeyDown = evt => this.onKeyDown(evt)
    this._onTick = () => this.onTick()
  }

  start(hours: number, options: TimeSkipStartOptions = {}): TimeSkipStartResult {
    if (!this.context.dayNight?.getElapsedMs) return { ok: false, message: 'Day/night system unavailable' }
    if (!this.context.app?.ticker) return { ok: false, message: 'Ticker unavailable' }
    if (this.context.paused) return { ok: false, message: 'Resume the game before using next <1-12>' }

    this.cancel({ silent: true })

    this.active = true
    this.completedMessage = options.completedMessage ?? null
    this.hours = hours
    this.onComplete = options.onComplete ?? null
    this.startElapsedMs = this.context.dayNight.getElapsedMs()
    this.targetElapsedMs = this.startElapsedMs + (hours / DAY_NIGHT_CONFIG.hoursPerDay) * DAY_NIGHT_CONFIG.dayLengthMs
    this.snapshot = {
      previousSchedulerScale: this.context.scheduler?.timeScale ?? null,
      previousSoundSuppressed: isGameplaySoundSuppressed(),
      previousTickerSpeed: this.context.app.ticker.speed ?? 1,
    }
    this.dayNightMaxDeltaMs = FAST_FORWARD_DAY_NIGHT_MAX_DELTA_MS
    this.suppressAudio = true
    this.suppressCosmetics = true
    this.overlay = this.createOverlay(hours)
    this.context.controls?.stopKeyboardMove?.()
    this.context.app.ticker.speed = FAST_FORWARD_SPEED
    if (this.context.scheduler) this.context.scheduler.timeScale = FAST_FORWARD_SPEED
    setGameplaySoundSuppressed(true)
    if (typeof document !== 'undefined') document.addEventListener?.('keydown', this._onKeyDown, true)
    this.context.app.ticker.add(this._onTick)

    return { ok: true, message: `Fast-forwarding ${hours}h at ${FAST_FORWARD_SPEED}x...` }
  }

  cancel(options: { silent?: boolean } = {}): void {
    if (!this.active) return
    this.stop('cancelled', options)
  }

  destroy(): void {
    this.cancel({ silent: true })
  }

  getProgress(): number {
    const duration = this.targetElapsedMs - this.startElapsedMs
    if (duration <= 0) return this.active ? 1 : 0
    const elapsed = this.context.dayNight?.getElapsedMs?.() ?? this.startElapsedMs
    return Math.max(0, Math.min(1, (elapsed - this.startElapsedMs) / duration))
  }

  getRemainingHours(): number {
    const elapsed = this.context.dayNight?.getElapsedMs?.() ?? this.startElapsedMs
    const remainingMs = Math.max(0, this.targetElapsedMs - elapsed)
    const hourLengthMs = DAY_NIGHT_CONFIG.dayLengthMs / DAY_NIGHT_CONFIG.hoursPerDay
    if (hourLengthMs <= 0) return 0
    return Math.ceil(remainingMs / hourLengthMs)
  }

  onTick(): void {
    if (!this.active) return
    this.updateOverlay()
    const elapsed = this.context.dayNight?.getElapsedMs?.() ?? this.startElapsedMs
    if (elapsed < this.targetElapsedMs && !this.context.defeat && !this.context.paused) return
    this.stop(elapsed >= this.targetElapsedMs ? 'completed' : 'cancelled')
  }

  onKeyDown(evt: KeyboardEvent): void {
    if (!this.active || evt.key !== 'Escape') return
    evt.preventDefault()
    evt.stopImmediatePropagation()
    this.cancel()
  }

  private stop(reason: TimeSkipEndReason, options: { silent?: boolean } = {}): void {
    const snapshot = this.snapshot
    this.updateOverlay()
    this.context.app?.ticker.remove(this._onTick)
    if (typeof document !== 'undefined') document.removeEventListener?.('keydown', this._onKeyDown, true)
    if (snapshot && this.context.app?.ticker) this.context.app.ticker.speed = snapshot.previousTickerSpeed
    if (snapshot && this.context.scheduler && snapshot.previousSchedulerScale != null) {
      this.context.scheduler.timeScale = snapshot.previousSchedulerScale
    }
    if (snapshot) setGameplaySoundSuppressed(snapshot.previousSoundSuppressed)
    this.context.controls?.stopKeyboardMove?.()
    this.overlay?.root.remove()
    const onComplete = reason === 'completed' ? this.onComplete : null
    const completedMessage = this.completedMessage
    this.resetState()
    this.context.menu?.updateTopbar?.()
    if (options.silent) return
    if (reason === 'completed') {
      onComplete?.()
      const label = `${this.context.dayNight?.getDayLabel?.() ?? 'Day'} ${this.context.dayNight?.getTimeLabel?.() ?? ''}`.trim()
      this.context.menu?.showMessage?.(completedMessage ?? `Time advanced to ${label}`, 'success')
    } else {
      this.context.menu?.showMessage?.('Time skip cancelled', 'warning')
    }
  }

  private resetState(): void {
    this.active = false
    this.completedMessage = null
    this.dayNightMaxDeltaMs = undefined
    this.hours = 0
    this.onComplete = null
    this.overlay = null
    this.snapshot = null
    this.startElapsedMs = 0
    this.suppressAudio = false
    this.suppressCosmetics = false
    this.targetElapsedMs = 0
  }

  private createOverlay(hours: number): TimeSkipOverlay | null {
    if (typeof document === 'undefined') return null
    const overlay = document.createElement('div')
    overlay.className = 'time-skip-overlay'
    overlay.style.position = 'fixed'
    overlay.style.inset = '0'
    overlay.style.zIndex = '9999'
    overlay.style.display = 'flex'
    overlay.style.alignItems = 'center'
    overlay.style.justifyContent = 'center'
    overlay.style.background = 'rgba(8, 10, 18, 0.78)'
    overlay.style.color = '#f1f5ff'
    overlay.style.font = '600 18px system-ui, sans-serif'
    overlay.style.letterSpacing = '0'
    overlay.style.pointerEvents = 'none'

    const panel = document.createElement('div')
    panel.style.width = 'min(520px, calc(100vw - 48px))'

    const label = document.createElement('div')
    label.style.marginBottom = '14px'
    label.style.textAlign = 'center'

    const track = document.createElement('div')
    track.style.height = '10px'
    track.style.overflow = 'hidden'
    track.style.background = 'rgba(255, 255, 255, 0.18)'
    track.style.border = '1px solid rgba(255, 255, 255, 0.28)'

    const fill = document.createElement('div')
    fill.style.width = '0%'
    fill.style.height = '100%'
    fill.style.background = '#f1f5ff'

    track.appendChild(fill)
    panel.appendChild(label)
    panel.appendChild(track)
    overlay.appendChild(panel)
    this.context.gamebox.appendChild(overlay)

    const result = { fill, label, root: overlay }
    this.updateOverlayElement(result, 0, hours)
    return result
  }

  private updateOverlay(): void {
    this.updateOverlayElement(this.overlay, this.getProgress(), this.getRemainingHours())
  }

  private updateOverlayElement(overlay: TimeSkipOverlay | null, progress: number, remainingHours: number): void {
    if (!overlay) return
    const percent = `${Math.round(Math.max(0, Math.min(100, progress * 100)))}%`
    const unit = remainingHours === 1 ? 'hour' : 'hours'
    overlay.label.textContent = `Waiting... ${remainingHours} ${unit} remaining`
    overlay.fill.style.width = percent
  }
}
