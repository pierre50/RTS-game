import { AnimatedSprite, Assets, Graphics, Rectangle, Sprite, Texture, type Filter } from 'pixi.js'
import { ColorOverlayFilter, OutlineFilter } from 'pixi-filters'
import { FADE_DURATION_MS, LABEL_TYPES } from '../../constants'
import {
  bindAnimatedSpriteToTicker,
  attachEntityShadowsToMapSpace,
  changeSpriteColorDirectly,
  getRallyPointFrames,
  getEntityMapPoint,
  getHexColor,
  getTextureByFrame,
  getTextureSheet,
  getEntityMapSpace,
  isEntityInActiveMapSpace,
  parseTextureRef,
  RALLY_POINT_SHEET_ID,
} from '../../lib'
import { getShadowsEnabled } from '../../lib/audio/settings'
import { fadeIn } from '../../lib/entities/entityFade'
import type { RuntimeCell } from '../../types/map'
import type { BuildingControllerHost } from './BuildingTypes'

export type BuildingShadow = Sprite

const SHADOW_MASK_ALPHA = 1
const SHADOW_OFFSET_Y = 0
const SPRITE_SHADOW_SCALE_X = 1.02
const SPRITE_SHADOW_SCALE_Y = -0.5
const CONSTRUCTION_GHOST_ALPHA = 0.42
const CONSTRUCTION_GHOST_COLOR_ALPHA = 0.58
const CONSTRUCTION_BORDER_ALPHA = 0.82
const CONSTRUCTION_BORDER_COLOR = 0xffd25a
const CONSTRUCTION_BORDER_WIDTH = 3
const shadowTextureFrameCache = new Map<string, Texture>()

type ConstructionGhostSprite = Sprite & {
  constructionGhostBaseFilters?: readonly Filter[] | null
  constructionGhostColor?: string
  constructionGhostFilter?: ColorOverlayFilter
  constructionGhostSourceTexture?: Texture
  constructionGhostTexture?: Texture
}

function getConstructionGhostTint(color: string): number {
  const hex = getHexColor(color)
  return Number.parseInt(hex.replace('#', ''), 16) || 0xffffff
}

function getSpriteParentBounds(sprite: Sprite): { x: number; y: number; width: number; height: number } {
  const texture = sprite.texture
  const width = texture.orig?.width || texture.width
  const height = texture.orig?.height || texture.height
  return {
    x: sprite.position.x - sprite.anchor.x * width * sprite.scale.x,
    y: sprite.position.y - sprite.anchor.y * height * sprite.scale.y,
    width: width * Math.abs(sprite.scale.x),
    height: height * Math.abs(sprite.scale.y),
  }
}

function syncBuildingConstructionBorder(building: BuildingControllerHost, texture: Texture): void {
  let border = building.constructionGhostBorder as Sprite | null | undefined
  if (!border) {
    border = new Sprite(texture)
    border.label = 'construction-ghost-border'
    border.eventMode = 'none'
    border.roundPixels = building.sprite.roundPixels
    border.filters = [
      new OutlineFilter({
        alpha: CONSTRUCTION_BORDER_ALPHA,
        color: CONSTRUCTION_BORDER_COLOR,
        knockout: true,
        quality: 0.18,
        thickness: CONSTRUCTION_BORDER_WIDTH,
      }),
    ]
    building.constructionGhostBorder = border
    building.addChild(border)
  }

  border.texture = texture
  border.anchor.set(building.sprite.anchor.x, building.sprite.anchor.y)
  border.position.copyFrom(building.sprite.position)
  border.scale.copyFrom(building.sprite.scale)
  border.visible = building.sprite.visible
}

