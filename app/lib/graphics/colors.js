import { Texture } from 'pixi.js'
import { MultiColorReplaceFilter } from 'pixi-filters'

export const colors = ['blue', 'red', 'yellow', 'brown', 'orange', 'green', 'grey', 'cyan']

const SOURCE_COLORS = [0x93bbd7, 0x739bc7, 0x577bb3, 0x3f5f9f, 0x273f8f, 0x17277b, 0x070f67, 0x000057]

const COLOR_PALETTES = {
  red: [0xff8f8f, 0xff5f5f, 0xff2f2f, 0xe30b00, 0xc71700, 0x8f1f00, 0x6f0b07, 0x530b00],
  yellow: [0xe3e300, 0xdfcf0f, 0xdfcf0f, 0xc3a31b, 0xa37317, 0x876727, 0x6b4b27, 0x4f3723],
  brown: [0xcfa343, 0xb78b2b, 0xa3734f, 0x8b5b37, 0x734727, 0x5f331b, 0x3f3723, 0x23231f],
  orange: [0xfb9f1f, 0xf78b17, 0xf3770f, 0xef6307, 0xcf4300, 0x9f3300, 0x872b00, 0x6f2300],
  green: [0x8b9f4f, 0x7f8b37, 0x637b2f, 0x4b6b2b, 0x375f27, 0x1b431b, 0x133313, 0x0b1b0b],
  grey: [0xdbdbdb, 0xc7c7c7, 0xb3b3b3, 0x8f8f8f, 0x6b6b6b, 0x474747, 0x373737, 0x232323],
  cyan: [0x5fd39f, 0x2bbf93, 0x00ab93, 0x00837b, 0x006f6b, 0x004f4f, 0x003f43, 0x002327],
}

const HEX_COLOR_MAP = {
  blue: '#3f5f9f',
  red: '#e30b00',
  yellow: '#c3a31b',
  brown: '#8b5b37',
  orange: '#ef6307',
  green: '#4b6b2b',
  grey: '#8f8f8f',
  cyan: '#00837b',
}

const recoloredTextureCache = new Map()
const colorFilterCache = new Map()

function getDirectColorTextureKey(sprite) {
  if (sprite._baseColorTextureKey) return sprite._baseColorTextureKey

  const { texture } = sprite
  const frame = texture.frame
  const textureKey =
    texture.label ||
    texture.textureCacheIds?.[0] ||
    texture.source?.label ||
    [texture.source?.uid ?? 'unknown-source', frame.x, frame.y, frame.width, frame.height].join('_')

  sprite._baseColorTextureKey = textureKey
  return textureKey
}

export function getHexColor(name) {
  return HEX_COLOR_MAP[name] || '#ffffff'
}

export function changeSpriteColorDirectly(sprite, color) {
  if (color === 'blue') return

  const targetColors = COLOR_PALETTES[color]
  if (!targetColors) throw new Error('Invalid color selected.')

  const frame = sprite.texture.frame
  const cacheKey = `${getDirectColorTextureKey(sprite)}_${color}`

  if (recoloredTextureCache.has(cacheKey)) {
    sprite.texture = recoloredTextureCache.get(cacheKey)
    return
  }

  const baseTexture = sprite.texture.source.resource
  const canvas = document.createElement('canvas')
  canvas.width = frame.width
  canvas.height = frame.height

  const ctx = canvas.getContext('2d')
  ctx.drawImage(baseTexture, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height)

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  const sourceColorMap = new Map(SOURCE_COLORS.map((src, i) => [src, targetColors[i]]))

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
  sprite.texture = newTexture
}

export function changeSpriteColor(sprite, color) {
  if (color === 'blue') return
  if (!COLOR_PALETTES[color]) return

  if (!colorFilterCache.has(color)) {
    const replacements = SOURCE_COLORS.map((src, i) => [src, COLOR_PALETTES[color][i]])
    colorFilterCache.set(color, new MultiColorReplaceFilter({ replacements, tolerance: 0.1 }))
  }

  sprite.filters = [colorFilterCache.get(color)]
}
