import { Assets, type Texture, type Application } from 'pixi.js'
import { getAnimationFrames } from '../entities/spriteFrameSelection'
import { dynamicEquipmentVisualKey } from '../lpc/equipment'
import { ALPHA_THRESHOLD, findOpaqueSquare } from './avatarCrop'
import type { SpritesheetLike } from '../../types/pixi'

const EQUIPMENT_LAYERS = ['back', 'front'] as const
const EQUIPMENT_SHEETS = ['walking', 'action'] as const
const EQUIPMENT_VARIANTS = ['', 'male', 'female'] as const
const MIN_EQUIPMENT_OPAQUE_PIXELS = 30
const equipmentAvatarCache = new Map<string, HTMLCanvasElement>()

function getEquipmentLayerTexture(equipment: string, layer: string, sheet: string): Texture | null {
  let sheetData: SpritesheetLike | undefined
  for (const variant of EQUIPMENT_VARIANTS) {
    const sheetId = `equipments/${equipment}/${layer}/${sheet}${variant ? `/${variant}` : ''}`
    sheetData = Assets.cache.has(sheetId) ? (Assets.cache.get(sheetId) as SpritesheetLike | undefined) : undefined
    if (sheetData?.textures) break
  }
  if (!sheetData?.textures) return null

  const frames = getAnimationFrames(sheetData.textures, 'south', 3, null) as Texture[]
  return frames[0] ?? null
}

function countOpaquePixels(pixels: Uint8ClampedArray): number {
  let count = 0
  for (let i = 3; i < pixels.length; i += 4) {
    if ((pixels[i] ?? 0) > ALPHA_THRESHOLD) count++
  }
  return count
}

function drawCachedEquipmentAvatar(source: HTMLCanvasElement, canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(source, 0, 0, source.width, source.height, 0, 0, canvas.width, canvas.height)
  return true
}

// Renders the weapon/tool an inventory slot equips into `canvas` — composites
// its back+front layers (both drawn at once; some equipment splits its shape
// across both, e.g. a halberd's shaft going behind the arm), then crops
// tightly to whatever's actually drawn.
export function renderEquipmentAvatar(app: Application, equipment: string, canvas: HTMLCanvasElement): boolean {
  const visualEquipment = dynamicEquipmentVisualKey(equipment)
  if (!visualEquipment) return false

  const cacheKey = `${equipment}:${canvas.width}x${canvas.height}`
  const cached = equipmentAvatarCache.get(cacheKey)
  if (cached) return drawCachedEquipmentAvatar(cached, canvas)

  for (const sheet of EQUIPMENT_SHEETS) {
    const layerTextures = EQUIPMENT_LAYERS.map(layer => getEquipmentLayerTexture(visualEquipment, layer, sheet)).filter(
      (texture): texture is Texture => Boolean(texture)
    )
    if (!layerTextures.length) continue

    const size = layerTextures[0]
    if (!size) continue
    const composed = document.createElement('canvas')
    composed.width = size.width
    composed.height = size.height
    const ctx = composed.getContext('2d', { willReadFrequently: true })
    if (!ctx) continue
    ctx.imageSmoothingEnabled = false
    for (const texture of layerTextures) {
      ctx.drawImage(app.renderer.extract.canvas(texture) as CanvasImageSource, 0, 0)
    }

    const imageData = ctx.getImageData(0, 0, composed.width, composed.height)
    if (countOpaquePixels(imageData.data) < MIN_EQUIPMENT_OPAQUE_PIXELS) continue

    const square = findOpaqueSquare(imageData.data, composed.width, composed.height)
    if (!square) continue
    square.width = Math.min(square.width, composed.width, composed.height)
    square.height = square.width
    square.x = Math.max(0, Math.min(square.x, composed.width - square.width))
    square.y = Math.max(0, Math.min(square.y, composed.height - square.height))

    const outCtx = canvas.getContext('2d')
    if (!outCtx) return false
    outCtx.imageSmoothingEnabled = false
    outCtx.clearRect(0, 0, canvas.width, canvas.height)
    outCtx.drawImage(composed, square.x, square.y, square.width, square.height, 0, 0, canvas.width, canvas.height)
    const cachedCanvas = document.createElement('canvas')
    cachedCanvas.width = canvas.width
    cachedCanvas.height = canvas.height
    const cachedCtx = cachedCanvas.getContext('2d')
    if (cachedCtx) {
      cachedCtx.imageSmoothingEnabled = false
      cachedCtx.drawImage(canvas, 0, 0)
      equipmentAvatarCache.set(cacheKey, cachedCanvas)
    }
    return true
  }
  return false
}
