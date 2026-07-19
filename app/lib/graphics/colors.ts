import { Texture, type Filter } from 'pixi.js'
import { MultiColorReplaceFilter } from 'pixi-filters'

export const colors = ['blue', 'red', 'yellow', 'brown', 'orange', 'green', 'grey', 'cyan'] as const
type PlayerColor = (typeof colors)[number]

// These are NOT the `player_blue` values from scripts/lpc/config.py — the bake
// pipeline (scripts/lpc/build.py) recolors to player_blue and then snaps every
// pixel to the nearest of 64 fixed colors in scripts/retro_palette/aap-64.hex,
// which remaps player_blue's shades to a different set of hex values (e.g.
// #3C49AD and #466AC9 both collapse to #285CC4). These are that post-snap set,
// verified against the actual lpc-baked and buildings/shared textures.
const SOURCE_COLORS = [0xb3b9d1, 0x849be4, 0x8b93af, 0x588dbe, 0x6d758d, 0x285cc4, 0x4a5462, 0x143464, 0x242234]
const UNIT_SOURCE_COLORS = [0x849be4, 0x588dbe, 0x285cc4, 0x143464]

const COLOR_PALETTES: Partial<Record<PlayerColor, readonly number[]>> = {
  red: [0xff8f8f, 0xff5f5f, 0xff2f2f, 0xe30b00, 0xc71700, 0x8f1f00, 0x6f0b07, 0x530b00],
  yellow: [0xe3e300, 0xdfcf0f, 0xdfcf0f, 0xc3a31b, 0xa37317, 0x876727, 0x6b4b27, 0x4f3723],
  brown: [0xcfa343, 0xb78b2b, 0xa3734f, 0x8b5b37, 0x734727, 0x5f331b, 0x3f3723, 0x23231f],
  orange: [0xfb9f1f, 0xf78b17, 0xf3770f, 0xef6307, 0xcf4300, 0x9f3300, 0x872b00, 0x6f2300],
  green: [0x8b9f4f, 0x7f8b37, 0x637b2f, 0x4b6b2b, 0x375f27, 0x1b431b, 0x133313, 0x0b1b0b],
  grey: [0xdbdbdb, 0xc7c7c7, 0xb3b3b3, 0x8f8f8f, 0x6b6b6b, 0x474747, 0x373737, 0x232323],
  cyan: [0x5fd39f, 0x2bbf93, 0x00ab93, 0x00837b, 0x006f6b, 0x004f4f, 0x003f43, 0x002327],
}

const HEX_COLOR_MAP: Record<PlayerColor, string> = {
  blue: '#466ac9',
  red: '#e30b00',
  yellow: '#c3a31b',
  brown: '#8b5b37',
  orange: '#ef6307',
  green: '#4b6b2b',
  grey: '#8f8f8f',
  cyan: '#00837b',
}

export type RecolorableTexture = Texture & {
  frame: {
    x: number
    y: number
    width: number
    height: number
  }
  label?: string
  source: {
    label?: string
    resource?: CanvasImageSource
    uid?: string | number
  }
  textureCacheIds?: string[]
}

export type RecolorableSprite = {
  filters: readonly Filter[] | null
  texture: RecolorableTexture
}

const recoloredTextureCache = new Map<string, Texture>()
const colorFilterCache = new Map<PlayerColor, Filter>()
const replacementCache = new Map<string, [number, number][]>()

function isPlayerColor(color: string): color is PlayerColor {
  return colors.includes(color as PlayerColor)
}

function luminance(color: number): number {
  const r = (color >> 16) & 0xff
  const g = (color >> 8) & 0xff
  const b = color & 0xff
  return 0.299 * r + 0.587 * g + 0.114 * b
}

// SOURCE_COLORS and a given team palette aren't guaranteed to be the same length
// (SOURCE_COLORS has 9 real baked shades; palettes are hand-tuned 8-shade
// gradients), so pair them by luminance rank instead of by index — same bucketing
// approach as the non-source-palette branch of scripts/lpc/image_pipeline.py's
// recolor(). Multiple source shades can land in the same target bucket. Ranked
// light-to-dark to match COLOR_PALETTES' light-to-dark ordering.
function buildReplacements(sourceColors: readonly number[], targetColors: readonly number[]): [number, number][] {
  const rankedIndices = sourceColors.map((_, i) => i).sort((a, b) => luminance(sourceColors[b]) - luminance(sourceColors[a]))

  return rankedIndices.map((sourceIndex, rank) => {
    const targetIndex = Math.min(Math.floor((rank * targetColors.length) / sourceColors.length), targetColors.length - 1)
    return [sourceColors[sourceIndex], targetColors[targetIndex]]
  })
}

