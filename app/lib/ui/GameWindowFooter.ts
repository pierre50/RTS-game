import { t } from '../lang'
import type { Command } from './GameWindowCommands'
type FooterOptions = {
  footer: HTMLElement
  mode: 'keyboard' | 'gamepad'
  confirmation: Command | null
  commands: Command[]
  restoreSelectionFocus: () => void
  execute: (command: Command) => void
  resolveCommand: (command: Command) => Command | undefined
}
export function renderCommandFooter({
  footer,
  mode,
  confirmation,
  commands,
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
    if (confirmation.description) {
      const description = document.createElement('span')
      description.className = 'game-window-action-reason'
      description.textContent = confirmation.description
      footer.appendChild(description)
    }
  }
  for (const command of commands) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'game-window-command'
    button.dataset.command = command.id
    button.disabled = command.disabled ?? false
    if (command.description) button.title = command.description
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
    label.textContent = `${command.label}${command.hold ? ` · ${t('windowHold')}` : ''}`
    button.append(key, label)
    button.addEventListener('click', () => {
      // Resolve fresh handlers: live refreshes may have replaced the source button.
      const current = resolveCommand(command)
      if (current) execute(current)
    })
    footer.appendChild(button)
    if (command.disabled && command.description && ['sleep', 'home'].includes(command.id)) {
      const reason = document.createElement('span')
      reason.className = 'game-window-action-reason'
      reason.textContent = command.description
      footer.appendChild(reason)
    }
    if (focusedCommand === command.id) button.focus({ preventScroll: true })
  }
  if (confirmation) footer.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
  else if (focusedCommand && !footer.contains(document.activeElement)) restoreSelectionFocus()
}
