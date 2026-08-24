import { Assets, AnimatedSprite } from 'pixi.js'
import type { Texture } from 'pixi.js'
import { LABEL_TYPES, SHEET_TYPES, UNIT_TYPES, WORK_TYPES } from '../../constants'
import {
  bindAnimatedSpriteToTicker,
  changeSpriteColor,
  getSpriteFrameSelection,
} from '../../lib'
import {
  getAppearanceAgeSheetOverride,
  getAppearanceLayerZIndex,
  isAppearanceLayerHiddenByLoading,
} from '../../lib/lpc/appearanceLayers'
import { civilizationKey } from '../../lib/lpc/equipment'
import { getUnitEquipmentLevel } from '../../lib/unitExperience'
import { isHeroControlled } from '../../lib/unitControl'
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
  const heroControlled = isHeroControlled(unit)
  const actionWorkKey = unit.work && unit.action ? `${unit.work}:${unit.action}` : undefined
  const hasActionWorkSheetOverride = Boolean(actionWorkKey && layer.actionWorkSheetOverrides?.[actionWorkKey])
  const isLayerEnabledForWork =
    !layer.workTypes?.length || (unit.work ? layer.workTypes.includes(unit.work) : false) || hasActionWorkSheetOverride
  const isLayerEnabledForCivilization =
    !layer.civilizations?.length || layer.civilizations.includes(civilizationKey(unit.owner?.civ))
  const unitLevel = getUnitEquipmentLevel(unit)
  const isLayerEnabledForLevel =
    unitLevel >= (layer.minLevel ?? 0) && unitLevel <= (layer.maxLevel ?? Number.POSITIVE_INFINITY)
  const isLayerHiddenByLoading = isAppearanceLayerHiddenByLoading({
    layer,
    isLoading: (unit.loading ?? 0) > 0,
    sheet,
    heroControlled,
  })
  const isLayerHiddenByAction = Boolean(unit.action && layer.hideForActions?.includes(unit.action))
  const isLayerHiddenByFrame =
    sheet === SHEET_TYPES.action &&
    typeof layer.hideOnOrAfterFrame === 'number' &&
    unit.sprite.currentFrame >= layer.hideOnOrAfterFrame
  const equipmentKey = layer.equipmentKey
  const isLootedCorpseEquipment =
    unit.isDead && Array.isArray(unit.lootEquipment) && equipmentKey != null && !unit.lootEquipment.includes(equipmentKey)
  const loadedSheetOverride =
    !unit.mountedOnHorse && unit.loading && sheet === SHEET_TYPES.walking ? (layer.loadedSheet as string | undefined) : undefined
  const actionWorkSheetOverride = actionWorkKey ? layer.actionWorkSheetOverrides?.[actionWorkKey]?.[mountedRiderSheet] : undefined
  const workSheetOverride = unit.work ? layer.workSheetOverrides?.[unit.work]?.[mountedRiderSheet] : undefined
  const ownerAge = Math.max(0, Math.floor(unit.owner?.age ?? 0))
  const ageSheetOverride = getAppearanceAgeSheetOverride(layer.ageSheetOverrides, ownerAge, mountedRiderSheet)
  const isRangedActionSheet =
    sheet === SHEET_TYPES.action && (unit.type === UNIT_TYPES.bowman || unit.work === WORK_TYPES.hunter)
  const shootingSheetOverride = isRangedActionSheet
    ? getAppearanceAgeSheetOverride(layer.ageSheetOverrides, ownerAge, 'shootingSheet') ?? layer.shootingSheet
    : undefined
  const mountedSheetOverride =
    unit.mountedOnHorse && [SHEET_TYPES.standing, SHEET_TYPES.walking, SHEET_TYPES.action].includes(sheet)
      ? layer.mountedSheet
      : undefined
  const baseSheetId =
    loadedSheetOverride ??
    shootingSheetOverride ??
    actionWorkSheetOverride ??
    workSheetOverride ??
    mountedSheetOverride ??
    ageSheetOverride ??
    (layer[mountedRiderSheet as keyof RuntimeAppearanceLayer] as string | undefined)
  const playerColorVariant = unit.owner.color ? layer.playerColorVariants?.[unit.owner.color] : undefined
  const appearanceVariant = layer.appearanceVariantKey ? unit.appearanceVariants?.[layer.appearanceVariantKey] : undefined
  const variantSheetId =
    baseSheetId && appearanceVariant
      ? `${baseSheetId}/${appearanceVariant}${playerColorVariant ? `/${playerColorVariant}` : ''}`
      : null
  const basePlayerColorSheetId = baseSheetId && playerColorVariant ? `${baseSheetId}/${playerColorVariant}` : baseSheetId
  const sheetId = variantSheetId && Assets.cache.has(variantSheetId) ? variantSheetId : basePlayerColorSheetId
  const spritesheet = sheetId ? getCachedSpritesheet(sheetId) : undefined

  if (
    !isLayerEnabledForWork ||
    !isLayerEnabledForCivilization ||
    !isLayerEnabledForLevel ||
    isLayerHiddenByLoading ||
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

  return { layer, mountedRiderSheet, mountedSheetOverride, textures, mirrored, frameIndex, layerZIndex: getAppearanceLayerZIndex({ layer, sheet: mountedRiderSheet }), spritesheet }
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
  } else {
    layerSprite.filters = null
  }
  const spriteScale = unit.spriteScale ?? 1
  layerSprite.scale.x = state.mirrored ? -spriteScale : spriteScale
  layerSprite.scale.y = spriteScale
  const defaultAnchor = (layerSprite.textures[0] as Texture & { defaultAnchor?: { x: number; y: number } }).defaultAnchor
  if (defaultAnchor) layerSprite.anchor.set(defaultAnchor.x, defaultAnchor.y)
  layerSprite.animationSpeed = state.spritesheet.data?.animationSpeed ?? 0.18
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
