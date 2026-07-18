import { FAMILY_TYPES } from '../constants'
import type { HeroTool } from './heroTools'
import type { RuntimeEntity } from '../types/entities'

type CursorState = 'default' | 'pointer' | 'resource' | 'combat' | 'bow' | 'move'

const CURSOR_CLASSES: Partial<Record<CursorState, string>> = {
  pointer: 'arpg-cursor-pointer',
  resource: 'arpg-cursor-resource',
  combat: 'arpg-cursor-combat',
  bow: 'arpg-cursor-bow',
  move: 'arpg-cursor-move',
}

const GAME_CURSOR_CLASS = 'arpg-game-cursor'
const ALL_CURSOR_CLASSES = Object.values(CURSOR_CLASSES).filter((value): value is string => Boolean(value))

let lastState: CursorState | null = null

function resolveCursorState(tool: HeroTool | null, hoverTarget: RuntimeEntity | null, isPicking: boolean): CursorState {
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

// Hover feedback is reserved for "Aller vers" target picking. Regular ARPG play keeps the
// base in-game cursor so simply passing over entities does not look like a communication order.
export function updateHeroCursor(tool: HeroTool | null, hoverTarget: RuntimeEntity | null, isPicking = false): void {
  const state = resolveCursorState(tool, hoverTarget, isPicking)
  if (state === lastState) return
  const body = document.body
  for (const className of ALL_CURSOR_CLASSES) body.classList.remove(className)
  const className = CURSOR_CLASSES[state]
  if (className) body.classList.add(className)
  lastState = state
}

export function setHeroGameCursorEnabled(enabled: boolean): void {
  document.body.classList.toggle(GAME_CURSOR_CLASS, enabled)
  if (!enabled) lastState = null
}

export function resetHeroCursor(): void {
  document.body.classList.remove(GAME_CURSOR_CLASS, ...ALL_CURSOR_CLASSES)
  lastState = null
}
