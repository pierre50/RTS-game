import type { Texture } from 'pixi.js'
import { AnimatedSprite } from 'pixi.js'
import { LABEL_TYPES, SHEET_TYPES } from '../../constants'
import { bindAnimatedSpriteToTicker, changeSpriteColor, changeSpritePalette } from '../../lib'
import {
  getLayerRenderState,
  type AppearanceLayerRenderState,
  type RuntimeAppearanceLayer,
} from './appearance/UnitAppearanceRenderState'
import type { UnitRuntimeHost } from './UnitTypes'

type AppearanceSyncSprite = AnimatedSprite & {
  _afterAnimationUpdate?: (() => void) | null
}

const MAIN_SPRITE_LAYER_Z_INDEX = 10

function getAppearanceSyncSprite(unit: UnitRuntimeHost): AppearanceSyncSprite | null {
  return ((unit as UnitRuntimeHost & { sprite?: AppearanceSyncSprite }).sprite ?? null) as AppearanceSyncSprite | null
}

function getSyncedFrameIndex(unit: UnitRuntimeHost, textureCount: number): number {
  const sprite = getAppearanceSyncSprite(unit)
  return Math.min(Math.floor(sprite?.currentFrame ?? 0), Math.max(textureCount - 1, 0))
}

function syncLayerSpriteFrame(unit: UnitRuntimeHost, layerSprite: AnimatedSprite): number {
  const frameIndex = getSyncedFrameIndex(unit, layerSprite.textures.length)
  if (layerSprite.currentFrame !== frameIndex) {
    layerSprite.currentFrame = frameIndex
  }
  return frameIndex
}

function removeAppearanceLayer(unit: UnitRuntimeHost, spriteKey: number): void {
  const existing = unit.appearanceLayerSprites.get(spriteKey)
  if (!existing) return
  existing.parent?.removeChild(existing)
  existing.destroy({ children: true, texture: false })
  unit.appearanceLayerSprites.delete(spriteKey)
}

function clearAppearanceLayers(unit: UnitRuntimeHost): void {
  for (const sprite of unit.appearanceLayerSprites.values()) {
    sprite.parent?.removeChild(sprite)
    sprite.destroy({ children: true, texture: false })
  }
  unit.appearanceLayerSprites.clear()
  const sprite = getAppearanceSyncSprite(unit)
  if (sprite) sprite._afterAnimationUpdate = null
}

function syncUnitAppearanceLayerFrames(unit: UnitRuntimeHost, sheet = unit.currentSheet): void {
  for (const [spriteKey, layerSprite] of unit.appearanceLayerSprites.entries()) {
    const frameIndex = syncLayerSpriteFrame(unit, layerSprite)
    const layer = unit.appearance?.layers?.[spriteKey]
    if (sheet === SHEET_TYPES.action && typeof layer?.hideOnOrAfterFrame === 'number') {
      layerSprite.visible = frameIndex < layer.hideOnOrAfterFrame
    }
  }
}

function bindUnitAppearanceFrameSync(unit: UnitRuntimeHost): void {
  const sprite = getAppearanceSyncSprite(unit)
  if (sprite) sprite._afterAnimationUpdate = () => syncUnitAppearanceLayerFrames(unit)
}

