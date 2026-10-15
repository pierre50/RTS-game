import { getEquippedWorkTool, workToolFamily } from '../../../lib/equipment/workTools'
import { equipmentBaseKey } from '../../../lib/equipment/equipmentCondition'
import { hasNpcWeaponInventory, getNpcWeaponChoice, isNpcWeaponItem } from '../../../lib/units/combat/npcWeapons'
import { equipmentVisualParts } from '../../../lib/equipment/helmetVariants'
import { isInactiveArcherWeapon, usesArcherDagger } from '../../../lib/units/combat/unitArrows'
import { resolveUnitForgeEquipment } from '../../../lib/equipment/forgeUpgrades'
import { getMiningPickaxe } from '../../../lib/resources/miningEquipment'
import { definedProperties } from '../../../lib/definedProperties'
import { Assets } from 'pixi.js'
import type { AnimatedSprite } from 'pixi.js'
import { ACTION_TYPES, SHEET_TYPES, WORK_TYPES } from '../../../constants'
import { isSowingPlacement } from '../../../lib/buildings/campConstruction'
import { getSpriteFrameSelection } from '../../../lib'
import {
  applyActionFrameSequence,
  getConfiguredActionFrameSequence,
} from '../../../lib/animations/actionFrameSequences'
import { getAppearanceLayerZIndex } from '../../../lib/lpc/appearanceLayers'
import { civilizationKey, dynamicEquipmentAsset } from '../../../lib/lpc/equipment'
import type { DynamicEquipmentKey } from '../../../lib/lpc/equipmentData'
import { loadDynamicEquipmentAssetQueued } from '../../../lib/lpc/lazyEquipmentAssets'
import { getActionVisualSheetKey, SHOOTING_SHEET_KEY } from '../../../lib/units/visuals/actionVisualSheet'
import { getUnitEquipmentTier } from '../../../lib/units/unitExperience'
import type { UnitAppearanceLayerConfig } from '../../../types/config'
import type { UnitRuntimeHost } from '../UnitTypes'

export type RuntimeAppearanceLayer = UnitAppearanceLayerConfig & {
  sprite?: AnimatedSprite
}

export type AppearanceLayerRenderState = {
  layer: RuntimeAppearanceLayer
  mountedRiderSheet: string
  mountedSheetOverride?: string
  textures: unknown[]
  mirrored: boolean
  frameIndex: number
  layerZIndex: number
  spritesheet: { data?: { animationSpeed?: number } }
}

// A loaded atlas can legitimately omit a layer/animation. Remember completed
// attempts too, or the appearance refresh recursively queues the same atlas.
const equipmentRequests = new WeakMap<UnitRuntimeHost, Map<string, number>>()

function resolveAppearanceEquipment(unit: UnitRuntimeHost, item: string): string {
  if (!unit.isDead && unit.inventory?.toolsInitialized && workToolFamily(item))
    return equipmentBaseKey(getEquippedWorkTool(unit) ?? item)
  return (!unit.action || unit.action === 'attack') && hasNpcWeaponInventory(unit) && isNpcWeaponItem(item, unit)
    ? item
    : resolveUnitForgeEquipment(item, unit)
}

function shouldRequestMissingEquipmentLayer(unit: UnitRuntimeHost): boolean {
  if (!unit.context.map.ready) return false
  return unit.controlMode === 'hero' || Boolean(unit.visible)
}

function requestMissingEquipmentLayer(unit: UnitRuntimeHost, layer: RuntimeAppearanceLayer): void {
  if (!shouldRequestMissingEquipmentLayer(unit)) return
  const equipmentKey = (
    layer.equipmentKey?.startsWith('pickaxe_')
      ? getMiningPickaxe(unit)
      : layer.equipmentKey
        ? resolveAppearanceEquipment(unit, layer.equipmentKey)
        : undefined
  ) as DynamicEquipmentKey | undefined
  if (!equipmentKey) return
  const atlasAlias = dynamicEquipmentAsset(equipmentKey).alias
  let requests = equipmentRequests.get(unit)
  if (!requests) {
    requests = new Map()
    equipmentRequests.set(unit, requests)
  }
  if (performance.now() < (requests.get(atlasAlias) ?? 0)) return
  requests.set(atlasAlias, Number.POSITIVE_INFINITY)
  const request = loadDynamicEquipmentAssetQueued(
    equipmentKey,
    definedProperties({
      metricName: 'lazyEquipment.loadAsset',
      performanceMonitor: unit.context.performance,
    })
  )
  void request
    .then(() => {
      if (!unit.isDestroyed) unit.syncAppearanceLayers?.(unit.currentSheet)
    })
    .catch(error => {
      requests.set(atlasAlias, performance.now() + 5000)
      console.warn(`Unable to load equipment appearance "${equipmentKey}"`, error)
    })
}

