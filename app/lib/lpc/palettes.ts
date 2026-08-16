export const LPC_PALETTES: Record<string, string[]> = {
  fair: ['#2A1817', '#4A2C26', '#765044', '#A87962', '#D2A081', '#EDC0A0'],
  olive: ['#271920', '#442725', '#7F4C31', '#AE6B3F', '#D38B59', '#E4A47C'],
  tan: ['#2D1712', '#553020', '#875334', '#B57545', '#D89459', '#EDB06F'],
  brown: ['#23110E', '#432015', '#6F3A22', '#98562F', '#BC7543', '#D99559'],
  deep_brown: ['#060608', '#141013', '#221C1A', '#322B28', '#423934', '#5A4E44'],
  golden: ['#3B1725', '#71413B', '#BB7547', '#DBA463', '#F4D29C', '#FEF3C0'],
  black: ['#020202', '#050505', '#0A0A0A', '#121212', '#1B1B1B', '#242424'],
  dark_brown: ['#060403', '#19110B', '#2E2014', '#46301C', '#624326', '#7D5732'],
  brown_hair: ['#080302', '#1B0B04', '#36190A', '#5A2D13', '#7C431F', '#A45D2E'],
  navy: ['#180716', '#20102B', '#281E41', '#322D6A', '#3C49AD', '#466AC9'],
  shadow: ['#1a1213', '#2e1f1c', '#442725', '#603429', '#7f4c31', '#ae6b3f'],
}

export const LPC_SKIN_TONES = ['fair', 'olive', 'brown', 'deep_brown', 'golden'] as const
export type LpcSkinTone = (typeof LPC_SKIN_TONES)[number]

export const PLAYER_COLOR_TO_LPC_VARIANT: Record<string, string> = {
  blue: 'blue',
  red: 'red',
  yellow: 'yellow',
  brown: 'brown',
  orange: 'orange',
  green: 'green',
  grey: 'gray',
  cyan: 'teal',
}

export function paletteByName(name: string): string[] {
  return LPC_PALETTES[name] ?? LPC_PALETTES.olive
}
