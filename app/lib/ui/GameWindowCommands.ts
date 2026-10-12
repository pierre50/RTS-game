import { getWindowInteraction } from './GameWindowInteraction'
import { getVariantRow } from './VariantRow'
import { getGamepadGlyph } from '../input/gamepadGlyph'
import { getGamepadButtonIndex } from '../audio/settings'
import { t } from '../lang'
import { adjustWindowField, canAdjustWindowField, getWindowField } from './GameWindowForms'
export type Command = {
  id: string
  label: string
  key: string
  pad: number
  padModifier?: number
  glyph: string
  continuous?: boolean
  disabled?: boolean
  danger?: boolean
  hold?: boolean
  confirm?: boolean
  description?: string
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
      button.querySelector('.hero-building-menu-label, .nested-button-menu-label')?.textContent?.trim() ||
      button.textContent?.trim() ||
      button.getAttribute('aria-label') ||
      '',
    disabled: button.disabled,
    description: button.title,
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
            field.dispatchEvent(new Event('virtualkeyboardrequest', { bubbles: true }))
          }
        },
      })
    }
  }
  const row = host.getSelected()
  const variant = getVariantRow(row)
  if (variant) {
    for (const direction of [-1, 1])
      commands.push({
        id: direction < 0 ? 'previous-variant' : 'next-variant',
        label: t(direction < 0 ? 'windowPrevious' : 'windowNext'),
        key: direction < 0 ? 'ArrowLeft' : 'ArrowRight',
        pad: -1,
        glyph: direction < 0 ? '←' : '→',
        disabled: !variant.canStep(direction),
        run: () => {
          variant.step(direction)
          host.scheduleRefresh()
        },
      })
  }
  const buttons = row?.matches(ROW) ? [...row.querySelectorAll<HTMLButtonElement>('.inventory-row-action-button')] : []
  const primary =
    buttons.find(button => !button.matches('.inventory-row-action-button--delete')) ??
    (row instanceof HTMLButtonElement ? row : null)
  if (primary) {
    commands.push(buttonCommand(primary, 'primary', 'Enter', 0))
    if (primary.dataset.craftBatchLabel) {
      commands.push({
        ...buttonCommand(primary, 'craft-batch', 'Shift+Enter', 0),
        padModifier: 6,
        glyph: `${getGamepadGlyph(6)} + ${getGamepadGlyph(0)}`,
        label: primary.dataset.craftBatchLabel,
        run: () => {
          if (primary.isConnected && !primary.disabled)
            primary.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))
        },
      })
    }
    if (primary.dataset.inventoryTransferSlot === 'true' && row?.querySelector('.inventory-quantity-badge')) {
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
  const globalButtons = [...host.panel.querySelectorAll<HTMLButtonElement>(GLOBAL_ACTION)].filter(
    button => !button.closest('[hidden], .hidden, [aria-hidden="true"]')
  )
  const removal = globalButtons.filter(button => button.matches('.entity-delete-building-button'))
  for (const button of globalButtons) {
    if (button.matches('.entity-delete-building-button')) continue
    const action = button.dataset.windowAction
    if (action === 'sleep') {
      commands.push({
        ...buttonCommand(button, action, 'X', 2),
        confirm: true,
      })
    } else if (action === 'upgrade') {
      const hasSecondaryAction = globalButtons.some(candidate => candidate.dataset.windowAction === 'sleep')
      commands.push({
        ...buttonCommand(button, action, 'U', 2),
        ...(hasSecondaryAction ? { padModifier: 6, glyph: `${getGamepadGlyph(6)} + ${getGamepadGlyph(2)}` } : {}),
      })
    } else if (action === 'quest-track') {
      commands.push(buttonCommand(button, action, 'X', 2))
    } else {
      commands.push(buttonCommand(button, 'deliveries', 'V', 6))
    }
  }
  removal.forEach((button, index) => commands.push(buttonCommand(button, `remove-${index}`, 'Y', 3)))
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
  const interaction = getWindowInteraction(host.panel)
  if (interaction) {
    const own = interaction.commands()
    return [
      ...own,
      ...commands.filter(
        command =>
          ['previous-tab', 'next-tab', 'close'].includes(command.id) && !own.some(item => item.id === command.id)
      ),
    ]
  }
  return commands
}
