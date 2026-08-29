import type { Bounds } from '../../types/geometry'

const TERRAIN_BAKE_CHUNK_OVERLAP = 2

type AxisRect = {
  min: number
  max: number
}

function normalizeTextureLimit(maxTextureSize: number): number {
  const limit = Math.floor(maxTextureSize)
  return Number.isFinite(limit) && limit > 0 ? limit : 1
}

function getAxisChunkRects(min: number, length: number, maxTextureSize: number, overlap: number): AxisRect[] {
  const start = Math.floor(min)
  const end = Math.max(start + 1, Math.ceil(min + Math.max(0, length)))
  const total = end - start
  const safeOverlap = Math.max(0, Math.floor(overlap))
  const textureLimit = normalizeTextureLimit(maxTextureSize)
  const maxContentLength = Math.max(1, textureLimit - safeOverlap * 2)
  const chunkCount = Math.max(1, Math.ceil(total / maxContentLength))
  const contentLength = Math.ceil(total / chunkCount)
  const rects: AxisRect[] = []

  for (let index = 0; index < chunkCount; index++) {
    const contentMin = start + index * contentLength
    const contentMax = Math.min(end, contentMin + contentLength)
    rects.push({
      min: Math.max(start, contentMin - safeOverlap),
      max: Math.min(end, contentMax + safeOverlap),
    })
  }

  return rects
}

export function getTerrainBakeChunkRects(
  bounds: Pick<Bounds, 'minX' | 'minY' | 'width' | 'height'>,
  maxTextureSize: number,
  overlap: number = TERRAIN_BAKE_CHUNK_OVERLAP
): Bounds[] {
  const xRects = getAxisChunkRects(bounds.minX, bounds.width, maxTextureSize, overlap)
  const yRects = getAxisChunkRects(bounds.minY, bounds.height, maxTextureSize, overlap)
  const rects: Bounds[] = []

  for (const xRect of xRects) {
    for (const yRect of yRects) {
      rects.push({
        minX: xRect.min,
        minY: yRect.min,
        width: Math.max(1, xRect.max - xRect.min),
        height: Math.max(1, yRect.max - yRect.min),
      })
    }
  }

  return rects
}
