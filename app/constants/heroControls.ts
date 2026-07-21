export const HERO_MOVE_KEYS = ['z', 'q', 's', 'd'] as const
export const HERO_ACTION_KEYS = ['e', 'i'] as const
export const HERO_RESERVED_HOTKEYS = [...HERO_MOVE_KEYS, ...HERO_ACTION_KEYS]

export const HERO_KEYS = new Set<string>(HERO_MOVE_KEYS)

export const HERO_DIRECTIONS: Record<string, { dx: number; dy: number }> = {
  z: { dx: 0, dy: -1 },
  q: { dx: -1, dy: 0 },
  s: { dx: 0, dy: 1 },
  d: { dx: 1, dy: 0 },
}

export const HERO_ACTION_MOVE_SPEED_FACTOR = 0.2