export function applyBuildingConstructionGhost(building: BuildingControllerHost): void {
  const sprite = building.sprite as ConstructionGhostSprite
  const ownerColor = building.owner.color ?? ''
  const ghostTint = getConstructionGhostTint(ownerColor)
  const sourceTexture =
    sprite.texture === sprite.constructionGhostTexture && sprite.constructionGhostSourceTexture
      ? sprite.constructionGhostSourceTexture
      : sprite.texture

  if (ownerColor && ownerColor !== 'blue') {
    if (
      sprite.constructionGhostColor !== ownerColor ||
      sprite.constructionGhostSourceTexture !== sourceTexture ||
      !sprite.constructionGhostTexture
    ) {
      sprite.texture = sourceTexture
      changeSpriteColorDirectly(sprite, ownerColor)
      sprite.constructionGhostColor = ownerColor
      sprite.constructionGhostSourceTexture = sourceTexture
      sprite.constructionGhostTexture = sprite.texture
    }
    sprite.texture = sprite.constructionGhostTexture
  } else if (sprite.texture === sprite.constructionGhostTexture && sprite.constructionGhostSourceTexture) {
    sprite.texture = sprite.constructionGhostSourceTexture
  }

  if (sprite.constructionGhostBaseFilters === undefined) {
    sprite.constructionGhostBaseFilters = sprite.filters ?? null
  }
  if (!sprite.constructionGhostFilter) {
    sprite.constructionGhostFilter = new ColorOverlayFilter({
      alpha: CONSTRUCTION_GHOST_COLOR_ALPHA,
      color: ghostTint,
    })
  }
  sprite.constructionGhostFilter.color = ghostTint
  sprite.constructionGhostFilter.alpha = CONSTRUCTION_GHOST_COLOR_ALPHA
  sprite.filters = [...(sprite.constructionGhostBaseFilters ?? []), sprite.constructionGhostFilter]
  sprite.alpha = CONSTRUCTION_GHOST_ALPHA
  sprite.tint = 0xffffff
  syncBuildingConstructionBorder(building, sourceTexture)
}

export function syncBuildingConstructionReveal(building: BuildingControllerHost, percentage: number): void {
  const progress = Math.max(0, Math.min(1, percentage / 100))
  applyBuildingConstructionGhost(building)

  if (!building.constructionRevealSprite) {
    const reveal = new Sprite(building.sprite.texture)
    reveal.label = 'construction-reveal'
    reveal.eventMode = 'none'
    reveal.roundPixels = building.sprite.roundPixels
    reveal.anchor.set(building.sprite.anchor.x, building.sprite.anchor.y)
    reveal.position.copyFrom(building.sprite.position)
    reveal.scale.copyFrom(building.sprite.scale)
    reveal.tint = 0xffffff
    building.constructionRevealSprite = reveal
    building.addChild(reveal)
  }

  if (!building.constructionRevealMask) {
    const mask = new Graphics()
    mask.label = 'construction-reveal-mask'
    mask.eventMode = 'none'
    mask.alpha = 0.001
    building.constructionRevealMask = mask
    building.addChild(mask)
    building.constructionRevealSprite.mask = mask
  }

  const reveal = building.constructionRevealSprite
  const mask = building.constructionRevealMask
  reveal.texture =
    (building.sprite as ConstructionGhostSprite).constructionGhostSourceTexture ?? building.sprite.texture
  reveal.anchor.set(building.sprite.anchor.x, building.sprite.anchor.y)
  reveal.position.copyFrom(building.sprite.position)
  reveal.scale.copyFrom(building.sprite.scale)
  changeSpriteColorDirectly(reveal, building.owner.color ?? '')
  reveal.visible = progress > 0
  reveal.alpha = 1

  const bounds = getSpriteParentBounds(building.sprite)
  const visibleHeight = Math.max(1, bounds.height * progress)
  const top = bounds.y + bounds.height - visibleHeight
  mask.clear()
  mask.rect(bounds.x - 2, top, bounds.width + 4, visibleHeight + 2)
  mask.fill({ color: 0xffffff })
}

export function clearBuildingConstructionReveal(building: BuildingControllerHost): void {
  building.constructionGhostBorder?.parent?.removeChild(building.constructionGhostBorder)
  building.constructionGhostBorder?.destroy({ children: true })
  building.constructionGhostBorder = null
  building.constructionRevealSprite?.parent?.removeChild(building.constructionRevealSprite)
  building.constructionRevealSprite?.destroy({ children: true, texture: false })
  building.constructionRevealSprite = null
  building.constructionRevealMask?.parent?.removeChild(building.constructionRevealMask)
  building.constructionRevealMask?.destroy({ children: true, texture: false })
  building.constructionRevealMask = null
  building.sprite.mask = null
  building.sprite.alpha = 1
  building.sprite.tint = 0xffffff
  const sprite = building.sprite as ConstructionGhostSprite
  if (sprite.constructionGhostBaseFilters !== undefined) {
    sprite.filters = sprite.constructionGhostBaseFilters ? [...sprite.constructionGhostBaseFilters] : null
    delete sprite.constructionGhostBaseFilters
  }
  delete sprite.constructionGhostFilter
}

