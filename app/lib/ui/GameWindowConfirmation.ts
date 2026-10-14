import { t } from '../lang'
import type { Command } from './GameWindowCommands'

/** Drops a pending confirmation whose command vanished or became disabled. */
export function retainedConfirmation(confirmation: Command | null, commands: Command[]): Command | null {
  if (!confirmation) return null
  return commands.some(command => command.id === confirmation.id && !command.disabled) ? confirmation : null
}

/** Replaces the footer with confirm/cancel while a dangerous, confirm or hold command awaits an answer. */
export function confirmationCommands(confirmation: Command, confirm: () => void, cancel: () => void): Command[] {
  return [
    {
      ...confirmation,
      id: 'confirm',
      label: t('windowConfirm'),
      key: 'Enter',
      pad: 0,
      glyph: 'A',
      danger: false,
      hold: false,
      confirm: false,
      run: confirm,
    },
    { id: 'cancel', label: t('cancel'), key: 'Escape', pad: 1, glyph: 'B', run: cancel },
  ]
}

export function windowCommandSignature(
  mode: string,
  hasItems: boolean,
  confirmation: Command | null,
  commands: Command[]
): string {
  return JSON.stringify([
    mode,
    hasItems,
    confirmation?.label,
    commands.map(({ id, label, key, pad, disabled, description, hold }) => [
      id,
      label,
      key,
      pad,
      disabled,
      description,
      hold,
    ]),
  ])
}
