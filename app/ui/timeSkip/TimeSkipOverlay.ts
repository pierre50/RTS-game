import { getGamepadEnabled } from '../../lib/audio/settings'
import { getActiveGamepad } from '../../lib/input/gamepad'
import { createGamepadKey } from '../../lib/input/gamepadGlyph'
import { t } from '../../lib/lang'

export type TimeSkipOverlay = {
  gamepadHint: HTMLElement
  keyboardHint: HTMLElement
  fill: HTMLElement
  label: HTMLElement
  root: HTMLElement
}

export function createTimeSkipOverlay(
  gamebox: HTMLElement,
  hours: number,
  fadeToBlack = false
): TimeSkipOverlay | null {
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
  gamebox.appendChild(overlay)

  const result = { fill, label, gamepadHint, keyboardHint, root: overlay }
  updateTimeSkipOverlay(result, 0, hours)
  return result
}

export function updateTimeSkipOverlay(overlay: TimeSkipOverlay | null, progress: number, remainingHours: number): void {
  if (!overlay) return
  const gamepadActive = Boolean(getGamepadEnabled() && getActiveGamepad())
  overlay.gamepadHint.hidden = !gamepadActive
  overlay.keyboardHint.hidden = gamepadActive
  const percent = `${Math.round(Math.max(0, Math.min(100, progress * 100)))}%`
  const displayedHours = Math.ceil(remainingHours)
  const unit = displayedHours === 1 ? 'hour' : 'hours'
  overlay.label.textContent = `Waiting... ${displayedHours} ${unit} remaining`
  overlay.fill.style.width = percent
}
