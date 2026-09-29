import { t } from '../lang'
import type { Command } from './GameWindowCommands'
type FooterOptions = {
  footer: HTMLElement
  mode: 'keyboard' | 'gamepad'
  confirmation: Command | null
  commands: Command[]
  hasItems: boolean
  multiplePanels: boolean
  restoreSelectionFocus: () => void
  execute: (command: Command) => void
  resolveCommand: (command: Command) => Command | undefined
}
export function renderCommandFooter({
  footer,
  mode,
  confirmation,
  commands,
  hasItems,
  multiplePanels,
  restoreSelectionFocus,
  execute,
  resolveCommand,
}: FooterOptions): void {
  const focusedCommand = (document.activeElement as HTMLElement | null)?.dataset.command
  footer.replaceChildren()
  if (confirmation) {
    const question = document.createElement('span')
    question.className = 'game-window-confirmation'
    question.textContent = `${confirmation.label} ?`
    footer.appendChild(question)
  }
  if (!confirmation && hasItems) {
    const navigation = document.createElement('span')
    navigation.className = 'game-window-navigation'
    navigation.textContent = mode === 'gamepad' ? `✥ ${t('windowNavigation')}` : `↑ ↓ ← → ${t('windowNavigation')}`
    if (multiplePanels)
      navigation.textContent +=
        mode === 'gamepad' ? ` · LB / RB ${t('windowPanels')}` : ` · Page ↑ / ↓ ${t('windowPanels')}`
    footer.appendChild(navigation)
  }
  for (const command of commands) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'game-window-command'
    button.dataset.command = command.id
    button.disabled = command.disabled ?? false
    button.classList.toggle('is-danger', Boolean(command.danger))
    const key = document.createElement('kbd')
    key.textContent =
      mode === 'gamepad'
        ? command.glyph
        : ({ ArrowLeft: '←', ArrowRight: '→', Enter: '↵', Escape: 'Esc', PageUp: 'Pg ↑', PageDown: 'Pg ↓' }[
            command.key
          ] ?? command.key)
    key.dataset.pad = String(command.pad)
    const label = document.createElement('span')
    label.textContent = `${command.label}${command.danger ? ` · ${t('windowHold')}` : ''}`
    button.append(key, label)
    button.addEventListener('click', () => {
      // Resolve fresh handlers: live refreshes may have replaced the source button.
      const current = resolveCommand(command)
      if (current) execute(current)
    })
    footer.appendChild(button)
    if (focusedCommand === command.id) button.focus({ preventScroll: true })
  }
  if (confirmation) footer.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
  else if (focusedCommand && !footer.contains(document.activeElement)) restoreSelectionFocus()
}
