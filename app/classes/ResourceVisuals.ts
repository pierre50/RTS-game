import { AnimatedSprite, Assets, Rectangle, Sprite, Texture, type Ticker } from 'pixi.js'
import {
  bindAnimatedSpriteToTicker,
  getEntityMapPoint,
  getTextureByFrame,
  getTextureSheet,
  isEntityInActiveMapSpace,
  parseTextureRef,
} from '../lib'
import { LABEL_TYPES, RESOURCE_TYPES } from '../constants'
import { getResourceWindAnimationEnabled, getShadowsEnabled } from '../lib/audio/settings'
import type { RuntimeMap } from '../types/map'

export type ResourceShadow = Sprite | AnimatedSprite
export type WindTick = (ticker: { deltaMS?: number; elapsedMS?: number }) => void

type TextureWithCacheIds = Texture & { textureCacheIds?: string[] }
type ResourceVisualOwner = {
  context: {
    app: { ticker: { add: (tick: (ticker: Ticker) => void) => void; remove: (tick: (ticker: Ticker) => void) => void } }
    map?: RuntimeMap | null
    paused?: boolean
  }
  destroyed?: boolean
  i: number
  isDead?: boolean
  isDestroyed?: boolean
  j: number
  lifecycleAssets?: {
    fallen?: string | { sheet: string }
    cut?: string | { sheet: string }
  }
  reliefLift?: number
  shadow: ResourceShadow | null
  sprite: Sprite | AnimatedSprite
  textureName?: string
  type: string
  usesTextureShadow: boolean
  visible: boolean
  windPhase: number
  windTick: WindTick | null
  windTime: number
  x: number
  y: number
  spaceId?: string | null
}

const resourceShadowTextureFrameCache = new Map<string, Texture>()

const SHADOW_MASK_ALPHA = 1
const SHADOW_SCALE_X = 1.02
const SHADOW_SCALE_Y = -0.5
const WIND_AMPLITUDE = 0.018
const WIND_ROTATION = 0.006
const WIND_SPEED = 0.0018

function getLifecycleSheetId(asset: string | { sheet: string } | undefined): string | undefined {
  return typeof asset === 'string' ? asset : asset?.sheet
}

function getShadowTexture(
  textureName: string,
  spriteTexture: Texture,
  spriteAnchor: { x: number; y: number }
): Texture | null {
  const sheet = getTextureSheet(textureName)
  const shadowAtlasId = `${sheet}/shadow`
  const shadowAsset = Assets.cache.has(shadowAtlasId)
    ? ((Assets.cache.get(shadowAtlasId) as (Texture & { textures?: Record<string, Texture> }) | undefined) ?? null)
    : null
  if (!shadowAsset) return null

  if (shadowAsset.textures) {
    return getTextureByFrame(shadowAtlasId, parseTextureRef(textureName).frame, Assets)
  }

  const { frame, rotate } = spriteTexture
  const source = shadowAsset.source
  const atlasExtraWidth = Math.max(0, source.width - spriteTexture.source.width)
  const atlasExtraHeight = Math.max(0, source.height - spriteTexture.source.height)
  const atlasPadX = atlasExtraWidth / 2
  const shadowFrameWidth = frame.width + atlasExtraWidth
  const shadowFrameHeight = frame.height + atlasExtraHeight

  if (frame.x + shadowFrameWidth > source.width || frame.y + shadowFrameHeight > source.height) return null

  const cacheKey = `${sheet}/shadow:${frame.x}:${frame.y}:${shadowFrameWidth}:${shadowFrameHeight}`
  let shadowTexture = resourceShadowTextureFrameCache.get(cacheKey)
  if (!shadowTexture) {
    const anchorX = (spriteAnchor.x * frame.width + atlasPadX) / shadowFrameWidth
    const anchorY = (spriteAnchor.y * frame.height) / shadowFrameHeight
    shadowTexture = new Texture({
      source,
      frame: new Rectangle(frame.x, frame.y, shadowFrameWidth, shadowFrameHeight),
      orig: new Rectangle(0, 0, shadowFrameWidth, shadowFrameHeight),
      rotate,
      defaultAnchor: { x: anchorX, y: anchorY },
    })
    resourceShadowTextureFrameCache.set(cacheKey, shadowTexture)
  }
  return shadowTexture
}