function getCachedSpritesheet(id: string) {
  return Assets.cache.has(id) ? Assets.cache.get(id) : undefined
}

function isLayerHiddenByEquipment(unit: UnitRuntimeHost, layer: RuntimeAppearanceLayer): boolean {
  return Boolean(layer.hideWhenEquippedSlots?.some(slot => unit.inventory?.equipped?.[slot]))
}

export function getLayerRenderState(
  unit: UnitRuntimeHost,
  layer: RuntimeAppearanceLayer,
  sheet: string
): AppearanceLayerRenderState | null {
  const mountedRiderSheet =
    unit.mountedOnHorse && [SHEET_TYPES.standing, SHEET_TYPES.walking].includes(sheet) ? SHEET_TYPES.action : sheet
  const visualSheet =
    sheet === SHEET_TYPES.action
      ? unit.action === 'attack' && hasNpcWeaponInventory(unit)
        ? getNpcWeaponChoice(unit).kind === 'ranged'
          ? SHOOTING_SHEET_KEY
          : SHEET_TYPES.action
        : getActionVisualSheetKey(unit.action, unit.type, unit.work, usesArcherDagger(unit))
      : mountedRiderSheet
  const actionWorkKey = unit.work && unit.action ? `${unit.work}:${unit.action}` : undefined
  const enabled = isLayerEnabled(unit, layer, actionWorkKey)
  const hidden = isLayerHidden(unit, layer, sheet)
  if (!enabled || hidden) return null
  const { baseSheetId, mountedSheetOverride } = getLayerSheet(unit, layer, sheet, visualSheet, actionWorkKey)
  const sheetId = getVariantSheetId(unit, layer, baseSheetId)
  const spritesheet = sheetId ? getCachedSpritesheet(sheetId) : undefined

  if (!sheetId || !spritesheet?.textures) {
    if (sheetId && !spritesheet?.textures) requestMissingEquipmentLayer(unit, layer)
    return null
  }

  return buildLayerFrameState(unit, layer, sheet, mountedRiderSheet, visualSheet, mountedSheetOverride, spritesheet)
}

function isLayerEnabled(unit: UnitRuntimeHost, layer: RuntimeAppearanceLayer, actionWorkKey: string | undefined) {
  const hasActionWorkSheetOverride = Boolean(actionWorkKey && layer.actionWorkSheetOverrides?.[actionWorkKey])
  const isLayerEnabledForWork =
    !layer.workTypes?.length || (unit.work ? layer.workTypes.includes(unit.work) : false) || hasActionWorkSheetOverride
  const isLayerEnabledForCivilization =
    !layer.civilizations?.length || layer.civilizations.includes(civilizationKey(unit.owner?.civ))
  const unitLevel = getUnitEquipmentTier(unit)
  const isLayerEnabledForLevel =
    unitLevel >= (layer.minLevel ?? 0) && unitLevel <= (layer.maxLevel ?? Number.POSITIVE_INFINITY)
  return isLayerEnabledForWork && isLayerEnabledForCivilization && isLayerEnabledForLevel
}

function isLayerHidden(unit: UnitRuntimeHost, layer: RuntimeAppearanceLayer, sheet: string) {
  if (
    !unit.isDead &&
    unit.inventory?.toolsInitialized &&
    workToolFamily(layer.equipmentKey) &&
    workToolFamily(layer.equipmentKey) !== workToolFamily(getEquippedWorkTool(unit))
  )
    return true
  if (
    !hasNpcWeaponInventory(unit) &&
    !unit.isDead &&
    layer.equipmentKey &&
    isInactiveArcherWeapon(unit, layer.equipmentKey)
  )
    return true
  // Sowing keeps the builder's slash animation, but uses bare hands.
  const isSowingTool =
    Boolean(layer.equipmentKey && layer.workTypes?.includes(WORK_TYPES.builder)) &&
    unit.action === ACTION_TYPES.build &&
    isSowingPlacement(unit.dest?.type ?? '')
  const isLayerHiddenByAction = Boolean(unit.action && layer.hideForActions?.includes(unit.action))
  const isLayerHiddenByFrame =
    sheet === SHEET_TYPES.action &&
    typeof layer.hideOnOrAfterFrame === 'number' &&
    unit.sprite.currentFrame >= layer.hideOnOrAfterFrame
  const equipmentKey = layer.equipmentKey && resolveAppearanceEquipment(unit, layer.equipmentKey)
  const isLootedCorpseEquipment =
    unit.isDead &&
    Array.isArray(unit.lootEquipment) &&
    equipmentKey != null &&
    !unit.lootEquipment.some(item => equipmentVisualParts(item).includes(equipmentKey))
  return (
    isSowingTool ||
    isLayerHiddenByAction ||
    isLayerHiddenByFrame ||
    isLootedCorpseEquipment ||
    isLayerHiddenByEquipment(unit, layer)
  )
}

