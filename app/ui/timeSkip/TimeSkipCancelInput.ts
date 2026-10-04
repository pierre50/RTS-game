import { getGamepadEnabled } from '../../lib/audio/settings'
import { getActiveGamepad } from '../../lib/input/gamepad'
import { consumeGamepadButtons, getConsumedGamepadButtons } from '../../lib/input/gamepadConsumption'

/** Only a fresh cancel press on the same controller can end the current skip. */
export class TimeSkipCancelInput {
  private padIndex: number | null = null
  private pressed = false

  reset(): void {
    const pad = getGamepadEnabled() ? getActiveGamepad() : null
    this.padIndex = pad?.index ?? null
    this.pressed = Boolean(pad?.buttons[1]?.pressed)
  }

  poll(): boolean {
    const pad = getGamepadEnabled() ? getActiveGamepad() : null
    const pressed = Boolean(pad?.buttons[1]?.pressed)
    const cancel = pad && pad.index === this.padIndex && pressed && !this.pressed
    this.padIndex = pad?.index ?? null
    this.pressed = pressed
    if (!cancel || getConsumedGamepadButtons(pad).has(1)) return false
    consumeGamepadButtons(pad)
    return true
  }
}