function syncAppearanceLayerSprite(
  unit: UnitRuntimeHost,
  spriteKey: number,
  sheet: string,
  state: AppearanceLayerRenderState
): void {
  let layerSprite = unit.appearanceLayerSprites.get(spriteKey)
  if (!layerSprite) {
    layerSprite = new AnimatedSprite(state.textures as Texture[])
    bindAnimatedSpriteToTicker(layerSprite, unit.context.app)
    layerSprite.label = `${LABEL_TYPES.sprite}-layer-${spriteKey}`
    layerSprite.eventMode = 'none'
    layerSprite.position.x = unit.getMountedRiderX()
    layerSprite.position.y = unit.getMountedRiderY()
    layerSprite.roundPixels = true
    layerSprite.loop = unit.loop ?? true
    layerSprite.updateAnchor = true
    layerSprite.zIndex = state.layerZIndex
    if (state.layerZIndex < MAIN_SPRITE_LAYER_Z_INDEX) {
      unit.addChildAt(layerSprite, Math.max(0, unit.getChildIndex(unit.sprite)))
    } else {
      unit.addChild(layerSprite)
    }
    unit.appearanceLayerSprites.set(spriteKey, layerSprite)
  }

  layerSprite.visible = true
  layerSprite.loop = unit.sprite.loop
  layerSprite.position.x = unit.getMountedRiderX()
  layerSprite.position.y = unit.getMountedRiderY()
  layerSprite.zIndex = state.layerZIndex
  layerSprite.textures = state.textures as Texture[]
  if (state.layer.palette === 'player') {
    changeSpriteColor(layerSprite, unit.owner.color ?? '')
  } else if (state.layer.palette?.startsWith('hair:')) {
    changeSpritePalette(
      layerSprite,
      state.layer.paletteSource ?? 'brown_hair',
      state.layer.palette.slice('hair:'.length)
    )
  } else {
    layerSprite.filters = null
  }
  const spriteScale = unit.spriteScale ?? 1
  layerSprite.scale.x = state.mirrored ? -spriteScale : spriteScale
  layerSprite.scale.y = spriteScale
  const defaultAnchor = (layerSprite.textures[0] as Texture & { defaultAnchor?: { x: number; y: number } })
    .defaultAnchor
  if (defaultAnchor) layerSprite.anchor.set(defaultAnchor.x, defaultAnchor.y)
  layerSprite.animationSpeed = unit.sprite.animationSpeed ?? state.spritesheet.data?.animationSpeed ?? 0.2
  layerSprite.currentFrame = state.frameIndex
  layerSprite.visible =
    sheet === SHEET_TYPES.action && typeof state.layer.hideOnOrAfterFrame === 'number'
      ? state.frameIndex < state.layer.hideOnOrAfterFrame
      : true
  if (sheet === SHEET_TYPES.action) {
    layerSprite.onFrameChange = undefined
    layerSprite.gotoAndStop(state.frameIndex)
  } else if (state.mountedSheetOverride || (unit.mountedOnHorse && sheet !== SHEET_TYPES.action)) {
    layerSprite.onFrameChange = undefined
    layerSprite.gotoAndStop(state.frameIndex)
  } else if (unit.sprite.playing) {
    layerSprite.onFrameChange = () => {
      syncLayerSpriteFrame(unit, layerSprite)
    }
    layerSprite.gotoAndPlay(state.frameIndex)
  } else {
    layerSprite.onFrameChange = undefined
    layerSprite.gotoAndStop(state.frameIndex)
  }
}

export function syncUnitAppearanceLayers(unit: UnitRuntimeHost, sheet: string): void {
  const layers = unit.appearance?.layers
  if (!getAppearanceSyncSprite(unit) || !layers?.length) {
    clearAppearanceLayers(unit)
    return
  }

  const liveLayers = new Set<number>()
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i] as RuntimeAppearanceLayer
    const spriteKey = i
    const state = getLayerRenderState(unit, layer, sheet)
    liveLayers.add(spriteKey)
    if (!state) {
      removeAppearanceLayer(unit, spriteKey)
      continue
    }
    syncAppearanceLayerSprite(unit, spriteKey, sheet, state)
  }

  for (const [spriteKey, sprite] of unit.appearanceLayerSprites.entries()) {
    if (liveLayers.has(spriteKey)) continue
    sprite.parent?.removeChild(sprite)
    sprite.destroy({ children: true, texture: false })
    unit.appearanceLayerSprites.delete(spriteKey)
  }

  bindUnitAppearanceFrameSync(unit)
  syncUnitAppearanceLayerFrames(unit, sheet)
}
