import { resolveForgeEquipment, type ForgeUpgradeOwner } from '../equipment/forgeUpgrades'
import { definedProperties } from '../definedProperties'
import { SHEET_TYPES } from '../../constants'
import { lpcAnimationSpeedForSheet } from './animationSpeeds'
import type { UnitAppearanceLayerConfig } from '../../types/config'
import {
  ACTION_BACKED_SHOOTING_EQUIPMENT_KEYS,
  BACK_WORN_DEATH_EQUIPMENT_KEYS,
  BACK_WORN_DEATH_Z_INDEX,
  DYNAMIC_EQUIPMENT_KEYS,
  EQUIPMENT_LAYERS,
  EQUIPMENT_LAYER_OVERRIDES,
  EQUIPMENT_LAYER_Z_INDEX,
  EQUIPMENT_SHEETS,
  EQUIPMENT_SHEET_OVERRIDES,
  EQUIPMENT_SHOOTING_SHEET,
  GENDERED_EQUIPMENT_KEYS,
  HELMET_DECOR_DEATH_Z_INDEX,
  HELMET_DECOR_EQUIPMENT_KEYS,
  MOUNTED_UNCUT_EQUIPMENT_KEYS,
  MOUNTED_WALKING_SHEET_EQUIPMENT_KEYS,
  NON_SLASH_ACTION_EQUIPMENT_KEYS,
  PLAYER_COLORED_EQUIPMENT_KEYS,
  UNIT_EQUIPMENT,
  VILLAGER_WORK_EQUIPMENT,
  WEARABLE_EQUIPMENT_KEYS,
  WEARABLE_EQUIPMENT_Z_INDEX,
  WEARABLE_SHOOTING_EQUIPMENT_KEYS,
  isEquipmentEnabledForCivilization,
  type DynamicEquipmentAlias,
  type DynamicEquipmentAsset,
  type DynamicEquipmentKey,
  type EquipmentLayer,
  type EquipmentLoadSheet,
  type EquipmentOptions,
  type EquipmentSheet,
  type UnitEquipmentDefinition,
  type UnitEquipmentEntry,
} from './equipmentData'
import {
  equipmentAlias,
  equipmentFamilyAlias,
  equipmentFamilySrc,
  equipmentVariantAlias,
  frameSuffixForAlias,
} from './equipmentPaths'

export { DYNAMIC_EQUIPMENT_KEYS, civilizationKey } from './equipmentData'
export type { DynamicEquipmentAlias, DynamicEquipmentKey } from './equipmentData'

function animationSpeedForEquipmentSheet(equipment: DynamicEquipmentKey, sheet: EquipmentLoadSheet): number {
  return lpcAnimationSpeedForSheet(sheet, { slashAction: !NON_SLASH_ACTION_EQUIPMENT_KEYS.has(equipment) })
}

function equipmentSheets(equipment: DynamicEquipmentKey, layer: EquipmentLayer): readonly EquipmentSheet[] {
  return EQUIPMENT_SHEET_OVERRIDES[equipment]?.[layer] ?? EQUIPMENT_SHEETS
}

function unitEquipmentEntry(definition: UnitEquipmentDefinition): UnitEquipmentEntry {
  return typeof definition === 'string' ? { equipment: definition } : definition
}

export function dynamicEquipmentVisualKey(equipment: string): DynamicEquipmentKey | null {
  if (equipment === 'catchingPole') return 'longstick'
  return DYNAMIC_EQUIPMENT_KEYS.includes(equipment as DynamicEquipmentKey) ? (equipment as DynamicEquipmentKey) : null
}

function isEquipmentUnlocked(entry: Pick<UnitEquipmentEntry, 'minLevel' | 'maxLevel'>, level = 0): boolean {
  return level >= (entry.minLevel ?? 0) && level <= (entry.maxLevel ?? Number.POSITIVE_INFINITY)
}

