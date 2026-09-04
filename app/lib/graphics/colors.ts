import { Texture, type Filter } from 'pixi.js'
import { MultiColorReplaceFilter } from 'pixi-filters'
import { LPC_RUNTIME_PALETTES, LPC_RUNTIME_SOURCE_PALETTES } from '../lpc/generatedPalettes'

const colors = ['blue', 'red', 'yellow', 'brown', 'orange', 'green', 'teal', 'violet', 'grey', 'cyan'] as const
export const playerColors = ['violet', 'red', 'yellow', 'brown', 'orange', 'green', 'teal'] as const
type PlayerColor = (typeof colors)[number]

// These are NOT the `player_blue` values from scripts/lpc/config.py — the bake
// pipeline (scripts/lpc/build.py) recolors to player_blue and then snaps every
// pixel to the nearest of 64 fixed colors in scripts/retro_palette/aap-64.hex,
// which remaps player_blue's shades to a different set of hex values (e.g.
// #3C49AD and #466AC9 both collapse to #285CC4). These are that post-snap set,
// verified against the actual units and buildings/age-0 textures.
export const SOURCE_COLORS = [0x6dccff, 0x55b1f1, 0x4097ea, 0x105da2, 0x1476c0, 0x07487c, 0x03315f, 0x001b40]

const COLOR_PALETTES: Partial<Record<PlayerColor, readonly number[]>> = {
  red: [0xff7676, 0xe45c5f, 0xb63c35, 0x9c3327, 0x82211d, 0x721c03, 0x5e0711, 0x662b29],

  yellow: [0xffe949, 0xffcf05, 0xd1aa39, 0xba882e, 0x9e6520, 0x854f12, 0x753b09, 0x622a00],

  brown: [0xe8cb82, 0xcca96e, 0xb29062, 0x997951, 0x7e6144, 0x614a3c, 0x453125, 0x372423],

  orange: [0xffe949, 0xffbc4e, 0xf99b4e, 0xe37840, 0xcd5e46, 0xb64d46, 0x94363a, 0x662b29],

  green: [0xa6cc34, 0x7da42d, 0x518822, 0x2f690c, 0x225918, 0x174a1b, 0x003221, 0x002219],

  grey: [0xebf0f6, 0xbac7db, 0xabaebe, 0x848795, 0x73737f, 0x5b5c69, 0x48474d, 0x2d3136],

  teal: [0x00deda, 0x00bfa3, 0x00a087, 0x008279, 0x006b6d, 0x005162, 0x004051, 0x002e49],

  violet: [0x8393c3, 0x6c82c4, 0x5274c5, 0x5165ae, 0x3d5083, 0x2d3d72, 0x28335d, 0x262450],

  cyan: [0x00deda, 0x00bfa3, 0x00a087, 0x008279, 0x006b6d, 0x005162, 0x004051, 0x002e49],
}

const NAMED_SOURCE_PALETTES: Record<string, readonly number[]> = LPC_RUNTIME_SOURCE_PALETTES
const NAMED_TARGET_PALETTES: Record<string, readonly number[]> = LPC_RUNTIME_PALETTES

const HEX_COLOR_MAP: Record<PlayerColor, string> = {
  blue: '#466ac9',
  red: '#e30b00',
  yellow: '#c3a31b',
  brown: '#8b5b37',
  orange: '#e37840',
  green: '#4b6b2b',
  teal: '#008279',
  violet: '#3d5083',
  grey: '#8f8f8f',
  cyan: '#008279',
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
const paletteFilterCache = new Map<string, Filter>()
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

// Source palettes and a given team palette aren't guaranteed to be the same length,
// so pair them by luminance rank instead of by index — same bucketing
// approach as the non-source-palette branch of scripts/lpc/image_pipeline.py's
// recolor(). Multiple source shades can land in the same target bucket. Ranked
// light-to-dark to match COLOR_PALETTES' light-to-dark ordering.
function buildReplacements(sourceColors: readonly number[], targetColors: readonly number[]): [number, number][] {
  const rankedIndices = sourceColors
    .map((_, i) => i)
    .sort((a, b) => luminance(sourceColors[b]) - luminance(sourceColors[a]))

  return rankedIndices.map((sourceIndex, rank) => {
    const targetIndex =
      sourceColors.length <= 1
        ? 0
        : Math.min(Math.round((rank * (targetColors.length - 1)) / (sourceColors.length - 1)), targetColors.length - 1)
    return [sourceColors[sourceIndex], targetColors[targetIndex]]
  })
}

function getReplacements(
  color: string,
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

function normalizeColorMapKey(colorMap: readonly [number, number][]): string {
  return colorMap.map(([source, target]) => `${source.toString(16)}-${target.toString(16)}`).join('_')
}

function applyColorMapToCanvas(canvas: HTMLCanvasElement, colorMap: readonly [number, number][]): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  const replacements = new Map(colorMap)

  for (let i = 0; i < data.length; i += 4) {
    const rgb = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]
    const targetColor = replacements.get(rgb)
    if (targetColor === undefined) continue
    data[i] = (targetColor >> 16) & 0xff
    data[i + 1] = (targetColor >> 8) & 0xff
    data[i + 2] = targetColor & 0xff
  }

  ctx.putImageData(imageData, 0, 0)
}

