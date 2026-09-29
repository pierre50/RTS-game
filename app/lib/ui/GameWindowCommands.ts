import { getGamepadGlyph } from '../input/gamepadGlyph'
import { getGamepadButtonIndex } from '../audio/settings'
import { t } from '../lang'
import { adjustWindowField, canAdjustWindowField, getWindowField } from './GameWindowForms'
export type Command = {
  id: string
  label: string
  key: string
  pad: number
  glyph: string
  disabled?: boolean
  danger?: boolean
  run: () => void
}
const ROW = '.inventory-action-row'
const GLOBAL_ACTION = '[data-window-action], .entity-delete-building-button'
type CommandHost = {
  getSelected: () => HTMLElement | null
  panel: HTMLElement
  dismissible: boolean
  dismiss: () => void
  scheduleRefresh: () => void
  switchPanel: (direction: number) => void
}
function buttonCommand(button: HTMLButtonElement, id: string, key: string, pad: number): Command {
  return {
    id,
    key,
    pad,
    glyph: getGamepadGlyph(pad),
    label:
      button.dataset.windowLabel ||
      button.querySelector('.hero-building-menu-label')?.textContent?.trim() ||
      button.textContent?.trim() ||
      button.getAttribute('aria-label') ||
      '',
    disabled: button.disabled,
    danger: button.matches('.entity-delete-building-button, .inventory-row-action-button--delete'),
    run: () => {
      if (button.isConnected && !button.disabled) button.click()
    },
  }
}
export function availableCommands(host: CommandHost): Command[] {
  const commands: Command[] = []
  const field = getWindowField(host.getSelected())
  if (field) {
    if (field instanceof HTMLSelectElement || field.type === 'range') {
      for (const direction of [-1, 1])
        commands.push({
          id: direction < 0 ? 'decrease' : 'increase',
          label: t(direction < 0 ? 'windowPrevious' : 'windowNext'),
          key: direction < 0 ? 'ArrowLeft' : 'ArrowRight',
          pad: -1,
          glyph: direction < 0 ? '←' : '→',
          disabled: !canAdjustWindowField(host.getSelected(), direction),
          run: () => {
            adjustWindowField(host.getSelected(), direction)
            host.scheduleRefresh()
          },
        })
    } else {
      commands.push({
        id: 'field',
        label: t(field.type === 'checkbox' ? 'windowToggle' : 'windowEditText'),
        key: 'Enter',
        pad: 0,
        glyph: 'A',
        disabled: field.disabled,
        run: () => {
          if (field.type === 'checkbox') field.click()
          else {
            field.focus()
            field.select()
          }
        },
      })
    }
  }
  const row = host.getSelected()
  const buttons = row?.matches(ROW) ? [...row.querySelectorAll<HTMLButtonElement>('.inventory-row-action-button')] : []
  const primary =
    buttons.find(button => !button.matches('.inventory-row-action-button--delete')) ??
    (row instanceof HTMLButtonElement ? row : null)
  if (primary) {
    commands.push(buttonCommand(primary, 'primary', 'Enter', 0))
    if (primary.dataset.inventoryTransferSlot === 'true') {
      commands.push({
        ...buttonCommand(primary, 'stack', 'Shift+Enter', 2),
        label: t('windowWholeStack'),
        run: () => {
          if (primary.isConnected && !primary.disabled)
            primary.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))
        },
      })
    }
  }
  const secondary = buttons.find(button => button !== primary)
  if (secondary) {
    commands.push(buttonCommand(secondary, 'secondary', 'X', 3))
    if (secondary.matches('.inventory-row-action-button--delete') && row?.querySelector('.inventory-quantity-badge')) {
      commands.push({
        ...buttonCommand(secondary, 'secondary-stack', 'Shift+X', 8),
        label: t('windowDeleteStack'),
        run: () => {
          if (secondary.isConnected && !secondary.disabled)
            secondary.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))
        },
      })
    }
  }
  const section = row?.closest('.inventory-section')
  const all = section?.querySelector<HTMLButtonElement>('.inventory-transfer-all-button')
  if (all) commands.push(buttonCommand(all, 'all', 'R', 7))
  for (const button of host.panel.querySelectorAll<HTMLButtonElement>(GLOBAL_ACTION)) {
    if (button.closest('[hidden], .hidden, [aria-hidden="true"]')) continue
    const danger = button.matches('.entity-delete-building-button')
    commands.push(buttonCommand(button, danger ? 'remove' : 'deliveries', danger ? 'X' : 'V', danger ? 3 : 6))
  }
  if (host.panel.querySelectorAll('.ui-tab').length > 1) {
    for (const direction of [-1, 1])
      commands.push({
        id: direction < 0 ? 'previous-tab' : 'next-tab',
        label: t(direction < 0 ? 'windowPreviousTab' : 'windowNextTab'),
        key: direction < 0 ? 'PageUp' : 'PageDown',
        pad: direction < 0 ? 4 : 5,
        glyph: direction < 0 ? 'LB' : 'RB',
        run: () => host.switchPanel(direction),
      })
  }
  if (host.dismissible)
    commands.push({ id: 'close', label: t('close'), key: 'Escape', pad: 1, glyph: 'B', run: host.dismiss })
  if (primary?.dataset.inventoryTransferSlot === 'true') {
    const assigned = new Set<number>()
    for (const [id, action] of [
      ['primary', 'inventoryTransferOne'],
      ['stack', 'inventoryTransferAll'],
    ] as const) {
      const command = commands.find(value => value.id === id)
      const pad = getGamepadButtonIndex(action)
      if (!command || assigned.has(pad)) continue
      const occupied = commands.find(value => value !== command && value.pad === pad)
      if (occupied) {
        occupied.pad = command.pad
        occupied.glyph = getGamepadGlyph(occupied.pad)
      }
      command.pad = pad
      command.glyph = getGamepadGlyph(pad)
      assigned.add(pad)
    }
  }
  return commands
}
