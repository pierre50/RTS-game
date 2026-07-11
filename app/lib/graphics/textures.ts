import { Texture } from 'pixi.js'
import type { HitAreaLike, SpritesheetLike } from '../../types/pixi'

type TextureWithHitArea = Texture & { hitArea?: HitAreaLike; textureCacheIds?: string[] }

type AssetCacheLike = {
  cache: {
    get: (id: string) => SpritesheetLike<TextureWithHitArea> | undefined
  }
}

function getFrameIndex(textureName: string): number {
  return parseInt(textureName.split('_')[0], 10)
}

function getSortedTextureNames(textures: Record<string, TextureWithHitArea>): string[] {
  return Object.keys(textures).sort((a, b) => getFrameIndex(a) - getFrameIndex(b))
}

export function getTextureByFrame(
  sheetId: string,
  frameIndex: number,
  assets: AssetCacheLike
): TextureWithHitArea {
  const spritesheet = assets.cache.get(sheetId)

  if (!spritesheet || !spritesheet.textures) {
    throw new Error(`Spritesheet for ID "${sheetId}" not found in assets.`)
  }

  const textureName = getSortedTextureNames(spritesheet.textures).find(name => getFrameIndex(name) === frameIndex)
  const texture = textureName ? spritesheet.textures[textureName] : undefined

  if (!texture || !textureName) {
    throw new Error(`Frame "${frameIndex}" not found in spritesheet "${sheetId}".`)
  }

  texture.textureCacheIds = texture.textureCacheIds ?? [textureName]
  texture.hitArea = spritesheet.data?.frames?.[textureName]?.hitArea
  return texture
}

export function getTexture(name: string, assets: AssetCacheLike): Texture {
  const [index, id] = name.split('_')
  return getTextureByFrame(id, parseInt(index, 10), assets)
}

export { Texture }
