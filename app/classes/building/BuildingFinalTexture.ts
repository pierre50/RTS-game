import type { Texture } from 'pixi.js'
import { AnimatedSprite, Assets, Polygon } from 'pixi.js'
import { LABEL_TYPES } from '../../constants'
import {
  bindAnimatedSpriteToTicker,
  changeSpriteColorDirectly,
  getAnimationFrames,
  getBuildingAsset,
  getBuildingAssetOwner,
  getTexture,
  getTextureSheet,
  textureRefToString,
} from '../../lib'
import { isWall, updateWallAndNeighbours } from '../../lib/buildings/walls'
import { syncBuildingCampfireDecoration } from './BuildingFire'
import type { BuildingControllerHost } from './BuildingTypes'
import { clearBuildingConstructionReveal } from './BuildingVisuals'

type BuildingTexture = Texture & { hitArea?: number[]; defaultAnchor?: { x: number; y: number } }
type BuildingSpritesheetData = { animationSpeed?: number; loop?: boolean }

export function applyBuildingFinalTexture(building: BuildingControllerHost): void {
  clearBuildingConstructionReveal(building)
  const assetOwner = getBuildingAssetOwner(building)
  const effectiveType = building.assetType || building.type
  const assets = getBuildingAsset(effectiveType, assetOwner, Assets)
  const finalTextureRef = assets.images?.final
  if (!finalTextureRef) throw new Error(`Missing final texture for building: ${effectiveType}`)
  const finalSheetId = getTextureSheet(finalTextureRef)
  const spritesheet = Assets.cache.get(finalSheetId)
  const shouldAnimate = assets.animated === true
  const frames = shouldAnimate && spritesheet?.textures ? (getAnimationFrames(spritesheet.textures) as Texture[]) : []
  const texture = getTexture(finalTextureRef, Assets) as BuildingTexture
  building.textureName = textureRefToString(finalTextureRef)

  applyFinalAnimation(building, frames, spritesheet?.data as BuildingSpritesheetData | undefined)

  building.sprite.texture = texture
  building.sprite.hitArea = texture.hitArea
    ? new Polygon(texture.hitArea)
    : new Polygon([-32 * building.size, 0, 0, -16 * building.size, 32 * building.size, 0, 0, 16 * building.size])
  if (!texture.defaultAnchor) throw new Error(`Missing anchor for building texture: ${building.textureName}`)
  building.sprite.anchor.set(texture.defaultAnchor.x, texture.defaultAnchor.y)
  building.updateShadow()

  const color = building.getChildByLabel(LABEL_TYPES.color)
  if (color) color.destroy()
  changeSpriteColorDirectly(building.sprite, building.owner.color ?? '')
  syncBuildingCampfireDecoration(building)
  if (isWall(building)) updateWallAndNeighbours(building)
}

function applyFinalAnimation(
  building: BuildingControllerHost,
  frames: Texture[],
  data?: BuildingSpritesheetData
): void {
  if (frames.length > 1 && !(building.sprite instanceof AnimatedSprite)) {
    const oldSprite = building.sprite
    const childIndex = building.getChildIndex(oldSprite)
    const animatedSprite = new AnimatedSprite(frames)
    bindAnimatedSpriteToTicker(animatedSprite, building.context.app)
    animatedSprite.label = oldSprite.label
    if (oldSprite.eventMode !== undefined) animatedSprite.eventMode = oldSprite.eventMode
    animatedSprite.roundPixels = oldSprite.roundPixels
    animatedSprite.position.copyFrom(oldSprite.position)
    animatedSprite.scale.copyFrom(oldSprite.scale)
    ;(animatedSprite as AnimatedSprite & { updateAnchor?: boolean }).updateAnchor = true
    building.removeChild(oldSprite)
    oldSprite.destroy({ children: true, texture: false })
    building.sprite = animatedSprite
    building.addChildAt(animatedSprite, Math.max(0, childIndex))
    building.bindSpriteInteractions()
  }

  if (building.sprite instanceof AnimatedSprite && frames.length > 1) {
    const animation = data ?? {}
    building.sprite.textures = frames
    building.sprite.loop = animation.loop ?? true
    building.sprite.animationSpeed = animation.animationSpeed ?? 0.2
    building.sprite.gotoAndPlay(0)
  }
}