// Remaps `canvas`'s pixels from the neutral "blue" template to the given
// player color, in place. Pure Canvas2D — no Texture/GPU involved, so it's
// safe to use right after drawing into a canvas that was never rendered
// through Pixi (e.g. an extract() readback), unlike recolorTextureDirectly's
// Texture.from(canvas) output, which needs a real render pass before another
// extract() can read it back.
export function recolorCanvasPixels(
  canvas: HTMLCanvasElement,
  color: string,
  sourceColors: readonly number[] = SOURCE_COLORS
): void {
  if (!isPlayerColor(color) || color === 'blue') return
  const targetColors = COLOR_PALETTES[color]
  if (!targetColors) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

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
}

export function recolorCanvasByPalette(canvas: HTMLCanvasElement, sourcePalette: string, targetPalette: string): void {
  if (sourcePalette === targetPalette) return
  const sourceColors = NAMED_SOURCE_PALETTES[sourcePalette] ?? NAMED_TARGET_PALETTES[sourcePalette]
  const targetColors = NAMED_TARGET_PALETTES[targetPalette]
  if (!sourceColors || !targetColors) return
  applyColorMapToCanvas(canvas, getReplacements(targetPalette, sourceColors, targetColors))
}

function createRecoloredTexture(
  texture: RecolorableTexture,
  cacheKey: string,
  recolorCanvas: (canvas: HTMLCanvasElement) => void
): Texture {
  if (recoloredTextureCache.has(cacheKey)) return recoloredTextureCache.get(cacheKey)!

  const frame = texture.frame
  const baseTexture = texture.source.resource
  const canvas = document.createElement('canvas')
  canvas.width = frame.width
  canvas.height = frame.height

  const ctx = canvas.getContext('2d')
  if (!baseTexture || !ctx) return texture

  ctx.drawImage(baseTexture, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height)
  recolorCanvas(canvas)

  const newTexture = Texture.from(canvas)
  ;(newTexture as Texture & { defaultAnchor?: unknown }).defaultAnchor = (
    texture as Texture & { defaultAnchor?: unknown }
  ).defaultAnchor
  ;(newTexture as Texture & { hitArea?: unknown }).hitArea = (texture as Texture & { hitArea?: unknown }).hitArea
  recoloredTextureCache.set(cacheKey, newTexture)
  return newTexture
}

function recolorTextureDirectly(
  texture: RecolorableTexture,
  color: PlayerColor,
  sourceColors: readonly number[] = SOURCE_COLORS
): Texture {
  if (color === 'blue') return texture

  if (!COLOR_PALETTES[color]) throw new Error('Invalid color selected.')

  const cacheKey = `${getTextureColorKey(texture)}_${color}_${sourceColors.join('-')}`
  return createRecoloredTexture(texture, cacheKey, canvas => recolorCanvasPixels(canvas, color, sourceColors))
}

export function recolorTextureByMap<TTexture extends RecolorableTexture>(
  texture: TTexture,
  colorMap: readonly [number, number][],
  cacheNamespace: string
): Texture {
  if (!colorMap.length) return texture

  const cacheKey = `${cacheNamespace}_${getTextureColorKey(texture)}_${normalizeColorMapKey(colorMap)}`
  return createRecoloredTexture(texture, cacheKey, canvas => applyColorMapToCanvas(canvas, colorMap))
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

  return textures.map(texture => recolorTextureDirectly(texture, color, SOURCE_COLORS))
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

export function changeSpritePalette(sprite: RecolorableSprite, sourcePalette: string, targetPalette: string): void {
  if (sourcePalette === targetPalette) {
    sprite.filters = null
    return
  }
  const sourceColors = NAMED_SOURCE_PALETTES[sourcePalette] ?? NAMED_TARGET_PALETTES[sourcePalette]
  const targetColors = NAMED_TARGET_PALETTES[targetPalette]
  if (!sourceColors || !targetColors) return

  const cacheKey = `${sourcePalette}:${targetPalette}`
  if (!paletteFilterCache.has(cacheKey)) {
    const replacements = getReplacements(targetPalette, sourceColors, targetColors)
    paletteFilterCache.set(cacheKey, new MultiColorReplaceFilter({ replacements, tolerance: 0.01 }))
  }

  sprite.filters = [paletteFilterCache.get(cacheKey)!]
}
