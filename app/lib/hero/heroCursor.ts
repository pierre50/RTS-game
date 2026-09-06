import type { HeroEquippedItem } from './heroTools'

export type CursorState = 'default' | 'pointer' | 'resource' | 'combat' | 'bow' | 'lasso' | 'move' | 'enter'

const CURSOR_CLASSES: Partial<Record<CursorState, string>> = {
  pointer: 'hero-cursor-pointer',
  resource: 'hero-cursor-resource',
  combat: 'hero-cursor-combat',
  bow: 'hero-cursor-bow',
  lasso: 'hero-cursor-bow',
  move: 'hero-cursor-move',
  enter: 'hero-cursor-enter',
}

const GAME_CURSOR_CLASS = 'hero-game-cursor'
const CURSOR_HIDDEN_CLASS = 'hero-cursor-hidden'
const VIRTUAL_CURSOR_ID = 'hero-virtual-cursor'
const VIRTUAL_CURSOR_VISIBLE_CLASS = 'is-visible'
const ALL_CURSOR_CLASSES = Object.values(CURSOR_CLASSES).filter((value): value is string => Boolean(value))

let lastState: CursorState | null = null
let virtualCursorEl: HTMLDivElement | null = null

function resolveToolCursorState(tool: HeroEquippedItem | null): CursorState {
  if (tool === 'bow') return 'bow'
  if (tool === 'lasso') return 'lasso'
  return 'default'
}

function getVirtualCursorElement(): HTMLDivElement {
  if (virtualCursorEl) return virtualCursorEl
  const el = document.createElement('div')
  el.id = VIRTUAL_CURSOR_ID
  document.body.appendChild(el)
  virtualCursorEl = el
  return el
}

export function updateHeroCursor(
  tool: HeroEquippedItem | null,
  overrideState: CursorState | null = null
): void {
  const state = overrideState ?? resolveToolCursorState(tool)
  if (state === lastState) return
  const body = document.body
  for (const className of ALL_CURSOR_CLASSES) body.classList.remove(className)
  const className = CURSOR_CLASSES[state]
  if (className) body.classList.add(className)
  getVirtualCursorElement().className = [VIRTUAL_CURSOR_ID, className].filter(Boolean).join(' ')
  lastState = state
}

export function setHeroGameCursorEnabled(enabled: boolean): void {
  document.body.classList.toggle(GAME_CURSOR_CLASS, enabled)
  if (!enabled) {
    lastState = null
    setVirtualCursorVisible(false)
  }
}

/**
 * The real OS cursor can't be moved from a webpage, so gamepad aiming is shown with this
 * lookalike element instead (same pointer images as the CSS `cursor:` swap above) while the
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
  document.body.classList.remove(GAME_CURSOR_CLASS, CURSOR_HIDDEN_CLASS, ...ALL_CURSOR_CLASSES)
  virtualCursorEl?.classList.remove(VIRTUAL_CURSOR_VISIBLE_CLASS)
  lastState = null
}