function getReplacements(
  color: PlayerColor,
  sourceColors: readonly number[],
  targetColors: readonly number[]
): [number, number][] {
  const cacheKey = `${color}_${sourceColors.join('-')}_${targetColors.join('-')}`
  if (!replacementCache.has(cacheKey)) {
    replacementCache.set(cacheKey, buildReplacements(sourceColors, targetColors))
  }
  return replacementCache.get(cacheKey)!
}

function getTextureColorKey(texture: RecolorableTexture): string {
  const frame = texture.frame
  // Frame names ("000.png") repeat across spritesheets, so the key must
  // include the source, not just the texture label.
  const source = texture.source?.label || texture.source?.uid || 'unknown-source'
  return [source, frame.x, frame.y, frame.width, frame.height].join('_')
}

function recolorTextureDirectly(
  texture: RecolorableTexture,
  color: PlayerColor,
  sourceColors: readonly number[] = SOURCE_COLORS
): Texture {
  if (color === 'blue') return texture

  const targetColors = COLOR_PALETTES[color]
  if (!targetColors) throw new Error('Invalid color selected.')

  const frame = texture.frame
  const cacheKey = `${getTextureColorKey(texture)}_${color}_${sourceColors.join('-')}`

  if (recoloredTextureCache.has(cacheKey)) {
    return recoloredTextureCache.get(cacheKey)!
  }

  const baseTexture = texture.source.resource
  const canvas = document.createElement('canvas')
  canvas.width = frame.width
  canvas.height = frame.height

  const ctx = canvas.getContext('2d')
  if (!baseTexture || !ctx) return texture

  ctx.drawImage(baseTexture, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height)

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  const sourceColorMap = new Map(getReplacements(color, sourceColors, targetColors))

  for (let i = 0; i < data.length; i += 4) {
    const rgb = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]
    const targetColor = sourceColorMap.get(rgb)
    if (targetColor !== undefined) {
      data[i] = (targetColor >> 16) & 0xff
      data[i + 1] = (targetColor >> 8) & 0xff
      data[i + 2] = targetColor & 0xff
    }
  }

  ctx.putImageData(imageData, 0, 0)

  const newTexture = Texture.from(canvas)
  recoloredTextureCache.set(cacheKey, newTexture)
  return newTexture
}

export function getHexColor(name: string): string {
  return isPlayerColor(name) ? HEX_COLOR_MAP[name] : '#ffffff'
}

export function changeSpriteColorDirectly(sprite: RecolorableSprite, color: string): void {
  if (color === 'blue') return
  if (!isPlayerColor(color)) throw new Error('Invalid color selected.')

  sprite.texture = recolorTextureDirectly(sprite.texture, color) as RecolorableTexture
}

export function changeSpriteTexturesColorDirectly<TTexture extends RecolorableTexture>(
  textures: readonly TTexture[],
  color: string
): Texture[] {
  if (color === 'blue') return [...textures]
  if (!isPlayerColor(color)) return [...textures]

  return textures.map(texture => recolorTextureDirectly(texture, color, UNIT_SOURCE_COLORS))
}

export function changeSpriteColor(sprite: RecolorableSprite, color: string): void {
  if (color === 'blue') {
    sprite.filters = null
    return
  }
  if (!isPlayerColor(color) || !COLOR_PALETTES[color]) return

  if (!colorFilterCache.has(color)) {
    const replacements = getReplacements(color, SOURCE_COLORS, COLOR_PALETTES[color]!)
    // Tolerance is a normalized RGB distance (0-1). 0.1 was catching near-black shades
    // from hair/shading palettes and tinting them with the team color. Since source
    // sprites are exact-palette pixel art with no color blending, a tight tolerance
    // still matches genuine blue pixels while excluding unrelated dark tones.
    colorFilterCache.set(color, new MultiColorReplaceFilter({ replacements, tolerance: 0.01 }))
  }

  sprite.filters = [colorFilterCache.get(color)!]
}
