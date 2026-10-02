import type { SleepSimulation } from './world/SleepSimulation'
import { DAY_NIGHT_CONFIG } from '../config/gameplay'
import { isGameplaySoundSuppressed, setGameplaySoundSuppressed } from '../lib/audio/sound'
import { getGamepadEnabled } from '../lib/audio/settings'
import { getActiveGamepad } from '../lib/input/gamepad'
import { consumeGamepadButtons, getConsumedGamepadButtons } from '../lib/input/gamepadConsumption'
import { createGamepadKey } from '../lib/input/gamepadGlyph'
import { t } from '../lib/lang'
import type { GameContextLike } from '../types/context'

const FAST_FORWARD_SPEED = 72
const FAST_FORWARD_DAY_NIGHT_MAX_DELTA_MS = 1000

type TimeSkipOverlay = {
  gamepadHint: HTMLElement
  fill: HTMLElement
  label: HTMLElement
  root: HTMLElement
}

type TimeSkipSnapshot = {
  previousSchedulerSuspended: boolean
  previousSchedulerScale: number | null
  previousSoundSuppressed: boolean
  previousTickerSpeed: number
}

type TimeSkipEndReason = 'completed' | 'cancelled'

export type TimeSkipStartOptions = {
  mode?: 'sleep'
  fadeToBlack?: boolean
  completedMessage?: string
  onCancel?: () => void
  onComplete?: () => void
}

export type TimeSkipStartResult = {
  ok: boolean
  message: string
}

export function getHoursUntilNextMorning(hour: number, minute = 0, targetHour = 6): number {
  const currentHour = hour + minute / 60
  const normalizedTargetHour =
    ((targetHour % DAY_NIGHT_CONFIG.hoursPerDay) + DAY_NIGHT_CONFIG.hoursPerDay) % DAY_NIGHT_CONFIG.hoursPerDay
  const hoursUntilTarget =
    currentHour < normalizedTargetHour
      ? normalizedTargetHour - currentHour
      : DAY_NIGHT_CONFIG.hoursPerDay - currentHour + normalizedTargetHour
  return hoursUntilTarget || DAY_NIGHT_CONFIG.hoursPerDay
}

export class TimeSkipSystem {
  simulatingSleep = false
  private pendingStart: TimeSkipStartOptions | null = null
  private sleepStarted = false
  private pendingCancel: { silent?: boolean } | null = null
  private cancelPadIndex: number | null = null
  private cancelPressed = false
  active = false
  context: GameContextLike
  completedMessage: string | null = null
  dayNightMaxDeltaMs: number | undefined = undefined
  hours = 0
  onCancel: (() => void) | null = null
  onComplete: (() => void) | null = null
  overlay: TimeSkipOverlay | null = null
  snapshot: TimeSkipSnapshot | null = null
  startElapsedMs = 0
  suppressAudio = false
  suppressCosmetics = false
  targetElapsedMs = 0
  _onKeyDown: (evt: KeyboardEvent) => void
  _onTick: (ticker?: { deltaMS?: number; elapsedMS?: number }) => void

  constructor(
    context: GameContextLike,
    private sleep?: SleepSimulation
  ) {
    this.context = context
    this._onKeyDown = evt => this.onKeyDown(evt)
    this._onTick = () => this.onTick()
  }

