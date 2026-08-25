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
  type AgeEquipmentOverrides,
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

function equipmentForAge(equipment: DynamicEquipmentKey, ageEquipment: AgeEquipmentOverrides | undefined, age = 0) {
  const ownerAge = Math.max(0, Math.floor(age))
  if (!ageEquipment) return equipment
  const exact = ageEquipment[ownerAge]
  if (exact) return exact
  const fallbackAge = Object.keys(ageEquipment)
    .map(Number)
    .filter(age => age <= ownerAge)
    .sort((a, b) => b - a)[0]
  return fallbackAge == null ? equipment : (ageEquipment[fallbackAge] ?? equipment)
}

function unitEquipmentEntry(definition: UnitEquipmentDefinition): UnitEquipmentEntry {
  return typeof definition === 'string' ? { equipment: definition } : definition
}

function isEquipmentUnlocked(entry: Pick<UnitEquipmentEntry, 'minLevel' | 'maxLevel'>, level = 0): boolean {
  return level >= (entry.minLevel ?? 0) && level <= (entry.maxLevel ?? Number.POSITIVE_INFINITY)
}

function ageSheetOverrides(layer: EquipmentLayer, ageEquipment?: AgeEquipmentOverrides) {
  if (!ageEquipment) return undefined
  return Object.fromEntries(
    Object.entries(ageEquipment).flatMap(([age, equipment]) => {
      if (!equipment) return []
      const sheets = equipmentSheets(equipment, layer)
      return [
        [
          age,
          {
            ...(sheets.includes('walking') ? { standingSheet: equipmentAlias(equipment, layer, 'walking') } : {}),
            ...(sheets.includes('walking') ? { walkingSheet: equipmentAlias(equipment, layer, 'walking') } : {}),
            ...(sheets.includes('action') ? { actionSheet: equipmentAlias(equipment, layer, 'action') } : {}),
            ...(WEARABLE_SHOOTING_EQUIPMENT_KEYS.has(equipment)
              ? {
                  shootingSheet: equipmentAlias(
                    equipment,
                    layer,
                    ACTION_BACKED_SHOOTING_EQUIPMENT_KEYS.has(equipment) ? 'action' : EQUIPMENT_SHOOTING_SHEET
                  ),
                }
              : {}),
            ...(sheets.includes('dying') ? { dyingSheet: equipmentAlias(equipment, layer, 'dying') } : {}),
            ...(sheets.includes('corpse') ? { corpseSheet: equipmentAlias(equipment, layer, 'corpse') } : {}),
          },
        ],
      ]
    })
  )
}

function layerConfig(
  equipment: DynamicEquipmentKey,
  layer: EquipmentLayer,
  options: EquipmentOptions = {},
  ageEquipment?: AgeEquipmentOverrides
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

  return {
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
    ageSheetOverrides: ageSheetOverrides(layer, ageEquipment),
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
  }
}

function equipmentLayerConfigs(
  equipment: DynamicEquipmentKey,
  options: EquipmentOptions = {},
  ageEquipment?: AgeEquipmentOverrides
): UnitAppearanceLayerConfig[] {
  const layers = EQUIPMENT_LAYER_OVERRIDES[equipment] ?? EQUIPMENT_LAYERS
  return layers.map(layer => layerConfig(equipment, layer, options, ageEquipment))
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

export function dynamicEquipmentAliases(): DynamicEquipmentAlias[] {
  return dynamicEquipmentLogicalAliases()
}

export function dynamicEquipmentLayersForUnit(unitType: string, civilization?: string): UnitAppearanceLayerConfig[] {
  return (UNIT_EQUIPMENT[unitType] ?? []).flatMap(definition => {
    const { equipment, ageEquipment, civilizations, minLevel, maxLevel, options } = unitEquipmentEntry(definition)
    if (!isEquipmentEnabledForCivilization({ civilizations }, civilization)) return []
    return equipmentLayerConfigs(equipment, { ...options, civilizations, minLevel, maxLevel }, ageEquipment)
  })
}

export function dynamicEquipmentLayersForVillager(): UnitAppearanceLayerConfig[] {
  return VILLAGER_WORK_EQUIPMENT.flatMap(({ workType, equipment, ageEquipment, options }) =>
    equipmentLayerConfigs(equipment, { ...options, workTypes: [workType] }, ageEquipment)
  )
}

export function dynamicEquipmentLayersForEquipment(equipment: readonly string[]): UnitAppearanceLayerConfig[] {
  return equipment.flatMap(item => {
    if (!DYNAMIC_EQUIPMENT_KEYS.includes(item as DynamicEquipmentKey)) return []
    return equipmentLayerConfigs(item as DynamicEquipmentKey)
  })
}

export function dynamicEquipmentForUnit(unitType: string, age = 0, level = 0, civilization?: string): string[] {
  return (UNIT_EQUIPMENT[unitType] ?? []).flatMap(definition => {
    const { equipment, ageEquipment, civilizations, minLevel, maxLevel } = unitEquipmentEntry(definition)
    if (!isEquipmentEnabledForCivilization({ civilizations }, civilization)) return []
    if (!isEquipmentUnlocked({ minLevel, maxLevel }, level)) return []
    return equipmentForAge(equipment, ageEquipment, age)
  })
}

export function dynamicEquipmentForWork(workType: string | null | undefined, age = 0): string[] {
  if (!workType) return []
  return VILLAGER_WORK_EQUIPMENT.filter(({ workType: equipmentWork }) => equipmentWork === workType).map(
    ({ equipment, ageEquipment }) => equipmentForAge(equipment, ageEquipment, age)
  )
}
