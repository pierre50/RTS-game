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
    danger: button.matches('.entity-delete-building-button'),
    run: () => {
      if (button.isConnected && !button.disabled) button.click()
    },
  }
}
function shiftClickCommand(button: HTMLButtonElement, id: string, key: string, pad: number): Command {
  return {
    ...buttonCommand(button, id, key, pad),
    run: () => {
      if (button.isConnected && !button.disabled)
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))
    },
  }
}
function arrowCommand(direction: number, id: string, disabled: boolean, run: () => void): Command {
  return {
    id,
    label: t(direction < 0 ? 'windowPrevious' : 'windowNext'),
    key: direction < 0 ? 'ArrowLeft' : 'ArrowRight',
    pad: -1,
    glyph: direction < 0 ? '←' : '→',
    disabled,
    run,
  }
}
function fieldCommands(host: CommandHost): Command[] {
  const field = getWindowField(host.getSelected())
  if (!field) return []
  if (field instanceof HTMLSelectElement || field.type === 'range') {
    return [-1, 1].map(direction =>
      arrowCommand(
        direction,
        direction < 0 ? 'decrease' : 'increase',
        !canAdjustWindowField(host.getSelected(), direction),
        () => {
          adjustWindowField(host.getSelected(), direction)
          host.scheduleRefresh()
        }
      )
    )
  }
  return [
    {
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
    },
  ]
}
function variantCommands(host: CommandHost, row: HTMLElement | null): Command[] {
  const variant = getVariantRow(row)
  if (!variant) return []
  return [-1, 1].map(direction =>
    arrowCommand(direction, direction < 0 ? 'previous-variant' : 'next-variant', !variant.canStep(direction), () => {
      variant.step(direction)
      host.scheduleRefresh()
    })
  )
}
function primaryCommands(primary: HTMLButtonElement, row: HTMLElement | null): Command[] {
  const commands = [buttonCommand(primary, 'primary', 'Enter', 0)]
  if (primary.dataset.craftBatchLabel) {
    commands.push({
      ...shiftClickCommand(primary, 'craft-batch', 'Shift+Enter', 0),
      padModifier: 6,
      glyph: `${getGamepadGlyph(6)} + ${getGamepadGlyph(0)}`,
      label: primary.dataset.craftBatchLabel,
    })
  }
  if (primary.dataset.inventoryTransferSlot === 'true' && row?.querySelector('.inventory-quantity-badge')) {
    commands.push({ ...shiftClickCommand(primary, 'stack', 'Shift+Enter', 2), label: t('windowWholeStack') })
  }
  return commands
}
function secondaryCommands(secondary: HTMLButtonElement, row: HTMLElement | null): Command[] {
  const commands = [buttonCommand(secondary, 'secondary', 'X', 3)]
  if (secondary.matches('.inventory-row-action-button--delete') && row?.querySelector('.inventory-quantity-badge')) {
    commands.push({ ...shiftClickCommand(secondary, 'secondary-stack', 'Shift+X', 8), label: t('windowDeleteStack') })
  }
  return commands
}
function rowCommands(row: HTMLElement | null): { commands: Command[]; primary: HTMLButtonElement | null } {
  const commands: Command[] = []
  const buttons = row?.matches(ROW) ? [...row.querySelectorAll<HTMLButtonElement>('.inventory-row-action-button')] : []
  const primary =
    buttons.find(button => !button.matches('.inventory-row-action-button--delete')) ??
    (row instanceof HTMLButtonElement ? row : null)
  if (primary) commands.push(...primaryCommands(primary, row))
  const secondary = buttons.find(button => button !== primary)
  if (secondary) commands.push(...secondaryCommands(secondary, row))
  const section = row?.closest('.inventory-section')
  const all = section?.querySelector<HTMLButtonElement>('.inventory-transfer-all-button')
  if (all) commands.push(buttonCommand(all, 'all', 'R', 7))
  return { commands, primary }
}
function globalActionCommand(button: HTMLButtonElement, globalButtons: HTMLButtonElement[]): Command {
  const action = button.dataset.windowAction
  if (action === 'sleep') return { ...buttonCommand(button, action, 'X', 2), confirm: true }
  if (action === 'upgrade') {
    const hasSecondaryAction = globalButtons.some(candidate => candidate.dataset.windowAction === 'sleep')
    return {
      ...buttonCommand(button, action, 'U', 2),
      ...(hasSecondaryAction ? { padModifier: 6, glyph: `${getGamepadGlyph(6)} + ${getGamepadGlyph(2)}` } : {}),
    }
  }
  if (action === 'quest-track') return buttonCommand(button, action, 'X', 2)
  return buttonCommand(button, 'deliveries', 'V', 6)
}
function globalCommands(panel: HTMLElement): Command[] {
  const globalButtons = [...panel.querySelectorAll<HTMLButtonElement>(GLOBAL_ACTION)].filter(
    button => !button.closest('[hidden], .hidden, [aria-hidden="true"]')
  )
  const removal = globalButtons.filter(button => button.matches('.entity-delete-building-button'))
  const commands = globalButtons
    .filter(button => !button.matches('.entity-delete-building-button'))
    .map(button => globalActionCommand(button, globalButtons))
  removal.forEach((button, index) => commands.push(buttonCommand(button, `remove-${index}`, 'Y', 3)))
  return commands
}
function windowCommands(host: CommandHost): Command[] {
  const commands: Command[] = []
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
  return commands
}
/** Inventory transfer slots follow the player's transfer bindings, swapping whichever command held that pad. */
function applyTransferBindings(commands: Command[]): void {
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
export function availableCommands(host: CommandHost): Command[] {
  const row = host.getSelected()
  const inventory = rowCommands(row)
  const commands = [
    ...fieldCommands(host),
    ...variantCommands(host, row),
    ...inventory.commands,
    ...globalCommands(host.panel),
    ...windowCommands(host),
  ]
  if (inventory.primary?.dataset.inventoryTransferSlot === 'true') applyTransferBindings(commands)
  const interaction = getWindowInteraction(host.panel)
  if (!interaction) return commands
  const own = interaction.commands()
  return [
    ...own,
    ...commands.filter(
      command => ['previous-tab', 'next-tab', 'close'].includes(command.id) && !own.some(item => item.id === command.id)
    ),
  ]
}
