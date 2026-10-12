import type { Command } from './GameWindowCommands'
import { getWindowTabScope, isWindowTabInScope } from './GameWindowElements'

const TAB_COMMANDS = new Set(['previous-tab', 'next-tab'])

export function isTabNavigationCommand(command: Command): boolean {
  return TAB_COMMANDS.has(command.id)
}

/** Display shortcuts beside the tab strip they control, without adding navigation stops. */
export function renderWindowTabHints(
  panel: HTMLElement,
  selected: HTMLElement | null,
  commands: Command[],
  mode: 'keyboard' | 'gamepad'
): void {
  const scope = getWindowTabScope(selected, panel)
  const tabs = [...scope.querySelectorAll<HTMLElement>('.ui-tab')].filter(
    tab =>
      !tab.matches(':disabled') &&
      !tab.closest('[hidden], .hidden, [aria-hidden="true"]') &&
      tab.getClientRects().length > 0 &&
      isWindowTabInScope(tab, scope, panel)
  )
  const strip = tabs.length > 1 ? tabs[0].closest('.ui-tabs') : null
  const shortcuts = commands.filter(isTabNavigationCommand)
  for (const hint of panel.querySelectorAll<HTMLElement>('.game-window-tab-hint')) {
    if (hint.parentElement !== strip || !shortcuts.some(command => command.id === hint.dataset.tabCommand)) {
      hint.remove()
    }
  }
  if (!strip) return
  for (const command of shortcuts) {
    let hint = strip.querySelector<HTMLElement>(`[data-tab-command="${command.id}"]`)
    if (!hint) {
      hint = document.createElement('kbd')
      hint.className = 'game-window-tab-hint'
      hint.dataset.tabCommand = command.id
      if (command.id === 'previous-tab') strip.prepend(hint)
      else strip.appendChild(hint)
    }
    const label = mode === 'gamepad' ? command.glyph : command.key === 'PageUp' ? 'Pg ↑' : 'Pg ↓'
    if (hint.textContent !== label) hint.textContent = label
    if (hint.title !== command.label) {
      hint.title = command.label
      hint.setAttribute('aria-label', `${command.label} : ${label}`)
    } else if (hint.getAttribute('aria-label') !== `${command.label} : ${label}`) {
      hint.setAttribute('aria-label', `${command.label} : ${label}`)
    }
  }
}
