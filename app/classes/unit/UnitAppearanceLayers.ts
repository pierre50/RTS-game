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
import type { Unit } from './index'

type RuntimeAppearanceLayer = UnitAppearanceLayerConfig & {
  sprite?: AnimatedSprite
}

const MAIN_SPRITE_LAYER_Z_INDEX = 10

function removeAppearanceLayer(unit: Unit, spriteKey: number): void {
  const existing = unit.appearanceLayerSprites.get(spriteKey)
  if (!existing) return
  existing.parent?.removeChild(existing)
  existing.destroy({ children: true, texture: false })
  unit.appearanceLayerSprites.delete(spriteKey)
}

function getCachedSpritesheet(id: string) {
  return Assets.cache.has(id) ? Assets.cache.get(id) : undefined
}

export function syncUnitAppearanceLayers(unit: Unit, sheet: string): void {
  const layers = unit.appearance?.layers
  const mountedRiderSheet =
    unit.mountedOnHorse && [SHEET_TYPES.standing, SHEET_TYPES.walking].includes(sheet) ? SHEET_TYPES.action : sheet
  if (!layers?.length) {
    for (const sprite of unit.appearanceLayerSprites.values()) {
      sprite.parent?.removeChild(sprite)
      sprite.destroy({ children: true, texture: false })
    }
    unit.appearanceLayerSprites.clear()
    return
  }

  const heroControlled = isHeroControlled(unit)
  const liveLayers = new Set<number>()
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i] as RuntimeAppearanceLayer
    const actionWorkKey = unit.work && unit.action ? `${unit.work}:${unit.action}` : undefined
    const hasActionWorkSheetOverride = Boolean(actionWorkKey && layer.actionWorkSheetOverrides?.[actionWorkKey])
    const isLayerEnabledForWork =
      !layer.workTypes?.length ||
      (unit.work ? layer.workTypes.includes(unit.work) : false) ||
      hasActionWorkSheetOverride
    const isLayerEnabledForCivilization =
      !layer.civilizations?.length || layer.civilizations.includes(civilizationKey(unit.owner?.civ))
    const unitLevel = getUnitEquipmentLevel(unit)
    const isLayerEnabledForLevel =
      unitLevel >= (layer.minLevel ?? 0) && unitLevel <= (layer.maxLevel ?? Number.POSITIVE_INFINITY)
    const isLoading = (unit.loading ?? 0) > 0
    const isLayerHiddenByLoading = isAppearanceLayerHiddenByLoading({
      layer,
      isLoading,
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
      unit.isDead &&
      Array.isArray(unit.lootEquipment) &&
      equipmentKey != null &&
      !unit.lootEquipment.includes(equipmentKey)
    const loadedSheetOverride =
      !unit.mountedOnHorse && unit.loading && sheet === SHEET_TYPES.walking
        ? (layer.loadedSheet as string | undefined)
        : undefined
    const actionWorkSheetOverride = actionWorkKey
      ? layer.actionWorkSheetOverrides?.[actionWorkKey]?.[mountedRiderSheet]
      : undefined
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
    const spriteKey = i
    const layerZIndex = getAppearanceLayerZIndex({ layer, sheet: mountedRiderSheet })
    liveLayers.add(spriteKey)

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
      removeAppearanceLayer(unit, spriteKey)
      continue
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

    let layerSprite = unit.appearanceLayerSprites.get(spriteKey)
    const frameIndex =
      mountedSheetOverride || (unit.mountedOnHorse && sheet !== SHEET_TYPES.action)
        ? 0
        : Math.min(unit.sprite.currentFrame, Math.max(textures.length - 1, 0))

    if (!layerSprite) {
      layerSprite = new AnimatedSprite(textures as Texture[])
      bindAnimatedSpriteToTicker(layerSprite, unit.context.app)
      layerSprite.label = `${LABEL_TYPES.sprite}-layer-${spriteKey}`
      layerSprite.eventMode = 'none'
      layerSprite.position.x = unit.getMountedRiderX()
      layerSprite.position.y = unit.getMountedRiderY()
      layerSprite.roundPixels = true
      layerSprite.loop = unit.loop ?? true
      layerSprite.updateAnchor = true
      layerSprite.zIndex = layerZIndex
      if (layerZIndex < MAIN_SPRITE_LAYER_Z_INDEX) {
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
    layerSprite.zIndex = layerZIndex
    layerSprite.textures = textures as Texture[]
    if (layer.palette === 'player') {
      changeSpriteColor(layerSprite, unit.owner.color ?? '')
    } else {
      layerSprite.filters = null
    }
    const spriteScale = unit.spriteScale ?? 1
    layerSprite.scale.x = mirrored ? -spriteScale : spriteScale
    layerSprite.scale.y = spriteScale
    const defaultAnchor = (layerSprite.textures[0] as Texture & { defaultAnchor?: { x: number; y: number } })
      .defaultAnchor
    if (defaultAnchor) {
      layerSprite.anchor.set(defaultAnchor.x, defaultAnchor.y)
    }
    layerSprite.animationSpeed = spritesheet.data?.animationSpeed ?? 0.18
    layerSprite.onFrameChange =
      sheet === SHEET_TYPES.action && typeof layer.hideOnOrAfterFrame === 'number'
        ? currentFrame => {
            layerSprite.visible = currentFrame < layer.hideOnOrAfterFrame!
          }
        : undefined
    layerSprite.currentFrame = frameIndex
    layerSprite.visible =
      sheet === SHEET_TYPES.action && typeof layer.hideOnOrAfterFrame === 'number'
        ? frameIndex < layer.hideOnOrAfterFrame
        : true
    if (mountedSheetOverride || (unit.mountedOnHorse && sheet !== SHEET_TYPES.action)) {
      layerSprite.gotoAndStop(frameIndex)
    } else if (unit.sprite.playing) {
      layerSprite.gotoAndPlay(frameIndex)
    } else {
      layerSprite.gotoAndStop(frameIndex)
    }
  }

  for (const [spriteKey, sprite] of unit.appearanceLayerSprites.entries()) {
    if (liveLayers.has(spriteKey)) continue
    sprite.parent?.removeChild(sprite)
    sprite.destroy({ children: true, texture: false })
    unit.appearanceLayerSprites.delete(spriteKey)
  }
}
