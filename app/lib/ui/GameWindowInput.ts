import { getControlActionForKeyboardEvent, getGamepadEnabled } from '../audio/settings'
import { getActiveGamepad } from '../input/gamepad'
import type { Command } from './GameWindowCommands'

const HOLD_DURATION_MS = 850
export const EDITABLE_FIELD =
  'input:not([type=range]):not([type=checkbox]), textarea, [contenteditable]:not([contenteditable="false"])'
const KEY_DIRECTIONS: Partial<Record<string, [number, number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

export type WindowHold = { command: Command; since: number }
export type WindowKeyIntent = { direction?: [number, number]; command?: Command; page: number }
export type ConfirmationChoice = 'confirm' | 'cancel' | null

/** Settings must remain navigable after the gameplay gamepad option is turned off. */
export function getWindowGamepad(panel: HTMLElement): Gamepad | null {
  return getGamepadEnabled() || !panel.closest('.inventory-panel, .inventory-transfer-modal, .interaction-panel')
    ? getActiveGamepad()
    : null
}

/** Single-line fields keep horizontal caret movement; vertical arrows navigate the window. */
export function keepsFieldKey(target: HTMLElement, key: string): boolean {
  const verticalNavigation = target.matches('input') && ['ArrowUp', 'ArrowDown'].includes(key)
  return !verticalNavigation && !['Escape', 'PageUp', 'PageDown'].includes(key)
}

export function hasWindowKeyModifier(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey || event.altKey || event.isComposing
}

export function readWindowKeyIntent(event: KeyboardEvent, commands: Command[]): WindowKeyIntent {
  const commandKey =
    event.shiftKey && ['enter', 'x'].includes(event.key.toLowerCase()) ? `Shift+${event.key}` : event.key
  return {
    direction: KEY_DIRECTIONS[event.key],
    command: commands.find(item => item.key.toLowerCase() === commandKey.toLowerCase()),
    page: event.key === 'PageUp' ? -1 : event.key === 'PageDown' ? 1 : 0,
  }
}

export function isInventoryToggleKey(event: KeyboardEvent, panel: HTMLElement): boolean {
  return getControlActionForKeyboardEvent(event) === 'inventory' && panel.classList.contains('inventory-panel')
}

export function isUnboundWindowKey(intent: WindowKeyIntent, key: string, confirming: boolean): boolean {
  return !intent.direction && !intent.command && !intent.page && !(confirming && ['Enter', 'Escape'].includes(key))
}

/** Native keyboard activation of a focused command remains available. */
export function isNativeButtonActivation(event: KeyboardEvent, selected: HTMLElement | null): boolean {
  return (
    event.key === 'Enter' &&
    !event.shiftKey &&
    document.activeElement instanceof HTMLButtonElement &&
    document.activeElement !== selected
  )
}

export function getKeyConfirmationChoice(event: KeyboardEvent): ConfirmationChoice {
  if (event.repeat || (event.key !== 'Enter' && event.key !== 'Escape')) return null
  return event.key === 'Enter' ? 'confirm' : 'cancel'
}

export function getPadConfirmationChoice(pressed: number[]): ConfirmationChoice {
  if (pressed.includes(1)) return 'cancel'
  return pressed.includes(0) ? 'confirm' : null
}

export function isPadButtonBound(commands: Command[], index: number): boolean {
  return commands.some(command => command.pad === index)
}

export function hasHeldDirectionalCommand(commands: Command[], pad: Gamepad): boolean {
  return commands.some(command => command.pad >= 12 && command.pad <= 15 && pad.buttons[command.pad]?.pressed)
}

export function findEnabledPadCommand(commands: Command[], index: number, pad?: Gamepad): Command | null {
  const command =
    commands.find(
      item => item.pad === index && item.padModifier !== undefined && pad?.buttons[item.padModifier]?.pressed
    ) ?? commands.find(item => item.pad === index && item.padModifier === undefined)
  return command && !command.disabled ? command : null
}

export function isEditingWindowField(): boolean {
  return Boolean(document.activeElement?.closest(EDITABLE_FIELD))
}

/** Holds run the current version of a command, which may have changed since the press. */
export function findLiveCommand(commands: Command[], command: Command): Command | null {
  const current = commands.find(item => item.id === command.id)
  return current && !current.disabled ? current : null
}

export function isHoldComplete(hold: WindowHold, now: number): boolean {
  return now - hold.since >= HOLD_DURATION_MS
}

export function getHoldProgress(hold: WindowHold, now: number): string {
  return `${Math.min(100, ((now - hold.since) / HOLD_DURATION_MS) * 100)}%`
}