export function isWindAnimatedWheat(resource: ResourceVisualOwner): boolean {
  if (resource.type !== RESOURCE_TYPES.wheat || !(resource.sprite instanceof AnimatedSprite)) return false
  return (
    resource.sprite.currentFrame > 0 ||
    (!resource.sprite.playing && resource.sprite.currentFrame >= resource.sprite.textures.length - 1)
  )
}

export function isCutOrFallenTree(resource: ResourceVisualOwner): boolean {
  if (resource.type !== RESOURCE_TYPES.tree || !resource.textureName) return false
  const sheet = getTextureSheet(resource.textureName)
  return (
    sheet === getLifecycleSheetId(resource.lifecycleAssets?.cut) ||
    sheet === getLifecycleSheetId(resource.lifecycleAssets?.fallen)
  )
}

export function isWindMotionEligible(resource: ResourceVisualOwner): boolean {
  return (
    !resource.isDead &&
    !isCutOrFallenTree(resource) &&
    (resource.type === RESOURCE_TYPES.tree ||
      resource.type === RESOURCE_TYPES.berrybush ||
      isWindAnimatedWheat(resource))
  )
}

export function shouldUseWindMotion(resource: ResourceVisualOwner): boolean {
  return (
    !resource.isDestroyed &&
    !resource.destroyed &&
    isWindMotionEligible(resource) &&
    getResourceWindAnimationEnabled()
  )
}

export function canApplyWindMotion(
  displayObject: ResourceShadow | null | undefined
): displayObject is ResourceShadow {
  return Boolean(displayObject && !displayObject.destroyed && displayObject.skew)
}

export function startWindMotion(resource: ResourceVisualOwner): void {
  if (!shouldUseWindMotion(resource) || resource.windTick || !canApplyWindMotion(resource.sprite)) return
  resource.windPhase = ((resource.i * 37 + resource.j * 17) % 360) * (Math.PI / 180)
  resource.windTick = ticker => updateWindMotion(resource, ticker.deltaMS ?? ticker.elapsedMS ?? 16.67)
  resource.context.app.ticker.add(resource.windTick as (ticker: Ticker) => void)
}

export function stopWindMotion(resource: ResourceVisualOwner): void {
  if (resource.windTick) {
    resource.context.app.ticker.remove(resource.windTick as (ticker: Ticker) => void)
    resource.windTick = null
  }
  resetWindMotion(resource)
}

export function resetWindMotion(resource: ResourceVisualOwner): void {
  const { sprite } = resource
  if (!canApplyWindMotion(sprite)) return
  sprite.skew.x = 0
  sprite.rotation = 0
  if (canApplyWindMotion(resource.shadow)) {
    resource.shadow.skew.x = 0
    resource.shadow.rotation = 0
  }
}

export function updateWindMotion(resource: ResourceVisualOwner, deltaMS: number): void {
  const { sprite } = resource
  if (!canApplyWindMotion(sprite)) {
    stopWindMotion(resource)
    return
  }
  if (resource.context.paused) return
  if (!shouldUseWindMotion(resource)) {
    resetWindMotion(resource)
    return
  }
  resource.windTime += deltaMS
  const sway = Math.sin(resource.windPhase + resource.windTime * WIND_SPEED)
  const secondary = Math.sin(resource.windPhase * 0.7 + resource.windTime * WIND_SPEED * 0.47)
  sprite.skew.x = sway * WIND_AMPLITUDE
  sprite.rotation = secondary * WIND_ROTATION
  if (canApplyWindMotion(resource.shadow)) {
    resource.shadow.skew.x = sprite.skew.x * 0.45
  }
}

