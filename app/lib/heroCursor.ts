import { FAMILY_TYPES } from '../constants'
import type { HeroEquippedItem } from './heroTools'
import type { RuntimeEntity } from '../types/entities'

type CursorState = 'default' | 'pointer' | 'resource' | 'combat' | 'bow' | 'move'

const CURSOR_CLASSES: Partial<Record<CursorState, string>> = {
  pointer: 'hero-cursor-pointer',
  resource: 'hero-cursor-resource',
  combat: 'hero-cursor-combat',
  bow: 'hero-cursor-bow',
  move: 'hero-cursor-move',
}

const GAME_CURSOR_CLASS = 'hero-game-cursor'
const CURSOR_HIDDEN_CLASS = 'hero-cursor-hidden'
const VIRTUAL_CURSOR_ID = 'hero-virtual-cursor'
const VIRTUAL_CURSOR_VISIBLE_CLASS = 'is-visible'
const ALL_CURSOR_CLASSES = Object.values(CURSOR_CLASSES).filter((value): value is string => Boolean(value))

let lastState: CursorState | null = null
let virtualCursorEl: HTMLDivElement | null = null

function resolveCursorState(
  tool: HeroEquippedItem | null,
  hoverTarget: RuntimeEntity | null,
  isPicking: boolean
): CursorState {
  if (isPicking) {
    // "Go to" targeting: a resource still shows the gather hand (that's what will happen),
    // buildings share that hand feedback, combat targets show the attack cursor, anything else
    // shows the communication pointer.
    if (hoverTarget?.family === FAMILY_TYPES.resource || hoverTarget?.family === FAMILY_TYPES.building) {
      return 'resource'
    }
    if (hoverTarget?.family === FAMILY_TYPES.animal || hoverTarget?.family === FAMILY_TYPES.unit) return 'combat'
    return 'pointer'
  }
  if (tool === 'bow') return 'bow'
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

// Hover feedback is reserved for "Aller vers" target picking. Regular hero play keeps the
// base in-game cursor so simply passing over entities does not look like a communication order.
export function updateHeroCursor(tool: HeroEquippedItem | null, hoverTarget: RuntimeEntity | null, isPicking = false): void {
  const state = resolveCursorState(tool, hoverTarget, isPicking)
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
