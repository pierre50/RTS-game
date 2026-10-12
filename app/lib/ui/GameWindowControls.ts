import { getWindowInteraction } from './GameWindowInteraction'
import { getConsumedGamepadButtons } from '../input/gamepadConsumption'
import { type Command } from './GameWindowCommands'
import { getWindowTabScope, isWindowTabInScope } from './GameWindowElements'
import {
  EDITABLE_FIELD,
  findEnabledPadCommand,
  findLiveCommand,
  getHoldProgress,
  getPadConfirmationChoice,
  hasHeldDirectionalCommand,
  hasWindowKeyModifier,
  isEditingWindowField,
  isHoldComplete,
  isInventoryToggleKey,
  isPadButtonBound,
  keepsFieldKey,
  type ConfirmationChoice,
  type WindowHold,
  type WindowKeyIntent,
} from './GameWindowInput'
import { GameWindowPadState } from './GameWindowNavigation'
import { scrollWindowInformation } from './GameWindowScroll'

type WindowControlHost = {
  readonly panel: HTMLElement
  readonly footer: HTMLElement
  readonly commands: Command[]
  readonly selected: HTMLElement | null
  readonly confirmation: Command | null
  visible(element: HTMLElement): boolean
  select(element: HTMLElement | null, focus: boolean): void
  isTopmost(): boolean
  dismiss(): void
  move(dx: number, dy: number): void
  switchPanel(direction: number): void
  setMode(mode: 'keyboard' | 'gamepad'): void
  refresh(): void
  scheduleRefresh(): void
  execute(command: Command): void
}

/** Keyboard and gamepad holds share live commands, but keep independent input state. */
export class GameWindowControls {
  readonly padState = new GameWindowPadState()
  holding: WindowHold | null = null
  keyboardHolding: WindowHold | null = null
  private lastScrollAt = 0
  constructor(private readonly host: WindowControlHost) {}
  cancelKeyboardHold(): void {
    this.keyboardHolding = null
  }
  switchPanel(direction: number): void {
    const scope = getWindowTabScope(this.host.selected, this.host.panel)
    const tabs = [...scope.querySelectorAll<HTMLButtonElement>('.ui-tab')].filter(
      tab => !tab.disabled && this.host.visible(tab) && isWindowTabInScope(tab, scope, this.host.panel)
    )
    if (tabs.length) {
      const index = tabs.findIndex(tab => tab.getAttribute('aria-selected') === 'true')
      const tab = tabs[(index + direction + tabs.length) % tabs.length]
      tab.click()
      this.host.select(tab, true)
      return
    }
  }

  acceptsWindowKey(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement
    if (target.closest('.is-listening')) return false
    if (target.closest(EDITABLE_FIELD)) {
      this.cancelKeyboardHold()
      this.host.setMode('keyboard')
      if (keepsFieldKey(target, event.key)) return false
    }
    this.host.setMode('keyboard')
    if (hasWindowKeyModifier(event)) {
      this.cancelKeyboardHold()
      return false
    }
    if (event.key.toLowerCase() !== 'x') this.cancelKeyboardHold()
    return true
  }

  toggleInventoryFromKey(event: KeyboardEvent): boolean {
    if (!isInventoryToggleKey(event, this.host.panel)) return false
    event.preventDefault()
    event.stopImmediatePropagation()
    if (!event.repeat) this.host.dismiss()
    return true
  }

  runKeyIntent({ direction, command, page }: WindowKeyIntent, repeat: boolean): void {
    if (direction) this.host.move(direction[0], direction[1])
    else if (page) this.host.switchPanel(page)
    else if (command && !repeat) {
      if (command.hold && !command.disabled) this.keyboardHolding = { command, since: performance.now() }
      else this.host.execute(command)
    }
  }

  answerConfirmation(choice: ConfirmationChoice): void {
    if (choice) this.host.footer.querySelector<HTMLButtonElement>(`[data-command="${choice}"]`)?.click()
  }

  advanceKeyboardHold(now: number): void {
    const held = this.keyboardHolding
    if (!held) return
    const current = findLiveCommand(this.host.commands, held.command)
    if (!this.host.isTopmost() || this.host.confirmation || isEditingWindowField() || !current) {
      this.cancelKeyboardHold()
      return
    }
    this.host.footer.style.setProperty('--hold-progress', getHoldProgress(held, now))
    if (isHoldComplete(held, now)) {
      this.cancelKeyboardHold()
      current.run()
      this.host.scheduleRefresh()
    }
  }

  readGamepad(pad: Gamepad, now: number): void {
    const state = this.padState.read(pad, now)
    // Read every frame: released buttons only leave the consumed set when observed released.
    const consumed = getConsumedGamepadButtons(pad)
    const pressed = state.pressed.filter(index => !consumed.has(index))
    const direction = state.direction
    const readAxis = pad.axes[3] ?? 0
    const elapsed = Math.min(50, Math.max(0, now - (this.lastScrollAt || now)))
    this.lastScrollAt = now
    if (pressed.length || direction || Math.abs(readAxis) > 0.35) this.host.setMode('gamepad')
    // Visibility and content may have changed since selection was painted (including during opening).
    if (pressed.length) this.host.refresh()
    const interaction = getWindowInteraction(this.host.panel)
    if (
      interaction &&
      (pad.axes.slice(0, 2).some(value => Math.abs(value) > 0.2) ||
        [6, 7].some(index => (pad.buttons[index]?.value ?? 0) > 0.2))
    )
      this.host.setMode('gamepad')
    if (!this.host.confirmation) interaction?.gamepad(pad, elapsed)
    if (!interaction && !this.host.confirmation && Math.abs(readAxis) > 0.35)
      scrollWindowInformation(this.host.panel, readAxis * elapsed * 0.65, this.host.selected)
    if (this.host.confirmation) {
      this.answerConfirmation(getPadConfirmationChoice(pressed))
      return
    }
    if (!interaction && direction && !hasHeldDirectionalCommand(this.host.commands, pad)) this.host.move(...direction)
    if (document.querySelector('.virtual-keyboard')) return
    if (pressed.includes(4) && !isPadButtonBound(this.host.commands, 4)) this.host.switchPanel(-1)
    if (pressed.includes(5) && !isPadButtonBound(this.host.commands, 5)) this.host.switchPanel(1)
    for (const index of pressed) {
      const command = findEnabledPadCommand(this.host.commands, index, pad)
      if (!command || (interaction && command.continuous)) continue
      if (command.hold) this.holding = { command, since: now }
      else this.host.execute(command)
      if (this.host.confirmation || document.querySelector('.virtual-keyboard')) break
    }
    this.advancePadHold(pad, now)
  }

  advancePadHold(pad: Gamepad, now: number): void {
    const held = this.holding
    if (!held) return
    if (!pad.buttons[held.command.pad]?.pressed) this.holding = null
    else if (isHoldComplete(held, now)) {
      this.holding = null
      findLiveCommand(this.host.commands, held.command)?.run()
    }
    this.host.footer.style.setProperty('--hold-progress', getHoldProgress(held, now))
  }
}