function getVariantSheetId(unit: UnitRuntimeHost, layer: RuntimeAppearanceLayer, baseSheetId: string | undefined) {
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
  return sheetId
}

function getLayerSheet(
  unit: UnitRuntimeHost,
  layer: RuntimeAppearanceLayer,
  sheet: string,
  visualSheet: string,
  actionWorkKey: string | undefined
) {
  const actionWorkSheetOverride = actionWorkKey
    ? layer.actionWorkSheetOverrides?.[actionWorkKey]?.[visualSheet]
    : undefined
  const workSheetOverride = unit.work ? layer.workSheetOverrides?.[unit.work]?.[visualSheet] : undefined
  const mountedSheetOverride =
    unit.mountedOnHorse && [SHEET_TYPES.standing, SHEET_TYPES.walking, SHEET_TYPES.action].includes(sheet)
      ? layer.mountedSheet
      : undefined
  const baseSheetId =
    actionWorkSheetOverride ??
    workSheetOverride ??
    mountedSheetOverride ??
    (visualSheet === SHOOTING_SHEET_KEY
      ? layer.shootingSheet
      : (layer[visualSheet as keyof RuntimeAppearanceLayer] as string | undefined))
  const equipmentSheetId = layer.equipmentKey
    ? baseSheetId?.replace(
        /^equipments\/([^/]+)\//,
        (_match, key: string) => `equipments/${resolveAppearanceEquipment(unit, key)}/`
      )
    : baseSheetId
  const workSheetId = layer.equipmentKey?.startsWith('pickaxe_')
    ? equipmentSheetId?.replace(/^equipments\/pickaxe_[^/]+\//, `equipments/${getMiningPickaxe(unit)}/`)
    : equipmentSheetId
  return { baseSheetId: workSheetId, mountedSheetOverride }
}

function buildLayerFrameState(
  unit: UnitRuntimeHost,
  layer: RuntimeAppearanceLayer,
  sheet: string,
  mountedRiderSheet: string,
  visualSheet: string,
  mountedSheetOverride: string | undefined,
  spritesheet: NonNullable<ReturnType<typeof getCachedSpritesheet>>
): AppearanceLayerRenderState {
  const directionCount =
    layer.sheetDirectionCounts?.[mountedRiderSheet] ?? unit.sheetDirectionCounts?.[mountedRiderSheet] ?? null
  const directionOrderOverride = (layer.sheetDirectionOrders?.[mountedRiderSheet] ??
    unit.sheetDirectionOrders?.[mountedRiderSheet] ??
    null) as string[] | null
  const { textures: selectedTextures, mirrored } = getSpriteFrameSelection(
    spritesheet.textures,
    unit.degree,
    directionCount,
    directionOrderOverride
  )
  const sourceFrame = Math.floor(unit.sprite.currentFrame)
  const actionFrameSequence = getConfiguredActionFrameSequence(unit, layer.actionFrameSequence, {
    preferExplicit: true,
  })
  const textures =
    sheet === SHEET_TYPES.action ? applyActionFrameSequence(selectedTextures, actionFrameSequence) : selectedTextures
  const frameIndex =
    mountedSheetOverride || (unit.mountedOnHorse && sheet !== SHEET_TYPES.action)
      ? 0
      : Math.min(sourceFrame, Math.max(textures.length - 1, 0))

  return {
    layer,
    mountedRiderSheet: visualSheet,
    ...definedProperties({ mountedSheetOverride }),
    textures,
    mirrored,
    frameIndex,
    layerZIndex: getAppearanceLayerZIndex({ layer, sheet: mountedRiderSheet }),
    spritesheet,
  }
}
