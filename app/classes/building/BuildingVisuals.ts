import { AnimatedSprite, Assets, Rectangle, Sprite, Texture } from 'pixi.js'
import { LABEL_TYPES } from '../../constants'
import {
  bindAnimatedSpriteToTicker,
  getRallyPointFrames,
  getTextureByFrame,
  getTextureSheet,
  parseTextureRef,
  RALLY_POINT_SHEET_ID,
} from '../../lib'
import { getShadowsEnabled } from '../../lib/settings'
import type { RuntimeCell } from '../../types/map'
import type { BuildingControllerHost } from './BuildingTypes'

export type BuildingShadow = Sprite

const SHADOW_MASK_ALPHA = 1
const SHADOW_OFFSET_Y = 0
const shadowTextureFrameCache = new Map<string, Texture>()

export function setBuildingRallyPoint(
  building: BuildingControllerHost,
  cell: RuntimeCell | undefined,
  direction: number = building.context.map.randomRange(0, 1)
): boolean {
  if (!cell) return false
  clearBuildingRallyPoint(building)
  building.rallyPoint = { i: cell.i, j: cell.j, direction }
  const sheet = Assets.cache.get(RALLY_POINT_SHEET_ID)
  const flag = new AnimatedSprite(getRallyPointFrames(sheet.textures, direction) as Texture[])
  bindAnimatedSpriteToTicker(flag, building.context.app)
  flag.animationSpeed = sheet.data.animationSpeed ?? 0.3
  flag.anchor.set(flag.texture.defaultAnchor!.x, flag.texture.defaultAnchor!.y)
  flag.x = cell.x
  flag.y = cell.y
  flag.zIndex = cell.i + cell.j
  flag.visible = Boolean(building.selected)
  flag.eventMode = 'none'
  flag.roundPixels = true
  flag.play()
  building.context.map.addChild(flag)
  building.rallyPointFlag = flag
  return true
}

export function clearBuildingRallyPoint(building: BuildingControllerHost): void {
  building.rallyPointFlag?.destroy()
  building.rallyPointFlag = null
  building.rallyPoint = null
}

export function getBuildingShadowTexture(building: BuildingControllerHost): Texture | null {
  if (!building.textureName) return null
  const sheet = getTextureSheet(building.textureName)
  const shadowAtlasId = `${sheet}/shadow`
  const shadowAsset = Assets.cache.has(shadowAtlasId)
    ? ((Assets.cache.get(shadowAtlasId) as (Texture & { textures?: Record<string, Texture> }) | undefined) ?? null)
    : null
  if (!shadowAsset || !building.sprite?.texture) return null

  if (shadowAsset.textures) {
    return getTextureByFrame(shadowAtlasId, parseTextureRef(building.textureName).frame, Assets)
  }

  const { frame, rotate } = building.sprite.texture
  const source = shadowAsset.source
  const atlasExtraWidth = Math.max(0, source.width - building.sprite.texture.source.width)
  const atlasExtraHeight = Math.max(0, source.height - building.sprite.texture.source.height)
  const atlasPadX = atlasExtraWidth / 2
  const shadowFrameWidth = frame.width + atlasExtraWidth
  const shadowFrameHeight = frame.height + atlasExtraHeight

  if (frame.x + shadowFrameWidth > source.width || frame.y + shadowFrameHeight > source.height) return null

  const cacheKey = `${sheet}/shadow:${frame.x}:${frame.y}:${shadowFrameWidth}:${shadowFrameHeight}`
  let shadowTexture = shadowTextureFrameCache.get(cacheKey)
  if (!shadowTexture) {
    const anchorX = (building.sprite.anchor.x * frame.width + atlasPadX) / shadowFrameWidth
    const anchorY = (building.sprite.anchor.y * frame.height) / shadowFrameHeight
    shadowTexture = new Texture({
      source,
      frame: new Rectangle(frame.x, frame.y, shadowFrameWidth, shadowFrameHeight),
      orig: new Rectangle(0, 0, shadowFrameWidth, shadowFrameHeight),
      rotate,
      defaultAnchor: { x: anchorX, y: anchorY },
    })
    shadowTextureFrameCache.set(cacheKey, shadowTexture)
  }
  return shadowTexture
}

export function createBuildingShadow(building: BuildingControllerHost): BuildingShadow | null {
  const texture = getBuildingShadowTexture(building)
  if (!texture) return null
  const shadow = new Sprite(texture)
  shadow.label = LABEL_TYPES.shadow
  shadow.eventMode = 'none'
  shadow.roundPixels = true
  updateBuildingShadow(building, shadow)
  return shadow
}

export function updateBuildingShadow(
  building: BuildingControllerHost,
  shadow: BuildingShadow | null = building.shadow ?? null
): void {
  const texture = getBuildingShadowTexture(building)
  if (!texture) {
    building.shadow?.parent?.removeChild(building.shadow)
    building.shadow?.destroy()
    building.shadow = null
    return
  }
  if (!shadow) {
    shadow = new Sprite(texture)
    shadow.label = LABEL_TYPES.shadow
    shadow.eventMode = 'none'
    shadow.roundPixels = true
    building.shadow = shadow
    building.context.map.shadowLayer?.addChild(shadow)
  }
  const sprite = building.sprite
  shadow.texture = texture
  if (texture.defaultAnchor) {
    shadow.anchor.set(texture.defaultAnchor.x, texture.defaultAnchor.y)
  }
  shadow.zIndex = -2
  shadow.alpha = SHADOW_MASK_ALPHA
  shadow.visible = getShadowsEnabled() && building.visible && !building.isDead && !building.isDestroyed
  shadow.rotation = 0
  shadow.tint = 0xffffff
  shadow.scale.set(sprite.scale.x, sprite.scale.y)
  shadow.position.set(building.x, building.y + (building.reliefLift ?? 0) + SHADOW_OFFSET_Y)
}

export function syncBuildingVisualSettings(building: BuildingControllerHost): void {
  if (building.shadow) {
    building.shadow.visible = getShadowsEnabled() && building.visible && !building.isDead && !building.isDestroyed
  }
}

export function destroyBuildingVisuals(building: BuildingControllerHost): void {
  clearBuildingRallyPoint(building)
  building.visualSettingsCleanup?.()
  building.visualSettingsCleanup = null
  building.shadow?.parent?.removeChild(building.shadow)
  building.shadow?.destroy({ children: true, texture: false })
  building.shadow = null
}
