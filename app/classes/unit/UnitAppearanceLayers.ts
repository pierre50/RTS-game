import { Assets, AnimatedSprite } from 'pixi.js'
import type { Texture } from 'pixi.js'
import { LABEL_TYPES, SHEET_TYPES } from '../../constants'
import { bindAnimatedSpriteToTicker, changeSpritePalette, changeSpriteColor, getSpriteFrameSelection } from '../../lib'
import { getActionVisualSheetKey, SHOOTING_SHEET_KEY } from '../../lib/units/actionVisualSheet'
import { getAppearanceAgeSheetOverride, getAppearanceLayerZIndex } from '../../lib/lpc/appearanceLayers'
import { civilizationKey } from '../../lib/lpc/equipment'
import { getUnitEquipmentLevel } from '../../lib/units/unitExperience'
import type { UnitAppearanceLayerConfig } from '../../types/config'
import type { UnitRuntimeHost } from './UnitTypes'

type RuntimeAppearanceLayer = UnitAppearanceLayerConfig & {
  sprite?: AnimatedSprite
}

type AppearanceLayerRenderState = {
  layer: RuntimeAppearanceLayer
  mountedRiderSheet: string
  mountedSheetOverride?: string
  textures: unknown[]
  mirrored: boolean
  frameIndex: number
  layerZIndex: number
  spritesheet: { data?: { animationSpeed?: number } }
}

const MAIN_SPRITE_LAYER_Z_INDEX = 10

function removeAppearanceLayer(unit: UnitRuntimeHost, spriteKey: number): void {
  const existing = unit.appearanceLayerSprites.get(spriteKey)
  if (!existing) return
  existing.parent?.removeChild(existing)
  existing.destroy({ children: true, texture: false })
  unit.appearanceLayerSprites.delete(spriteKey)
}

function getCachedSpritesheet(id: string) {
  return Assets.cache.has(id) ? Assets.cache.get(id) : undefined
}

function isLayerHiddenByEquipment(unit: UnitRuntimeHost, layer: RuntimeAppearanceLayer): boolean {
  return Boolean(layer.hideWhenEquippedSlots?.some(slot => unit.inventory?.equipped?.[slot]))
}

function clearAppearanceLayers(unit: UnitRuntimeHost): void {
  for (const sprite of unit.appearanceLayerSprites.values()) {
    sprite.parent?.removeChild(sprite)
    sprite.destroy({ children: true, texture: false })
  }
  unit.appearanceLayerSprites.clear()
}