  start(hours: number, options: TimeSkipStartOptions = {}): TimeSkipStartResult {
    if (!this.context.dayNight?.getElapsedMs) return { ok: false, message: 'Day/night system unavailable' }
    if (!this.context.app?.ticker) return { ok: false, message: 'Ticker unavailable' }
    if (this.context.paused) return { ok: false, message: 'Resume the game before using next <1-12>' }

    if (!Number.isFinite(hours) || hours <= 0) return { ok: false, message: 'Invalid wait duration' }
    if (this.active) return { ok: false, message: 'Already waiting' }
    if (
      options.mode === 'sleep' &&
      (!this.sleep || !this.context.scheduler.advanceSleepTime || !this.context.dayNight.setElapsedMs)
    )
      return { ok: false, message: 'Sleep simulation unavailable' }
    this.sleepStarted = false
    this.pendingCancel = null

    this.active = true
    this.completedMessage = options.completedMessage ?? null
    this.hours = hours
    this.onCancel = options.onCancel ?? null
    this.onComplete = options.onComplete ?? null
    this.startElapsedMs = this.context.dayNight.getElapsedMs()
    this.targetElapsedMs = this.startElapsedMs + (hours / DAY_NIGHT_CONFIG.hoursPerDay) * DAY_NIGHT_CONFIG.dayLengthMs
    this.snapshot = {
      previousSchedulerSuspended: this.context.scheduler.suspended ?? false,
      previousSchedulerScale: this.context.scheduler?.timeScale ?? null,
      previousSoundSuppressed: isGameplaySoundSuppressed(),
      previousTickerSpeed: this.context.app.ticker.speed ?? 1,
    }
    const pad = getGamepadEnabled() ? getActiveGamepad() : null
    this.cancelPadIndex = pad?.index ?? null
    this.cancelPressed = Boolean(pad?.buttons[1]?.pressed)
    this.overlay = this.createOverlay(hours, options.fadeToBlack)
    this.context.controls?.stopKeyboardMove?.()
    if (options.fadeToBlack && this.overlay) this.pendingStart = options
    else this.startSimulation(options)
    if (typeof document !== 'undefined') document.addEventListener?.('keydown', this._onKeyDown, true)
    this.context.app.ticker.add(this._onTick)

    return {
      ok: true,
      message:
        options.mode === 'sleep' ? `Sleeping ${hours}h...` : `Fast-forwarding ${hours}h at ${FAST_FORWARD_SPEED}x...`,
    }
  }

  private startSimulation(options: TimeSkipStartOptions): void {
    this.pendingStart = null
    this.simulatingSleep = options.mode === 'sleep'
    this.dayNightMaxDeltaMs = FAST_FORWARD_DAY_NIGHT_MAX_DELTA_MS
    this.suppressAudio = true
    this.suppressCosmetics = true
    this.context.app!.ticker.speed = this.simulatingSleep ? 0 : FAST_FORWARD_SPEED
    if (this.simulatingSleep) this.context.scheduler.suspended = true
    else this.context.scheduler.timeScale = FAST_FORWARD_SPEED
    setGameplaySoundSuppressed(true)
  }

  cancel(options: { silent?: boolean } = {}): void {
    if (!this.active) return
    if (this.simulatingSleep && this.sleep?.busy) {
      this.pendingCancel = options
      return
    }
    this.stop('cancelled', options)
  }

  destroy(): void {
    // Finish the current interval before releasing the world (at most one owner per iteration).
    if (this.simulatingSleep) while (this.sleep?.busy) this.sleep.step(this.targetElapsedMs)
    if (this.active) this.stop('cancelled', { silent: true })
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
    if (!this.pendingCancel && this.pollGamepadCancel()) return
    if (this.pendingStart) {
      if (this.context.defeat || this.context.paused) {
        this.stop('cancelled')
        return
      }
      // Inspect the actual CSS animation, including reduced-motion (no animation).
      const fading = this.overlay?.root
        .getAnimations()
        .some(animation => animation.pending || animation.playState === 'running')
      if (!fading) this.startSimulation(this.pendingStart)
      return // Let the fully black overlay render before doing any simulation work.
    }
    if (this.simulatingSleep) {
      if (this.context.defeat || this.context.paused) this.pendingCancel ??= {}
      if (this.pendingCancel && !this.sleep?.busy) {
        this.stop('cancelled', this.pendingCancel)
        return
      }
      try {
        if (!this.sleepStarted) {
          this.sleepStarted = true
          this.sleep!.begin()
          return // Give the overlay a rendered frame before the first interval.
        }
        this.sleep!.step(this.targetElapsedMs)
      } catch (error) {
        console.error('Sleep simulation failed', error)
        this.stop('cancelled')
        this.context.menu?.showMessage?.('Unable to finish sleep simulation', 'warning')
        return
      }
      if (!this.sleep!.busy && (this.pendingCancel || this.sleep!.interrupted)) {
        this.stop('cancelled', this.pendingCancel ?? {})
        return
      }
    }
    this.updateOverlay()
    if (this.simulatingSleep && this.sleep?.busy) return
    const elapsed = this.context.dayNight?.getElapsedMs?.() ?? this.startElapsedMs
    if (elapsed < this.targetElapsedMs && !this.context.defeat && !this.context.paused) return
    this.stop(elapsed >= this.targetElapsedMs ? 'completed' : 'cancelled')
  }

  private pollGamepadCancel(): boolean {
    const pad = getGamepadEnabled() ? getActiveGamepad() : null
    const pressed = Boolean(pad?.buttons[1]?.pressed)
    const cancel = pad && pad.index === this.cancelPadIndex && pressed && !this.cancelPressed
    this.cancelPadIndex = pad?.index ?? null
    this.cancelPressed = pressed
    if (!cancel || getConsumedGamepadButtons(pad).has(1)) return false
    consumeGamepadButtons(pad)
    this.cancel()
    return true
  }