export function createShadow(resource: ResourceVisualOwner): ResourceShadow | null {
  const shadowTexture =
    resource.sprite && resource.textureName
      ? getShadowTexture(resource.textureName, resource.sprite.texture, resource.sprite.anchor)
      : null
  resource.usesTextureShadow = Boolean(shadowTexture)
  const shadow = shadowTexture
    ? new Sprite(shadowTexture)
    : resource.sprite instanceof AnimatedSprite
      ? new AnimatedSprite(resource.sprite.textures as Texture[])
      : new Sprite(resource.sprite.texture)
  if (!shadowTexture && shadow instanceof AnimatedSprite) {
    bindAnimatedSpriteToTicker(shadow, resource.context.app)
  }
  shadow.label = LABEL_TYPES.shadow
  shadow.eventMode = 'none'
  shadow.roundPixels = true
  if (!shadowTexture) {
    shadow.tint = 0x000000
    shadow.alpha = SHADOW_MASK_ALPHA
  }
  shadow.zIndex = -2
  syncShadow(resource, shadow)
  return shadow
}

export function syncShadow(resource: ResourceVisualOwner, shadow = resource.shadow): void {
  if (!shadow || !resource.sprite) return
  shadow.visible = getShadowsEnabled() && resource.visible && !resource.isDestroyed && isEntityInActiveMapSpace(resource)
  if (resource.usesTextureShadow && shadow instanceof Sprite) {
    const shadowTexture = resource.textureName
      ? getShadowTexture(resource.textureName, resource.sprite.texture, resource.sprite.anchor)
      : null
    if (shadowTexture) {
      shadow.texture = shadowTexture
      if (shadowTexture.defaultAnchor) {
        shadow.anchor.set(shadowTexture.defaultAnchor.x, shadowTexture.defaultAnchor.y)
      } else {
        shadow.anchor.set(resource.sprite.anchor.x, resource.sprite.anchor.y)
      }
      shadow.alpha = SHADOW_MASK_ALPHA
      shadow.rotation = 0
      shadow.scale.set(resource.sprite.scale.x, resource.sprite.scale.y)
      const point = getEntityMapPoint(resource)
      shadow.position.set(point.x, point.y + (resource.reliefLift ?? 0))
      shadow.tint = 0xffffff
      return
    }
    resource.usesTextureShadow = false
  }
  if (resource.sprite instanceof AnimatedSprite && shadow instanceof AnimatedSprite) {
    const frame = Math.min(resource.sprite.currentFrame, Math.max(resource.sprite.textures.length - 1, 0))
    shadow.textures = resource.sprite.textures
    shadow.animationSpeed = resource.sprite.animationSpeed
    shadow.loop = resource.sprite.loop
    shadow.anchor.set(resource.sprite.anchor.x, resource.sprite.anchor.y)
    if (resource.sprite.playing) {
      shadow.gotoAndPlay(frame)
    } else {
      shadow.gotoAndStop(frame)
    }
  } else if (resource.sprite instanceof Sprite && shadow instanceof Sprite) {
    shadow.texture = resource.sprite.texture
    shadow.anchor.set(resource.sprite.anchor.x, resource.sprite.anchor.y)
  }
  shadow.alpha = SHADOW_MASK_ALPHA
  shadow.rotation = 0
  shadow.scale.set(
    Math.abs(resource.sprite.scale.x) * SHADOW_SCALE_X,
    Math.abs(resource.sprite.scale.y) * SHADOW_SCALE_Y
  )
  const point = getEntityMapPoint(resource)
  shadow.position.set(point.x, point.y + (resource.reliefLift ?? 0))
}

export function syncVisualSettings(resource: ResourceVisualOwner): void {
  if (resource.shadow) {
    resource.shadow.visible =
      getShadowsEnabled() && resource.visible && !resource.isDestroyed && isEntityInActiveMapSpace(resource)
  }
  if (getResourceWindAnimationEnabled()) {
    startWindMotion(resource)
  } else {
    stopWindMotion(resource)
  }
}

export type { TextureWithCacheIds }
