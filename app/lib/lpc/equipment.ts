import { ACTION_TYPES, SHEET_TYPES, UNIT_TYPES, WORK_TYPES } from '../../constants'
import type { UnitAppearanceLayerConfig } from '../../types/config'

const EQUIPMENT_BASE_ALIAS = 'lpc-equipment'
const EQUIPMENT_BASE_URL = 'assets/graphics/lpc-equipment'
const EQUIPMENT_SHEETS = ['walking', 'action'] as const

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
  | 'round_shield_brass_slash'
  | 'round_shield_brass_thrust'
  | 'round_shield_silver_slash'
  | 'round_shield_silver_thrust'
  | 'cane'
  | 'fishing_rod'
  | 'quiver'

export type { DynamicEquipmentKey }

type EquipmentOptions = Pick<
  UnitAppearanceLayerConfig,
  'workTypes' | 'hideWhenLoading' | 'showWhenLoading' | 'hideForActions'
>

const EQUIPMENT_LAYER_Z_INDEX: Record<EquipmentLayer, number> = {
  back: 8,
  front: 12,
}

const EQUIPMENT_LAYERS = ['back', 'front'] as const satisfies readonly EquipmentLayer[]

// Equipment whose art never populates one side of the back/front split (e.g. a shield
// held in front has no "behind the body" counterpart) — baking/wiring that empty side
// would just be a fully transparent spritesheet. Keep in sync with
// dynamic_equipment.active_layer_keys() in the Python bake pipeline.
const EQUIPMENT_LAYER_OVERRIDES: Partial<Record<DynamicEquipmentKey, readonly EquipmentLayer[]>> = {
  meat: ['front'],
  stone: ['front'],
  gold: ['front'],
  cane: ['front'],
  quiver: ['back'],
  round_shield_brass_slash: ['front'],
  round_shield_brass_thrust: ['front'],
  round_shield_silver_slash: ['front'],
  round_shield_silver_thrust: ['front'],
}

const EQUIPMENT_SHEET_OVERRIDES: Partial<
  Record<DynamicEquipmentKey, Partial<Record<EquipmentLayer, readonly EquipmentSheet[]>>>
> = {
  cane: { front: ['walking'] },
  fishing_rod: { back: ['action'], front: ['action'] },
}

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
  'round_shield_brass_slash',
  'round_shield_brass_thrust',
  'round_shield_silver_slash',
  'round_shield_silver_thrust',
  'cane',
  'fishing_rod',
  'quiver',
] as const satisfies readonly DynamicEquipmentKey[]

const UNIT_EQUIPMENT: Partial<Record<string, readonly DynamicEquipmentKey[]>> = {
  [UNIT_TYPES.chief]: ['spear'],
  [UNIT_TYPES.clubman]: ['spear'],
  [UNIT_TYPES.axeman]: ['axe'],
  [UNIT_TYPES.bowman]: ['quiver', 'bow'],
  [UNIT_TYPES.shortSwordsman]: ['dagger'],
  [UNIT_TYPES.broadSwordsman]: ['round_shield_brass_slash', 'broadsword'],
  [UNIT_TYPES.longSwordsman]: ['round_shield_silver_slash', 'longsword'],
  [UNIT_TYPES.improvedBowman]: ['quiver', 'bow_great'],
  [UNIT_TYPES.compositeBowman]: ['quiver', 'bow_recurve'],
  [UNIT_TYPES.hoplite]: ['round_shield_brass_thrust', 'longspear'],
  Phalanx: ['round_shield_silver_thrust', 'longspear_silver'],
  Centurion: ['round_shield_silver_thrust', 'longspear_silver'],
  Legion: ['round_shield_silver_slash', 'longsword'],
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
  { workType: 'heroSword', equipment: 'longsword' },
  { workType: 'heroSpear', equipment: 'longspear' },
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

function equipmentSheets(equipment: DynamicEquipmentKey, layer: EquipmentLayer): readonly EquipmentSheet[] {
  return EQUIPMENT_SHEET_OVERRIDES[equipment]?.[layer] ?? EQUIPMENT_SHEETS
}

function layerConfig(
  equipment: DynamicEquipmentKey,
  layer: EquipmentLayer,
  options: EquipmentOptions = {}
): UnitAppearanceLayerConfig {
  const sheets = equipmentSheets(equipment, layer)
  const walkingSheet = sheets.includes('walking') ? equipmentAlias(equipment, layer, 'walking') : undefined
  const actionSheet = sheets.includes('action') ? equipmentAlias(equipment, layer, 'action') : undefined

  return {
    zIndex: EQUIPMENT_LAYER_Z_INDEX[layer],
    ...options,
    standingSheet: walkingSheet,
    walkingSheet,
    actionSheet,
    sheetDirectionCounts: {
      [SHEET_TYPES.standing]: 3,
      [SHEET_TYPES.walking]: 3,
      [SHEET_TYPES.action]: equipment === 'fishing_rod' ? 4 : 3,
    },
  }
}

function equipmentLayerConfigs(
  equipment: DynamicEquipmentKey,
  options: EquipmentOptions = {}
): UnitAppearanceLayerConfig[] {
  const layers = EQUIPMENT_LAYER_OVERRIDES[equipment] ?? EQUIPMENT_LAYERS
  return layers.map(layer => layerConfig(equipment, layer, options))
}

export function dynamicEquipmentAssets(): { alias: string; src: string }[] {
  return DYNAMIC_EQUIPMENT_KEYS.flatMap(equipment =>
    (EQUIPMENT_LAYER_OVERRIDES[equipment] ?? EQUIPMENT_LAYERS).flatMap(layer =>
      equipmentSheets(equipment, layer).map(sheet => ({
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

export function dynamicEquipmentForUnit(unitType: string): string[] {
  return [...(UNIT_EQUIPMENT[unitType] ?? [])]
}

export function dynamicEquipmentForWork(workType: string | null | undefined): string[] {
  if (!workType) return []
  return VILLAGER_WORK_EQUIPMENT.filter(({ workType: equipmentWork, options }) => {
    if (equipmentWork !== workType) return false
    return !options?.showWhenLoading
  }).map(({ equipment }) => equipment)
}
