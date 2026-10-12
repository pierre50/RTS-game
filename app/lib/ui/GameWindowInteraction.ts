import type { Command } from './GameWindowCommands'

/** Content such as maps can own navigation while sharing the window's action bar. */
export type GameWindowInteraction = {
  commands(): Command[]
  move(dx: number, dy: number): void
  gamepad(pad: Gamepad, elapsed: number): void
}
const interactions = new WeakMap<HTMLElement, GameWindowInteraction>()

export function registerWindowInteraction(element: HTMLElement, interaction: GameWindowInteraction): void {
  element.dataset.windowInteraction = ''
  interactions.set(element, interaction)
}

export function getWindowInteraction(panel: HTMLElement): GameWindowInteraction | undefined {
  if (!panel) return undefined
  const elements = panel.querySelectorAll<HTMLElement>('[data-window-interaction]')
  for (const element of elements) {
    if (interactions.has(element) && !element.closest('[hidden], .hidden')) return interactions.get(element)
  }
  return undefined
}
