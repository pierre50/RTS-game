// Violet and its runtime shades come from scripts/retro_palette/duel.hex.
export const playerColors = ['violet', 'blue', 'red', 'yellow', 'brown', 'orange', 'green', 'teal'] as const

export const HEX_COLOR_MAP = {
  blue: '#1476c0',
  red: '#e30b00',
  yellow: '#c3a31b',
  brown: '#8b5b37',
  orange: '#e37840',
  green: '#4b6b2b',
  teal: '#008279',
  violet: '#7964ba',
  grey: '#8f8f8f',
  black: '#2d3136',
  cyan: '#008279',
}

export const PLAYER_COLORS = playerColors.map(name => ({ name, hex: HEX_COLOR_MAP[name] }))
