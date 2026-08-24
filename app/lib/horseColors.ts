import type { Texture } from 'pixi.js'
import { recolorTextureByMap, type RecolorableTexture } from './graphics/colors'

const HORSE_SOURCE_COLORS = [0xad6e51, 0x9a624c, 0x885041, 0x733d3b, 0x583126] as const

export const HORSE_COLOR_PALETTES = {
  brown: HORSE_SOURCE_COLORS,
  dark: [0x848795, 0x73737f, 0x5b5c69, 0x48474d, 0x2d3136],
  light: [0xfff3d6, 0xeadbc9, 0xccc3b1, 0xaea189, 0x857565],
  chestnut: [0xe59a7c, 0xd28d7a, 0xc17e7a, 0x98595a, 0x633432],
  bay: [0xd79374, 0xa96d58, 0x945d4f, 0x784c49, 0x372423],
  gold: [0xfedfb1, 0xcfaf8e, 0xb39783, 0x917a7b, 0x75686e],
} as const

export type HorseColor = keyof typeof HORSE_COLOR_PALETTES

const HORSE_COLOR_NAMES = Object.keys(HORSE_COLOR_PALETTES) as HorseColor[]

const HORSE_COLOR_REPLACEMENTS = Object.fromEntries(
  HORSE_COLOR_NAMES.map(color => [
    color,
    HORSE_SOURCE_COLORS.map((source, index) => [source, HORSE_COLOR_PALETTES[color][index]]) as [number, number][],
  ])
) as Record<HorseColor, [number, number][]>

export function isHorseColor(value: unknown): value is HorseColor {
  return typeof value === 'string' && Object.hasOwn(HORSE_COLOR_PALETTES, value)
}

export function getHorseColorFromSeed(seed: string | number | null | undefined): HorseColor {
  const text = String(seed ?? '')
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0
  }
  return HORSE_COLOR_NAMES[hash % HORSE_COLOR_NAMES.length] ?? 'brown'
}

export function recolorHorseTextures(textures: readonly Texture[], color: HorseColor | null | undefined): Texture[] {
  if (!color || color === 'brown') return [...textures]
  const replacements = HORSE_COLOR_REPLACEMENTS[color]
  if (!replacements) return [...textures]
  return textures.map(texture => recolorTextureByMap(texture as RecolorableTexture, replacements, `horse-${color}`))
}