function layerConfig(
  equipment: DynamicEquipmentKey,
  layer: EquipmentLayer,
  options: EquipmentOptions = {}
): UnitAppearanceLayerConfig {
  const sheets = equipmentSheets(equipment, layer)
  const walkingSheet = sheets.includes('walking') ? equipmentAlias(equipment, layer, 'walking') : undefined
  const actionSheet = sheets.includes('action') ? equipmentAlias(equipment, layer, 'action') : undefined
  const shootingSheet = WEARABLE_SHOOTING_EQUIPMENT_KEYS.has(equipment)
    ? ACTION_BACKED_SHOOTING_EQUIPMENT_KEYS.has(equipment)
      ? actionSheet
      : equipmentAlias(equipment, layer, EQUIPMENT_SHOOTING_SHEET)
    : undefined
  const dyingSheet = sheets.includes('dying') ? equipmentAlias(equipment, layer, 'dying') : undefined
  const corpseSheet = sheets.includes('corpse') ? equipmentAlias(equipment, layer, 'corpse') : undefined

  return definedProperties({
    zIndex:
      layer === 'front' && WEARABLE_EQUIPMENT_KEYS.has(equipment)
        ? WEARABLE_EQUIPMENT_Z_INDEX
        : EQUIPMENT_LAYER_Z_INDEX[layer],
    deathZIndex: HELMET_DECOR_EQUIPMENT_KEYS.has(equipment)
      ? HELMET_DECOR_DEATH_Z_INDEX
      : layer === 'back' && BACK_WORN_DEATH_EQUIPMENT_KEYS.has(equipment)
        ? BACK_WORN_DEATH_Z_INDEX
        : undefined,
    ...options,
    appearanceVariantKey: GENDERED_EQUIPMENT_KEYS.has(equipment) ? 'gender' : undefined,
    palette: PLAYER_COLORED_EQUIPMENT_KEYS.has(equipment) ? 'player' : undefined,
    mountedCut: MOUNTED_UNCUT_EQUIPMENT_KEYS.has(equipment) ? false : options.mountedCut,
    equipmentKey: equipment,
    standingSheet: walkingSheet,
    walkingSheet,
    mountedSheet: MOUNTED_WALKING_SHEET_EQUIPMENT_KEYS.has(equipment) ? walkingSheet : undefined,
    actionSheet,
    shootingSheet,
    dyingSheet,
    corpseSheet,
    sheetDirectionCounts: {
      [SHEET_TYPES.standing]: 3,
      [SHEET_TYPES.walking]: 3,
      [SHEET_TYPES.action]: 3,
      ...(dyingSheet ? { [SHEET_TYPES.dying]: 1 } : {}),
      ...(corpseSheet ? { [SHEET_TYPES.corpse]: 1 } : {}),
    },
  })
}

function equipmentLayerConfigs(
  equipment: DynamicEquipmentKey,
  options: EquipmentOptions = {}
): UnitAppearanceLayerConfig[] {
  const layers = EQUIPMENT_LAYER_OVERRIDES[equipment] ?? EQUIPMENT_LAYERS
  return layers.map(layer => layerConfig(equipment, layer, options))
}