  onKeyDown(evt: KeyboardEvent): void {
    if (!this.active || evt.key !== 'Escape') return
    evt.preventDefault()
    evt.stopImmediatePropagation()
    this.cancel()
  }

  private stop(reason: TimeSkipEndReason, options: { silent?: boolean } = {}): void {
    const snapshot = this.snapshot
    try {
      if (this.simulatingSleep) this.sleep?.end()
    } catch (error) {
      console.error('Unable to reconcile the world after sleep', error)
    }
    if (snapshot) this.context.scheduler.suspended = snapshot.previousSchedulerSuspended
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
    const onCancel = reason === 'cancelled' ? this.onCancel : null
    const completedMessage = this.completedMessage
    this.resetState()
    this.context.menu?.updateTopbar?.()
    if (options.silent) return
    if (reason === 'completed') {
      onComplete?.()
      const label =
        `${this.context.dayNight?.getDayLabel?.() ?? 'Day'} ${this.context.dayNight?.getTimeLabel?.() ?? ''}`.trim()
      this.context.menu?.showMessage?.(completedMessage ?? `Time advanced to ${label}`, 'success')
    } else {
      onCancel?.()
      this.context.menu?.showMessage?.('Time skip cancelled', 'warning')
    }
  }

  private resetState(): void {
    this.active = false
    this.pendingStart = null
    this.simulatingSleep = false
    this.sleepStarted = false
    this.pendingCancel = null
    this.completedMessage = null
    this.dayNightMaxDeltaMs = undefined
    this.hours = 0
    this.onCancel = null
    this.onComplete = null
    this.overlay = null
    this.snapshot = null
    this.startElapsedMs = 0
    this.suppressAudio = false
    this.suppressCosmetics = false
    this.targetElapsedMs = 0
  }

  private createOverlay(hours: number, fadeToBlack = false): TimeSkipOverlay | null {
    if (typeof document === 'undefined') return null
    const overlay = document.createElement('div')
    overlay.className = fadeToBlack ? 'time-skip-overlay time-skip-overlay--sleep' : 'time-skip-overlay'

    const panel = document.createElement('div')
    panel.className = 'time-skip-overlay__panel'

    const label = document.createElement('div')
    label.className = 'time-skip-overlay__label'

    const track = document.createElement('div')
    track.className = 'time-skip-overlay__track'

    const fill = document.createElement('div')
    fill.className = 'time-skip-overlay__fill'
    fill.style.width = '0%'

    const hints = document.createElement('div')
    hints.className = 'time-skip-overlay__controls'
    const keyboardHint = document.createElement('span')
    const key = document.createElement('kbd')
    key.textContent = 'Esc'
    const keyboardLabel = document.createElement('span')
    keyboardLabel.textContent = t('cancel')
    keyboardHint.appendChild(key)
    keyboardHint.appendChild(keyboardLabel)
    const gamepadHint = document.createElement('span')
    const gamepadLabel = document.createElement('span')
    gamepadLabel.textContent = t('cancel')
    gamepadHint.appendChild(createGamepadKey(1))
    gamepadHint.appendChild(gamepadLabel)
    hints.appendChild(keyboardHint)
    hints.appendChild(gamepadHint)

    track.appendChild(fill)
    panel.appendChild(label)
    panel.appendChild(track)
    panel.appendChild(hints)
    overlay.appendChild(panel)
    this.context.gamebox.appendChild(overlay)

    const result = { fill, label, gamepadHint, root: overlay }
    this.updateOverlayElement(result, 0, hours)
    return result
  }

  private updateOverlay(): void {
    this.updateOverlayElement(this.overlay, this.getProgress(), this.getRemainingHours())
  }

  private updateOverlayElement(overlay: TimeSkipOverlay | null, progress: number, remainingHours: number): void {
    if (!overlay) return
    overlay.gamepadHint.hidden = !(getGamepadEnabled() && getActiveGamepad())
    const percent = `${Math.round(Math.max(0, Math.min(100, progress * 100)))}%`
    const unit = remainingHours === 1 ? 'hour' : 'hours'
    overlay.label.textContent = `Waiting... ${remainingHours} ${unit} remaining`
    overlay.fill.style.width = percent
  }
}
