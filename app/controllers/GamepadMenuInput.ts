import { getGamepadButtonIndex, getGamepadEnabled } from '../lib/audio/settings'
import { getConsumedGamepadButtons } from '../lib/input/gamepadConsumption'
import { getActiveGamepad } from '../lib/input/gamepad'

/** Runs independently of the game ticker so Start still works while paused. */
export class GamepadMenuInput {
  private frame = 0
  private pressed = false
  private connected = false
  private binding = -1
  private disposed = false

  constructor(private toggle: () => void) {
    this.frame = requestAnimationFrame(this.poll)
  }

  private poll = (): void => {
    if (this.disposed) return
    const pad = getGamepadEnabled() ? getActiveGamepad() : null
    const binding = getGamepadButtonIndex('gameMenu')
    const pressed = Boolean(pad?.buttons[binding]?.pressed)
    const activate = this.connected && binding === this.binding && pressed && !this.pressed
    this.binding = binding
    this.connected = Boolean(pad)
    this.pressed = pressed
    if (
      activate &&
      document.visibilityState !== 'hidden' &&
      !document.querySelector('.is-listening, .virtual-keyboard') &&
      pad &&
      !getConsumedGamepadButtons(pad).has(binding)
    )
      this.toggle()
    if (!this.disposed) this.frame = requestAnimationFrame(this.poll)
  }

  destroy(): void {
    this.disposed = true
    cancelAnimationFrame(this.frame)
  }
}
