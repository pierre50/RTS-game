import { Rectangle, Texture, type Application } from 'pixi.js'
import { recolorCanvasPixels } from './colors'

const BBOX_PADDING_RATIO = 0.12
export const ALPHA_THRESHOLD = 16

// Finds the tight square around the actual opaque pixels (hair/face, or a
// whole building), so the crop isn't stuck with the source's empty margins.
export function findOpaqueSquare(pixels: Uint8ClampedArray, width: number, height: number): Rectangle | null {
  let minX = width
  let maxX = -1
  let minY = height
  let maxY = -1

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((pixels[(y * width + x) * 4 + 3] ?? 0) > ALPHA_THRESHOLD) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < minX || maxY < minY) return null

  const boxWidth = maxX - minX + 1
  const boxHeight = maxY - minY + 1
  const centerX = minX + boxWidth / 2
  const centerY = minY + boxHeight / 2
  const side = Math.max(boxWidth, boxHeight) * (1 + BBOX_PADDING_RATIO * 2)

  return new Rectangle(
    Math.round(centerX - side / 2),
    Math.round(centerY - side / 2),
    Math.round(side),
    Math.round(side)
  )
}

// `extract.canvas`/`extract.pixels` ignore the `frame` option when the
// target is a Texture (only Containers get clipped) — so cropping a
// sub-region means building a real sub-Texture sharing the same source.
function extractSubTexture<T>(texture: Texture, frame: Rectangle, extract: (region: Texture) => T): T {
  const region = new Texture({ source: texture.source, frame })
  try {
    return extract(region)
  } finally {
    region.destroy(false)
  }
}

// Crops `texture` to a tight square around its opaque content within
// `scanRect` (an absolute rect in the texture's atlas), draws it scaled to
// fill `canvas`, and repaints it from the neutral "blue" template to the
// player's color. Shared by unit and building portraits — only what counts
// as "the subject" (a head vs. a whole building) differs between callers.
export function extractSquareAvatar(
  app: Application,
  texture: Texture,
  scanRect: Rectangle,
  canvas: HTMLCanvasElement,
  color: string,
  sourceColors: readonly number[]
): boolean {
  const { pixels, width, height } = extractSubTexture(texture, scanRect, region => app.renderer.extract.pixels(region))

  const square = findOpaqueSquare(pixels, width, height) ?? new Rectangle(0, 0, scanRect.width, scanRect.height)
  // Clamp to the source texture so the extraction never samples outside it.
  square.width = Math.min(square.width, texture.width, texture.height)
  square.height = square.width
  square.x = Math.max(0, Math.min(square.x, texture.width - square.width))
  square.y = Math.max(0, Math.min(square.y, texture.height - square.height))

  const extracted = extractSubTexture(
    texture,
    new Rectangle(texture.frame.x + square.x, texture.frame.y + square.y, square.width, square.height),
    region => app.renderer.extract.canvas(region)
  )

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return false
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(extracted as CanvasImageSource, 0, 0, square.width, square.height, 0, 0, canvas.width, canvas.height)

  // The source art ships in the neutral "blue" template convention — real
  // team color is repainted at runtime elsewhere (see applyOwnerColorToSprite /
  // changeSpriteColorDirectly). Recoloring the already-drawn canvas (plain
  // Canvas2D) rather than the Pixi texture avoids extract() reading back a
  // texture that was never uploaded through a real render pass.
  recolorCanvasPixels(canvas, color, sourceColors)
  return true
}

export function extractSquareCanvasAvatar(
  source: HTMLCanvasElement,
  scanHeight: number,
  canvas: HTMLCanvasElement,
  color: string,
  sourceColors: readonly number[]
): boolean {
  const sourceCtx = source.getContext('2d', { willReadFrequently: true })
  if (!sourceCtx) return false

  const scanWidth = source.width
  const clampedScanHeight = Math.max(1, Math.min(source.height, scanHeight))
  const imageData = sourceCtx.getImageData(0, 0, scanWidth, clampedScanHeight)
  const square =
    findOpaqueSquare(imageData.data, scanWidth, clampedScanHeight) ?? new Rectangle(0, 0, scanWidth, clampedScanHeight)
  square.width = Math.min(square.width, source.width, source.height)
  square.height = square.width
  square.x = Math.max(0, Math.min(square.x, source.width - square.width))
  square.y = Math.max(0, Math.min(square.y, source.height - square.height))

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return false
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(source, square.x, square.y, square.width, square.height, 0, 0, canvas.width, canvas.height)
  recolorCanvasPixels(canvas, color, sourceColors)
  return true
}
