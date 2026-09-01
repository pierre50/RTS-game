import { AnimatedSprite, Assets, Polygon, Sprite, type Texture } from 'pixi.js'
import { RESOURCE_TYPES } from '../constants'
import {
  bindAnimatedSpriteToTicker,
  getAnimationFrames,
  getTexture,
  getTextureSheet,
  parseTextureRef,
  textureRefToString,
} from '../lib'
import { getTerrainAssets, normalizeResourceTextureRef, type ResourceOptions } from './ResourceTexture'
import type { Resource } from './Resource'
import type { TextureWithCacheIds } from './ResourceVisuals'

export function createResourceSprite(
  resource: Resource,
  options: ResourceOptions,
  cell: { type: string }
): Sprite | AnimatedSprite {
  if (resource.isAnimated) return createAnimatedResourceSprite(resource, options)
  return createStaticResourceSprite(resource, cell)
}

function createAnimatedResourceSprite(resource: Resource, options: ResourceOptions): AnimatedSprite {
  const spritesheetJump = Assets.cache.get(resource.assets as string)
  const sprite = new AnimatedSprite(getAnimationFrames(spritesheetJump.textures) as Texture[])
  bindAnimatedSpriteToTicker(sprite, resource.context.app)
  sprite.animationSpeed = spritesheetJump.data?.animationSpeed ?? 0.3
  sprite.loop = spritesheetJump.data?.loop ?? true
  sprite.updateAnchor = true
  if (sprite.texture.defaultAnchor) {
    sprite.anchor.copyFrom(sprite.texture.defaultAnchor)
  }
  if (resource.type === RESOURCE_TYPES.wheat) {
    sprite.onFrameChange = () => {
      if (resource.isWindAnimatedWheat()) resource.startWindMotion()
    }
    sprite.onComplete = () => resource.startWindMotion()
    stopWheatAtInitialGrowthFrame(resource, sprite, options)
  } else {
    sprite.play()
  }
  return sprite
}

function stopWheatAtInitialGrowthFrame(resource: Resource, sprite: AnimatedSprite, options: ResourceOptions): void {
  const lastFrame = Math.max(0, sprite.textures.length - 1)
  const frame =
    options.startsMature === true ? lastFrame : Math.max(0, Math.min(lastFrame, Math.floor(options.currentFrame ?? 0)))
  sprite.gotoAndStop(frame)
  if (resource.isWindAnimatedWheat()) resource.startWindMotion()
}

function createStaticResourceSprite(resource: Resource, cell: { type: string }): Sprite {
  const terrainAssets = getTerrainAssets(resource.assets, cell.type)
  const textureRef =
    resource.textureName ||
    (typeof terrainAssets === 'string'
      ? { sheet: terrainAssets, frame: 0 }
      : Array.isArray(terrainAssets)
        ? resource.context.map.randomItem(terrainAssets)
        : terrainAssets)
  if (!textureRef) {
    throw new Error(`Missing texture for resource ${resource.type} on ${cell.type}`)
  }
  const normalizedTextureRef = normalizeResourceTextureRef(textureRef)
  const texture = getTexture(normalizedTextureRef, Assets)
  const textureFile =
    (texture as TextureWithCacheIds).textureCacheIds?.[0] || `${textureRefToString(normalizedTextureRef)}.png`
  const spritesheet = Assets.cache.get(getTextureSheet(normalizedTextureRef))
  resource.textureName = textureRefToString(normalizedTextureRef)
  const sprite = Sprite.from(texture)
  if (resource.type === RESOURCE_TYPES.berrybush && resource.berrybushFullTextureName == null) {
    const berrybushTextureRef = parseTextureRef(resource.textureName)
    if (berrybushTextureRef.frame > 0) {
      resource.berrybushFullTextureName = resource.textureName
    }
  }
  sprite.hitArea =
    spritesheet?.data?.frames?.[textureFile]?.hitArea && new Polygon(spritesheet.data.frames[textureFile].hitArea)
  return sprite
}
