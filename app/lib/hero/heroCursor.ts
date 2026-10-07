const GAME_CURSOR_CLASS = 'hero-game-cursor'
const CURSOR_HIDDEN_CLASS = 'hero-cursor-hidden'
const VIRTUAL_CURSOR_ID = 'hero-virtual-cursor'
const VIRTUAL_CURSOR_VISIBLE_CLASS = 'is-visible'

let virtualCursorEl: HTMLDivElement | null = null

function getVirtualCursorElement(): HTMLDivElement {
  if (virtualCursorEl) return virtualCursorEl
  const el = document.createElement('div')
  el.id = VIRTUAL_CURSOR_ID
  document.body.appendChild(el)
  virtualCursorEl = el
  return el
}

export function setHeroGameCursorEnabled(enabled: boolean): void {
  document.body.classList.toggle(GAME_CURSOR_CLASS, enabled)
  if (!enabled) {
    setVirtualCursorVisible(false)
  }
}

/**
 * The real OS cursor can't be moved from a webpage, so gamepad aiming is shown with this
 * lookalike element instead (same fixed pointer image as the native mouse) while the
 * actual OS cursor is hidden. Any real mouse activity should call this with `false` again.
 */
export function setVirtualCursorVisible(visible: boolean): void {
  getVirtualCursorElement().classList.toggle(VIRTUAL_CURSOR_VISIBLE_CLASS, visible)
  document.body.classList.toggle(CURSOR_HIDDEN_CLASS, visible)
}

export function setVirtualCursorPosition(x: number, y: number): void {
  const el = getVirtualCursorElement()
  el.style.left = `${x}px`
  el.style.top = `${y}px`
}

export function resetHeroCursor(): void {
  document.body.classList.remove(GAME_CURSOR_CLASS, CURSOR_HIDDEN_CLASS)
  virtualCursorEl?.classList.remove(VIRTUAL_CURSOR_VISIBLE_CLASS)
}
