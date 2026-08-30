export const PLAYER_COLORS = [
  { name: 'violet', hex: '#3d5083' },
  { name: 'red', hex: '#e30b00' },
  { name: 'yellow', hex: '#c3a31b' },
  { name: 'brown', hex: '#8b5b37' },
  { name: 'orange', hex: '#e37840' },
  { name: 'green', hex: '#4b6b2b' },
  { name: 'teal', hex: '#008279' },
]

const LEGACY_PLAYER_COLOR_ALIASES: Record<string, string> = {
  blue: PLAYER_COLORS[0].name,
  cyan: 'teal',
  grey: PLAYER_COLORS[0].name,
}

export function normalizePlayerColor(color?: string): string {
  if (!color) return PLAYER_COLORS[0].name
  return LEGACY_PLAYER_COLOR_ALIASES[color] ?? color
}

export function isKnownPlayerColor(color: string): boolean {
  return PLAYER_COLORS.some(playerColor => playerColor.name === color)
}

export function nextPlayerColor(currentColor: string): string {
  const idx = PLAYER_COLORS.findIndex(color => color.name === currentColor)
  return PLAYER_COLORS[((idx >= 0 ? idx : 0) + 1) % PLAYER_COLORS.length].name
}

export function firstAvailablePlayerColor(used: Set<string>): string {
  return PLAYER_COLORS.find(color => !used.has(color.name))?.name ?? PLAYER_COLORS[0].name
}

export function nextAvailablePlayerColor(currentColor: string, used: Set<string>): string {
  const idx = PLAYER_COLORS.findIndex(color => color.name === currentColor)
  for (let offset = 1; offset < PLAYER_COLORS.length; offset++) {
    const candidate = PLAYER_COLORS[(idx + offset) % PLAYER_COLORS.length]
    if (!used.has(candidate.name)) return candidate.name
  }
  return currentColor
}