function getLayerRenderState(
  unit: UnitRuntimeHost,
  layer: RuntimeAppearanceLayer,
  sheet: string
): AppearanceLayerRenderState | null {
  const mountedRiderSheet =
    unit.mountedOnHorse && [SHEET_TYPES.standing, SHEET_TYPES.walking].includes(sheet) ? SHEET_TYPES.action : sheet
  const visualSheet =
    sheet === SHEET_TYPES.action ? getActionVisualSheetKey(unit.action, unit.type, unit.work) : mountedRiderSheet
  const actionWorkKey = unit.work && unit.action ? `${unit.work}:${unit.action}` : undefined
  const hasActionWorkSheetOverride = Boolean(actionWorkKey && layer.actionWorkSheetOverrides?.[actionWorkKey])
  const isLayerEnabledForWork =
    !layer.workTypes?.length || (unit.work ? layer.workTypes.includes(unit.work) : false) || hasActionWorkSheetOverride
  const isLayerEnabledForCivilization =
    !layer.civilizations?.length || layer.civilizations.includes(civilizationKey(unit.owner?.civ))
  const unitLevel = getUnitEquipmentLevel(unit)
  const isLayerEnabledForLevel =
    unitLevel >= (layer.minLevel ?? 0) && unitLevel <= (layer.maxLevel ?? Number.POSITIVE_INFINITY)
  const isLayerHiddenByAction = Boolean(unit.action && layer.hideForActions?.includes(unit.action))
  const isLayerHiddenByFrame =
    sheet === SHEET_TYPES.action &&
    typeof layer.hideOnOrAfterFrame === 'number' &&
    unit.sprite.currentFrame >= layer.hideOnOrAfterFrame
  const equipmentKey = layer.equipmentKey
  const isLootedCorpseEquipment =
    unit.isDead &&
    Array.isArray(unit.lootEquipment) &&
    equipmentKey != null &&
    !unit.lootEquipment.includes(equipmentKey)
  const actionWorkSheetOverride = actionWorkKey
    ? layer.actionWorkSheetOverrides?.[actionWorkKey]?.[visualSheet]
    : undefined
  const workSheetOverride = unit.work ? layer.workSheetOverrides?.[unit.work]?.[visualSheet] : undefined
  const ownerAge = Math.max(0, Math.floor(unit.owner?.age ?? 0))
  const ageSheetOverride = getAppearanceAgeSheetOverride(layer.ageSheetOverrides, ownerAge, visualSheet)
  const mountedSheetOverride =
    unit.mountedOnHorse && [SHEET_TYPES.standing, SHEET_TYPES.walking, SHEET_TYPES.action].includes(sheet)
      ? layer.mountedSheet
      : undefined
  const baseSheetId =
    actionWorkSheetOverride ??
    workSheetOverride ??
    mountedSheetOverride ??
    ageSheetOverride ??
    (visualSheet === SHOOTING_SHEET_KEY
      ? layer.shootingSheet
      : (layer[visualSheet as keyof RuntimeAppearanceLayer] as string | undefined))
  const playerColorVariant = unit.owner.color ? layer.playerColorVariants?.[unit.owner.color] : undefined
  const appearanceVariant = layer.appearanceVariantKey
    ? unit.appearanceVariants?.[layer.appearanceVariantKey]
    : undefined
  const variantSheetId =
    baseSheetId && appearanceVariant
      ? `${baseSheetId}/${appearanceVariant}${playerColorVariant ? `/${playerColorVariant}` : ''}`
      : null
  const basePlayerColorSheetId =
    baseSheetId && playerColorVariant ? `${baseSheetId}/${playerColorVariant}` : baseSheetId
  const sheetId = variantSheetId && Assets.cache.has(variantSheetId) ? variantSheetId : basePlayerColorSheetId
  const spritesheet = sheetId ? getCachedSpritesheet(sheetId) : undefined

  if (
    !isLayerEnabledForWork ||
    !isLayerEnabledForCivilization ||
    !isLayerEnabledForLevel ||
    isLayerHiddenByEquipment(unit, layer) ||
    isLayerHiddenByAction ||
    isLayerHiddenByFrame ||
    isLootedCorpseEquipment ||
    !sheetId ||
    !spritesheet?.textures
  ) {
    return null
  }

  const directionCount =
    layer.sheetDirectionCounts?.[mountedRiderSheet] ?? unit.sheetDirectionCounts?.[mountedRiderSheet] ?? null
  const directionOrderOverride = (layer.sheetDirectionOrders?.[mountedRiderSheet] ??
    unit.sheetDirectionOrders?.[mountedRiderSheet] ??
    null) as string[] | null
  const { textures, mirrored } = getSpriteFrameSelection(
    spritesheet.textures,
    unit.degree,
    directionCount,
    directionOrderOverride
  )
  const frameIndex =
    mountedSheetOverride || (unit.mountedOnHorse && sheet !== SHEET_TYPES.action)
      ? 0
      : Math.min(unit.sprite.currentFrame, Math.max(textures.length - 1, 0))

  return {
    layer,
    mountedRiderSheet: visualSheet,
    mountedSheetOverride,
    textures,
    mirrored,
    frameIndex,
    layerZIndex: getAppearanceLayerZIndex({ layer, sheet: mountedRiderSheet }),
    spritesheet,
  }
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
  layerSprite.animationSpeed = state.spritesheet.data?.animationSpeed ?? 0.2
  layerSprite.onFrameChange =
    sheet === SHEET_TYPES.action && typeof state.layer.hideOnOrAfterFrame === 'number'
      ? currentFrame => {
          layerSprite.visible = currentFrame < state.layer.hideOnOrAfterFrame!
        }
      : undefined
  layerSprite.currentFrame = state.frameIndex
  layerSprite.visible =
    sheet === SHEET_TYPES.action && typeof state.layer.hideOnOrAfterFrame === 'number'
      ? state.frameIndex < state.layer.hideOnOrAfterFrame
      : true
  if (state.mountedSheetOverride || (unit.mountedOnHorse && sheet !== SHEET_TYPES.action)) {
    layerSprite.gotoAndStop(state.frameIndex)
  } else if (unit.sprite.playing) {
    layerSprite.gotoAndPlay(state.frameIndex)
  } else {
    layerSprite.gotoAndStop(state.frameIndex)
  }
}

export function syncUnitAppearanceLayers(unit: UnitRuntimeHost, sheet: string): void {
  const layers = unit.appearance?.layers
  if (!layers?.length) {
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
}