function fadeInBuildingShadow(building: BuildingControllerHost): void {
  const shadow = building.shadow
  if (!shadow || shadow.destroyed) return
  shadow.alpha = SHADOW_MASK_ALPHA
  fadeIn(
    {
      context: building.context,
      get isDestroyed() {
        return Boolean(building.isDead || building.isDestroyed)
      },
      shadow,
    },
    FADE_DURATION_MS
  )
}

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
  const space = getEntityMapSpace(building, building.context.map)
  ;(space?.container ?? building.context.map).addChild(flag)
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
  const spriteTexture = building.sprite?.texture
  if ((!texture && !building.useSpriteShadow) || !spriteTexture) {
    building.shadow?.parent?.removeChild(building.shadow)
    building.shadow?.destroy()
    building.shadow = null
    building.shadowWasVisible = false
    return null
  }
  const shadow = new Sprite(texture ?? spriteTexture)
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
  if (!texture && !building.useSpriteShadow) {
    building.shadow?.parent?.removeChild(building.shadow)
    building.shadow?.destroy()
    building.shadow = null
    building.shadowWasVisible = false
    return
  }
  const wasVisible = building.shadowWasVisible === true
  if (!shadow) {
    const spriteTexture = building.sprite?.texture
    if (!spriteTexture) {
      building.shadow?.parent?.removeChild(building.shadow)
      building.shadow?.destroy()
      building.shadow = null
      building.shadowWasVisible = false
      return
    }
    shadow = new Sprite(texture ?? spriteTexture)
    shadow.label = LABEL_TYPES.shadow
    shadow.eventMode = 'none'
    shadow.roundPixels = true
    building.shadow = shadow
    attachEntityShadowsToMapSpace(building.context.map, building)
  }
  const sprite = building.sprite
  shadow.texture = texture ?? sprite.texture
  const anchor = texture?.defaultAnchor ?? {
    x: building.spriteShadowAnchor?.x ?? sprite.anchor.x,
    y: building.spriteShadowAnchor?.y ?? sprite.anchor.y,
  }
  if (anchor) {
    shadow.anchor.set(anchor.x, anchor.y)
  }
  shadow.zIndex = -2
  shadow.alpha = SHADOW_MASK_ALPHA
  shadow.visible =
    getShadowsEnabled() &&
    building.visible &&
    building.isBuilt === true &&
    !building.isDead &&
    !building.isDestroyed &&
    isEntityInActiveMapSpace(building)
  shadow.rotation = 0
  shadow.tint = texture ? 0xffffff : 0x000000
  shadow.scale.set(
    texture ? sprite.scale.x : Math.abs(sprite.scale.x) * SPRITE_SHADOW_SCALE_X,
    texture ? sprite.scale.y : Math.abs(sprite.scale.y) * SPRITE_SHADOW_SCALE_Y
  )
  const point = getEntityMapPoint(building)
  shadow.position.set(point.x, point.y + (building.reliefLift ?? 0) + SHADOW_OFFSET_Y)
  building.shadowWasVisible = shadow.visible
  if (!wasVisible && shadow.visible) fadeInBuildingShadow(building)
}

export function syncBuildingVisualSettings(building: BuildingControllerHost): void {
  if (building.shadow) {
    building.shadow.visible =
      getShadowsEnabled() &&
      building.visible &&
      building.isBuilt === true &&
      !building.isDead &&
      !building.isDestroyed &&
      isEntityInActiveMapSpace(building)
  }
}

export function destroyBuildingVisuals(building: BuildingControllerHost): void {
  clearBuildingRallyPoint(building)
  clearBuildingConstructionReveal(building)
  building.visualSettingsCleanup?.()
  building.visualSettingsCleanup = null
  building.shadow?.parent?.removeChild(building.shadow)
  building.shadow?.destroy({ children: true, texture: false })
  building.shadow = null
}
