import { ACTION_TYPES, SHEET_TYPES, UNIT_TYPES, WORK_TYPES } from '../../constants'
import type { UnitAppearanceLayerConfig } from '../../types/config'

const EQUIPMENT_BASE_ALIAS = 'lpc-equipment'
const EQUIPMENT_BASE_URL = 'assets/graphics/lpc-equipment'
const EQUIPMENT_SHEETS = ['walking', 'action', 'dying', 'corpse'] as const

type EquipmentSheet = (typeof EQUIPMENT_SHEETS)[number]
type EquipmentLayer = 'back' | 'front'
type DynamicEquipmentKey =
  | 'axe'
  | 'pickaxe'
  | 'hammer'
  | 'meat'
  | 'stone'
  | 'gold'
  | 'scythe'
  | 'bow'
  | 'bow_great'
  | 'bow_recurve'
  | 'spear'
  | 'dagger'
  | 'broadsword'
  | 'longsword'
  | 'longspear'
  | 'longspear_silver'
  | 'cane'
  | 'fishing_rod'
  | 'quiver'

type EquipmentOptions = Pick<
  UnitAppearanceLayerConfig,
  'workTypes' | 'hideWhenLoading' | 'showWhenLoading' | 'hideForActions'
>

const EQUIPMENT_LAYER_Z_INDEX: Record<EquipmentLayer, number> = {
  back: 8,
  front: 12,
}

const EQUIPMENT_LAYERS = ['back', 'front'] as const satisfies readonly EquipmentLayer[]

const DYNAMIC_EQUIPMENT_KEYS = [
  'axe',
  'pickaxe',
  'hammer',
  'meat',
  'stone',
  'gold',
  'scythe',
  'bow',
  'bow_great',
  'bow_recurve',
  'spear',
  'dagger',
  'broadsword',
  'longsword',
  'longspear',
  'longspear_silver',
  'cane',
  'fishing_rod',
  'quiver',
] as const satisfies readonly DynamicEquipmentKey[]

const UNIT_EQUIPMENT: Partial<Record<string, readonly DynamicEquipmentKey[]>> = {
  [UNIT_TYPES.clubman]: ['spear'],
  [UNIT_TYPES.axeman]: ['axe'],
  [UNIT_TYPES.bowman]: ['quiver', 'bow'],
  [UNIT_TYPES.shortSwordsman]: ['dagger'],
  [UNIT_TYPES.broadSwordsman]: ['broadsword'],
  [UNIT_TYPES.longSwordsman]: ['longsword'],
  [UNIT_TYPES.improvedBowman]: ['quiver', 'bow_great'],
  [UNIT_TYPES.compositeBowman]: ['quiver', 'bow_recurve'],
  [UNIT_TYPES.hoplite]: ['longspear'],
  Phalanx: ['longspear_silver'],
  Centurion: ['longspear_silver'],
  Legion: ['longsword'],
  [UNIT_TYPES.priest]: ['cane'],
}

const VILLAGER_WORK_EQUIPMENT: readonly {
  workType: string
  equipment: DynamicEquipmentKey
  options?: EquipmentOptions
}[] = [
  { workType: WORK_TYPES.woodcutter, equipment: 'axe' },
  { workType: WORK_TYPES.stoneminer, equipment: 'pickaxe', options: { hideWhenLoading: true } },
  { workType: WORK_TYPES.goldminer, equipment: 'pickaxe', options: { hideWhenLoading: true } },
  { workType: WORK_TYPES.builder, equipment: 'hammer' },
  { workType: WORK_TYPES.farmer, equipment: 'scythe' },
  { workType: WORK_TYPES.fisher, equipment: 'fishing_rod' },
  {
    workType: WORK_TYPES.hunter,
    equipment: 'quiver',
    options: { hideWhenLoading: true, hideForActions: [ACTION_TYPES.takemeat] },
  },
  {
    workType: WORK_TYPES.hunter,
    equipment: 'bow',
    options: { hideWhenLoading: true, hideForActions: [ACTION_TYPES.takemeat] },
  },
  { workType: WORK_TYPES.hunter, equipment: 'meat', options: { showWhenLoading: true } },
  { workType: WORK_TYPES.stoneminer, equipment: 'stone', options: { showWhenLoading: true } },
  { workType: WORK_TYPES.goldminer, equipment: 'gold', options: { showWhenLoading: true } },
]

function equipmentAlias(equipment: DynamicEquipmentKey, layer: EquipmentLayer, sheet: EquipmentSheet): string {
  return `${EQUIPMENT_BASE_ALIAS}/${equipment}/${layer}/${sheet}`
}

function equipmentSrc(equipment: DynamicEquipmentKey, layer: EquipmentLayer, sheet: EquipmentSheet): string {
  return `${EQUIPMENT_BASE_URL}/${equipment}/${layer}/${sheet}/texture.json`
}

function layerConfig(
  equipment: DynamicEquipmentKey,
  layer: EquipmentLayer,
  options: EquipmentOptions = {}
): UnitAppearanceLayerConfig {
  return {
    zIndex: EQUIPMENT_LAYER_Z_INDEX[layer],
    ...options,
    standingSheet: equipmentAlias(equipment, layer, 'walking'),
    walkingSheet: equipmentAlias(equipment, layer, 'walking'),
    actionSheet: equipmentAlias(equipment, layer, 'action'),
    dyingSheet: equipmentAlias(equipment, layer, 'dying'),
    corpseSheet: equipmentAlias(equipment, layer, 'corpse'),
    sheetDirectionCounts: {
      [SHEET_TYPES.standing]: 3,
      [SHEET_TYPES.walking]: 3,
      [SHEET_TYPES.action]: equipment === 'fishing_rod' ? 4 : 3,
      [SHEET_TYPES.dying]: 1,
      [SHEET_TYPES.corpse]: 1,
    },
  }
}

function equipmentLayerConfigs(
  equipment: DynamicEquipmentKey,
  options: EquipmentOptions = {}
): UnitAppearanceLayerConfig[] {
  return EQUIPMENT_LAYERS.map(layer => layerConfig(equipment, layer, options))
}

export function dynamicEquipmentAssets(): { alias: string; src: string }[] {
  return DYNAMIC_EQUIPMENT_KEYS.flatMap(equipment =>
    EQUIPMENT_LAYERS.flatMap(layer =>
      EQUIPMENT_SHEETS.map(sheet => ({
        alias: equipmentAlias(equipment, layer, sheet),
        src: equipmentSrc(equipment, layer, sheet),
      }))
    )
  )
}

export function dynamicEquipmentLayersForUnit(unitType: string): UnitAppearanceLayerConfig[] {
  return (UNIT_EQUIPMENT[unitType] ?? []).flatMap(equipment => equipmentLayerConfigs(equipment))
}

export function dynamicEquipmentLayersForVillager(): UnitAppearanceLayerConfig[] {
  return VILLAGER_WORK_EQUIPMENT.flatMap(({ workType, equipment, options }) =>
    equipmentLayerConfigs(equipment, { ...options, workTypes: [workType] })
  )
}
