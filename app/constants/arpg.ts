export const ARPG_MOVE_KEYS = ['z', 'q', 's', 'd'] as const
export const ARPG_ACTION_KEYS = ['e', 'i'] as const
export const ARPG_RESERVED_HOTKEYS = [...ARPG_MOVE_KEYS, ...ARPG_ACTION_KEYS]

export const ARPG_KEYS = new Set<string>(ARPG_MOVE_KEYS)

export const ARPG_DIRECTIONS: Record<string, { dx: number; dy: number }> = {
  z: { dx: 0, dy: -1 },
  q: { dx: -1, dy: 0 },
  s: { dx: 0, dy: 1 },
  d: { dx: 1, dy: 0 },
}

export const HERO_ACTION_MOVE_SPEED_FACTOR = 0.2
