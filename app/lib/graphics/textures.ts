import { Texture } from 'pixi.js'
import type { HitAreaLike, SpritesheetLike } from '../../types/pixi'

type TextureWithHitArea = Texture & { hitArea?: HitAreaLike; textureCacheIds?: string[] }

export type TextureRef = string | { sheet: string; frame: number }

type AssetCacheLike = {
  cache: {
    get: (id: string) => SpritesheetLike<TextureWithHitArea> | undefined
  }
}

function padFrame(frame: number): string {
  return String(frame).padStart(3, '0')
}

function getFrameIndex(textureName: string): number {
  return parseInt(textureName.split('_')[0], 10)
}

function getSortedTextureNames(textures: Record<string, TextureWithHitArea>): string[] {
  return Object.keys(textures).sort((a, b) => getFrameIndex(a) - getFrameIndex(b))
}

export function getTextureByFrame(
  sheetId: string,
  frameIndex: number | string,
  assets: AssetCacheLike
): TextureWithHitArea {
  const spritesheet = assets.cache.get(sheetId)
  const normalizedFrameIndex = typeof frameIndex === 'string' ? parseInt(frameIndex, 10) : frameIndex

  if (!spritesheet || !spritesheet.textures) {
    throw new Error(`Spritesheet for ID "${sheetId}" not found in assets.`)
  }

  const textureName = getSortedTextureNames(spritesheet.textures).find(name => getFrameIndex(name) === normalizedFrameIndex)
  const texture = textureName ? spritesheet.textures[textureName] : undefined

  if (!texture || !textureName) {
    throw new Error(`Frame "${frameIndex}" not found in spritesheet "${sheetId}".`)
  }

  texture.textureCacheIds = texture.textureCacheIds ?? [textureName]
  texture.hitArea = spritesheet.data?.frames?.[textureName]?.hitArea
  return texture
}

export function parseTextureRef(ref: TextureRef): { sheet: string; frame: number } {
  if (typeof ref !== 'string') return ref
  const [index, ...sheetParts] = ref.split('_')
  return {
    sheet: sheetParts.join('_'),
    frame: parseInt(index, 10),
  }
}

export function textureRefToString(ref: TextureRef): string {
  if (typeof ref === 'string') return ref
  return `${padFrame(ref.frame)}_${ref.sheet}`
}

export function getTextureSheet(ref: TextureRef): string {
  return parseTextureRef(ref).sheet
}

export function getTexture(ref: TextureRef, assets: AssetCacheLike): Texture {
  const { sheet, frame } = parseTextureRef(ref)
  return getTextureByFrame(sheet, frame, assets)
}

export { Texture }