function dynamicEquipmentLogicalAliases(): DynamicEquipmentAlias[] {
  return DYNAMIC_EQUIPMENT_KEYS.flatMap(equipment =>
    (EQUIPMENT_LAYER_OVERRIDES[equipment] ?? EQUIPMENT_LAYERS).flatMap(layer => {
      const sheetsToLoad: EquipmentLoadSheet[] = [...equipmentSheets(equipment, layer)]
      if (WEARABLE_SHOOTING_EQUIPMENT_KEYS.has(equipment) && !ACTION_BACKED_SHOOTING_EQUIPMENT_KEYS.has(equipment)) {
        sheetsToLoad.push(EQUIPMENT_SHOOTING_SHEET)
      }
      return sheetsToLoad.flatMap(sheet => {
        if (GENDERED_EQUIPMENT_KEYS.has(equipment)) {
          return ['male', 'female'].map(variant => {
            const alias = equipmentVariantAlias(equipment, layer, sheet, variant)
            return {
              alias,
              atlasAlias: equipmentFamilyAlias(equipment),
              animationSpeed: animationSpeedForEquipmentSheet(equipment, sheet),
              frameSuffix: frameSuffixForAlias(alias),
            }
          })
        }
        const alias = equipmentAlias(equipment, layer, sheet)
        return [
          {
            alias,
            atlasAlias: equipmentFamilyAlias(equipment),
            animationSpeed: animationSpeedForEquipmentSheet(equipment, sheet),
            frameSuffix: frameSuffixForAlias(alias),
          },
        ]
      })
    })
  )
}

export function dynamicEquipmentAssets(): DynamicEquipmentAsset[] {
  const seen = new Set<string>()
  return DYNAMIC_EQUIPMENT_KEYS.flatMap(equipment => {
    const alias = equipmentFamilyAlias(equipment)
    if (seen.has(alias)) return []
    seen.add(alias)
    return [{ alias, src: equipmentFamilySrc(equipment) }]
  })
}

export function isDynamicEquipmentKey(value: string): value is DynamicEquipmentKey {
  return DYNAMIC_EQUIPMENT_KEYS.includes(value as DynamicEquipmentKey)
}

export function dynamicEquipmentAsset(equipment: DynamicEquipmentKey): DynamicEquipmentAsset {
  return { alias: equipmentFamilyAlias(equipment), src: equipmentFamilySrc(equipment) }
}

export function dynamicEquipmentAliases(): DynamicEquipmentAlias[] {
  return dynamicEquipmentLogicalAliases()
}

export function dynamicEquipmentLayersForUnit(unitType: string, civilization?: string): UnitAppearanceLayerConfig[] {
  return (UNIT_EQUIPMENT[unitType] ?? []).flatMap(definition => {
    const { equipment, civilizations, minLevel, maxLevel, options } = unitEquipmentEntry(definition)
    if (!isEquipmentEnabledForCivilization({ civilizations }, civilization)) return []
    return equipmentLayerConfigs(equipment, definedProperties({ ...options, civilizations, minLevel, maxLevel }))
  })
}

export function dynamicEquipmentLayersForVillager(): UnitAppearanceLayerConfig[] {
  return VILLAGER_WORK_EQUIPMENT.flatMap(({ workType, equipment, options }) =>
    equipmentLayerConfigs(equipment, definedProperties({ ...options, workTypes: [workType] }))
  )
}

export function dynamicEquipmentLayersForEquipment(equipment: readonly string[]): UnitAppearanceLayerConfig[] {
  return equipment.flatMap(item => {
    const visualEquipment = dynamicEquipmentVisualKey(item)
    return visualEquipment ? equipmentLayerConfigs(visualEquipment) : []
  })
}

export function dynamicEquipmentForUnit(
  unitType: string,
  owner: ForgeUpgradeOwner = {},
  level = 0,
  civilization?: string
): string[] {
  return (UNIT_EQUIPMENT[unitType] ?? []).flatMap(definition => {
    const { equipment, civilizations, minLevel, maxLevel } = unitEquipmentEntry(definition)
    if (!isEquipmentEnabledForCivilization({ civilizations }, civilization)) return []
    if (!isEquipmentUnlocked({ minLevel, maxLevel }, level)) return []
    return resolveForgeEquipment(equipment, owner)
  })
}

export function dynamicEquipmentForWork(workType: string | null | undefined, owner: ForgeUpgradeOwner = {}): string[] {
  if (!workType) return []
  return VILLAGER_WORK_EQUIPMENT.filter(({ workType: equipmentWork }) => equipmentWork === workType).map(
    ({ equipment }) => resolveForgeEquipment(equipment, owner)
  )
}
