import type { Texture } from 'pixi.js'
import type { Bounds } from '../../types/geometry'

const DEFAULT_ALPHA_THRESHOLD = 20

type PixelExtractOutput = {
  pixels: Uint8ClampedArray | Uint8Array
  width: number
  height: number
}

type TexturePixelExtractor = {
  extract?: {
    pixels?: (target: Texture) => PixelExtractOutput
  }
}

type AlphaMask = {
  pixels: Uint8Array
  width: number
  height: number
}

const alphaMaskCache = new WeakMap<Texture, AlphaMask | null>()

function createCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas | null {
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    return canvas
  }
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height)
  return null
}

function getCanvasAlphaMask(texture: Texture): AlphaMask | null {
  const resource = texture.source?.resource as CanvasImageSource | undefined
  const frame = texture.frame
  if (!resource || !frame || texture.rotate) return null

  const resolution = texture.source?.resolution ?? 1
  const sourceX = Math.round(frame.x * resolution)
  const sourceY = Math.round(frame.y * resolution)
  const width = Math.max(1, Math.round(frame.width * resolution))
  const height = Math.max(1, Math.round(frame.height * resolution))
  const canvas = createCanvas(width, height)
  const context = canvas?.getContext('2d', { willReadFrequently: true })
  if (!canvas || !context) return null

  context.clearRect(0, 0, width, height)
  context.drawImage(resource, sourceX, sourceY, width, height, 0, 0, width, height)
  const imageData = context.getImageData(0, 0, width, height)
  const mask = new Uint8Array(width * height)
  for (let sourceIndex = 3, maskIndex = 0; maskIndex < mask.length; sourceIndex += 4, maskIndex++) {
    mask[maskIndex] = imageData.data[sourceIndex] ?? 0
  }
  return { pixels: mask, width, height }
}

function getRendererAlphaMask(texture: Texture, renderer?: TexturePixelExtractor | null): AlphaMask | null {
  const extract = renderer?.extract
  if (typeof extract?.pixels !== 'function') return null

  const output = extract.pixels(texture)
  if (!output?.pixels || output.width <= 0 || output.height <= 0) return null

  const mask = new Uint8Array(output.width * output.height)
  for (let sourceIndex = 3, maskIndex = 0; maskIndex < mask.length; sourceIndex += 4, maskIndex++) {
    mask[maskIndex] = output.pixels[sourceIndex] ?? 0
  }

  return { pixels: mask, width: output.width, height: output.height }
}

function getAlphaMask(texture: Texture, renderer?: TexturePixelExtractor | null): AlphaMask | null {
  if (alphaMaskCache.has(texture)) return alphaMaskCache.get(texture) ?? null

  try {
    const alphaMask = getCanvasAlphaMask(texture) ?? getRendererAlphaMask(texture, renderer)
    alphaMaskCache.set(texture, alphaMask)
    return alphaMask
  } catch {
    alphaMaskCache.set(texture, null)
    return null
  }
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function getIntersection(a: Bounds, b: Bounds): Bounds | null {
  const minX = Math.max(a.minX, b.minX)
  const minY = Math.max(a.minY, b.minY)
  const maxX = Math.min(a.minX + a.width, b.minX + b.width)
  const maxY = Math.min(a.minY + a.height, b.minY + b.height)
  if (maxX <= minX || maxY <= minY) return null
  return { minX, minY, width: maxX - minX, height: maxY - minY }
}

function texturePixelAlpha(mask: AlphaMask, bounds: Bounds, worldX: number, worldY: number): number {
  const x = clampInt(Math.floor(((worldX - bounds.minX) / bounds.width) * mask.width), 0, mask.width - 1)
  const y = clampInt(Math.floor(((worldY - bounds.minY) / bounds.height) * mask.height), 0, mask.height - 1)
  return mask.pixels[y * mask.width + x] ?? 0
}

export function texturesHaveOpaqueOverlap(
  frontTexture: Texture,
  frontBounds: Bounds,
  backTexture: Texture,
  backBounds: Bounds,
  renderer?: TexturePixelExtractor | null,
  alphaThreshold = DEFAULT_ALPHA_THRESHOLD
): boolean {
  if (frontBounds.width <= 0 || frontBounds.height <= 0 || backBounds.width <= 0 || backBounds.height <= 0) return false

  const intersection = getIntersection(frontBounds, backBounds)
  if (!intersection) return false

  const frontMask = getAlphaMask(frontTexture, renderer)
  const backMask = getAlphaMask(backTexture, renderer)
  if (!frontMask || !backMask) return true

  const x0 = clampInt(Math.floor(((intersection.minX - frontBounds.minX) / frontBounds.width) * frontMask.width), 0, frontMask.width)
  const y0 = clampInt(Math.floor(((intersection.minY - frontBounds.minY) / frontBounds.height) * frontMask.height), 0, frontMask.height)
  const x1 = clampInt(
    Math.ceil(((intersection.minX + intersection.width - frontBounds.minX) / frontBounds.width) * frontMask.width),
    0,
    frontMask.width
  )
  const y1 = clampInt(
    Math.ceil(((intersection.minY + intersection.height - frontBounds.minY) / frontBounds.height) * frontMask.height),
    0,
    frontMask.height
  )

  for (let y = y0; y < y1; y++) {
    const rowOffset = y * frontMask.width
    for (let x = x0; x < x1; x++) {
      if (frontMask.pixels[rowOffset + x] <= alphaThreshold) continue
      const worldX = frontBounds.minX + ((x + 0.5) / frontMask.width) * frontBounds.width
      const worldY = frontBounds.minY + ((y + 0.5) / frontMask.height) * frontBounds.height
      if (texturePixelAlpha(backMask, backBounds, worldX, worldY) > alphaThreshold) return true
    }
  }

  return false
}
