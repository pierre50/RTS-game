import { isCurrentEquipment } from '../equipment/equipmentMaterials'
import type { UnitAppearanceLayerConfig } from '../../types/config'
import { normalizeCivilization } from '../civilizationAlias'

const EQUIPMENT_DEATH_SHEETS = ['walking', 'action', 'dying', 'corpse'] as const
export const EQUIPMENT_SHOOTING_SHEET = 'shooting'

export type EquipmentSheet = (typeof EQUIPMENT_DEATH_SHEETS)[number]
export type EquipmentLoadSheet = EquipmentSheet | typeof EQUIPMENT_SHOOTING_SHEET
export const EQUIPMENT_SHEETS = ['walking', 'action'] as const satisfies readonly EquipmentSheet[]
export type EquipmentLayer = 'back' | 'front'
export type DynamicEquipmentAsset = { alias: string; src: string }
export type DynamicEquipmentAlias = {
  alias: string
  atlasAlias: string
  animationSpeed: number
  frameSuffix: string
}
export type DynamicEquipmentKey =
  | 'axe_copper'
  | 'axe_ceramic'
  | 'axe_bronze'
  | 'axe_iron'
  | 'pickaxe_copper'
  | 'pickaxe_ceramic'
  | 'pickaxe_bronze'
  | 'pickaxe_iron'
  | 'hammer_copper'
  | 'hammer_ceramic'
  | 'hammer_bronze'
  | 'hammer_iron'
  | 'scythe_copper'
  | 'scythe_ceramic'
  | 'scythe_bronze'
  | 'scythe_iron'
  | 'longstick'
  | 'slingshot'
  | 'bow'
  | 'bow_great'
  | 'bow_recurve'
  | 'arrow_ceramic'
  | 'arrow_copper'
  | 'arrow_bronze'
  | 'arrow_iron'
  | 'sword_copper'
  | 'sword_ceramic'
  | 'sword_bronze'
  | 'sword_curved_bronze'
  | 'sword_curved_iron'
  | 'dagger_bronze'
  | 'dagger_iron'
  | 'spear_ceramic'
  | 'spear_bronze'
  | 'spear_iron'
  | 'mace_bronze'
  | 'mace_iron'
  | 'club_ceramic'
  | 'sword_iron'
  | 'armor_leather'
  | 'armor_mail_ceramic'
  | 'armor_mail_copper'
  | 'armor_mail_bronze'
  | 'armor_mail_iron'
  | 'armor_legion_ceramic'
  | 'armor_legion_copper'
  | 'armor_legion_bronze'
  | 'armor_legion_iron'
  | 'helmet_pointed_leather'
  | 'helmet_pointed_copper'
  | 'helmet_pointed_bronze'
  | 'helmet_pointed_iron'
  | 'helmet_barbuta_ceramic'
  | 'helmet_barbuta_copper'
  | 'helmet_barbuta_bronze'
  | 'helmet_barbuta_iron'
  | 'helmet_legion_ceramic'
  | 'helmet_legion_copper'
  | 'helmet_legion_bronze'
  | 'helmet_legion_iron'
  | 'helmet_nasal_ceramic'
  | 'helmet_nasal_copper'
  | 'helmet_nasal_bronze'
  | 'helmet_nasal_iron'
  | 'helmet_bascinet_round_ceramic'
  | 'helmet_bascinet_round_copper'
  | 'helmet_bascinet_round_bronze'
  | 'helmet_bascinet_round_iron'
  | 'helmet_norman_ceramic'
  | 'helmet_norman_copper'
  | 'helmet_norman_bronze'
  | 'helmet_norman_iron'
  | 'helmet_barbarian_leather'
  | 'helmet_barbarian_nasal_leather'
  | 'sack_cloth_hood_leather'
  | 'shoulder_legion_leather'
  | 'shoulder_legion_copper'
  | 'shoulder_legion_bronze'
  | 'shoulder_legion_iron'
  | 'bracers_leather'
  | 'bracers_copper'
  | 'bracers_bronze'
  | 'bracers_iron'
  | 'leg_armor_leather'
  | 'leg_armor_copper'
  | 'leg_armor_bronze'
  | 'leg_armor_iron'
  | 'cape_solid'
  | 'centurion_crest'
  | 'legion_plumage'
  | 'plumage'
  | 'helmet_wings'
  | 'upward_horns_white'
  | 'horns_short'
  | 'round_shield_wood_slash'
  | 'round_shield_copper_slash'
  | 'round_shield_bronze_slash'
  | 'round_shield_iron_slash'
  | 'cane'
  | 'quiver'

export type EquipmentOptions = Pick<
  UnitAppearanceLayerConfig,
  | 'workTypes'
  | 'civilizations'
  | 'hideForActions'
  | 'hideOnOrAfterFrame'
  | 'actionFrameSequence'
  | 'minLevel'
  | 'maxLevel'
  | 'mountedCut'
  | 'actionWorkSheetOverrides'
>

export const EQUIPMENT_LAYER_Z_INDEX: Record<EquipmentLayer, number> = {
  back: 8,
  front: 12,
}

export const WEARABLE_EQUIPMENT_Z_INDEX = 11
export const BACK_WORN_DEATH_Z_INDEX = 11
export const HELMET_DECOR_DEATH_Z_INDEX = 13

export const EQUIPMENT_LAYERS = ['back', 'front'] as const satisfies readonly EquipmentLayer[]

// Equipment whose art never populates one side of the back/front split (e.g. a shield
// held in front has no "behind the body" counterpart) — baking/wiring that empty side
// would just be a fully transparent spritesheet. Keep in sync with
// equipment.active_layer_keys() in the Python bake pipeline.
export const EQUIPMENT_LAYER_OVERRIDES: Partial<Record<DynamicEquipmentKey, readonly EquipmentLayer[]>> = {
  cane: ['front'],
  quiver: ['back'],
  arrow_ceramic: ['front'],
  arrow_copper: ['front'],
  arrow_bronze: ['front'],
  arrow_iron: ['front'],
  armor_leather: ['front'],
  armor_mail_ceramic: ['front'],
  armor_mail_copper: ['front'],
  armor_mail_bronze: ['front'],
  armor_mail_iron: ['front'],
  armor_legion_ceramic: ['front'],
  armor_legion_copper: ['front'],
  armor_legion_bronze: ['front'],
  armor_legion_iron: ['front'],
  helmet_pointed_leather: ['front'],
  helmet_pointed_copper: ['front'],
  helmet_pointed_bronze: ['front'],
  helmet_pointed_iron: ['front'],
  helmet_barbuta_ceramic: ['front'],
  helmet_barbuta_copper: ['front'],
  helmet_barbuta_bronze: ['front'],
  helmet_barbuta_iron: ['front'],
  helmet_legion_ceramic: ['front'],
  helmet_legion_copper: ['front'],
  helmet_legion_bronze: ['front'],
  helmet_legion_iron: ['front'],
  helmet_nasal_ceramic: ['front'],
  helmet_nasal_copper: ['front'],
  helmet_nasal_bronze: ['front'],
  helmet_nasal_iron: ['front'],
  helmet_bascinet_round_ceramic: ['front'],
  helmet_bascinet_round_copper: ['front'],
  helmet_bascinet_round_bronze: ['front'],
  helmet_bascinet_round_iron: ['front'],
  helmet_norman_ceramic: ['front'],
  helmet_norman_copper: ['front'],
  helmet_norman_bronze: ['front'],
  helmet_norman_iron: ['front'],
  helmet_barbarian_leather: ['front'],
  helmet_barbarian_nasal_leather: ['front'],
  sack_cloth_hood_leather: ['front'],
  shoulder_legion_leather: ['front'],
  shoulder_legion_copper: ['front'],
  shoulder_legion_bronze: ['front'],
  shoulder_legion_iron: ['front'],
  bracers_leather: ['front'],
  bracers_copper: ['front'],
  bracers_bronze: ['front'],
  bracers_iron: ['front'],
  leg_armor_leather: ['front'],
  leg_armor_copper: ['front'],
  leg_armor_bronze: ['front'],
  leg_armor_iron: ['front'],
  centurion_crest: ['front'],
  legion_plumage: ['front'],
  plumage: ['front'],
  round_shield_wood_slash: ['front'],
  round_shield_copper_slash: ['front'],
  round_shield_bronze_slash: ['front'],
  round_shield_iron_slash: ['front'],
}

const ARMOR_EQUIPMENT_KEY_LIST = [
  'armor_leather',
  'armor_mail_ceramic',
  'armor_mail_copper',
  'armor_mail_bronze',
  'armor_mail_iron',
  'armor_legion_ceramic',
  'armor_legion_copper',
  'armor_legion_bronze',
  'armor_legion_iron',
] as const satisfies readonly DynamicEquipmentKey[]

const HELMET_EQUIPMENT_KEY_LIST = [
  'helmet_pointed_leather',
  'helmet_pointed_copper',
  'helmet_pointed_bronze',
  'helmet_pointed_iron',
  'helmet_barbuta_ceramic',
  'helmet_barbuta_copper',
  'helmet_barbuta_bronze',
  'helmet_barbuta_iron',
  'helmet_legion_ceramic',
  'helmet_legion_copper',
  'helmet_legion_bronze',
  'helmet_legion_iron',
  'helmet_nasal_ceramic',
  'helmet_nasal_copper',
  'helmet_nasal_bronze',
  'helmet_nasal_iron',
  'helmet_bascinet_round_ceramic',
  'helmet_bascinet_round_copper',
  'helmet_bascinet_round_bronze',
  'helmet_bascinet_round_iron',
  'helmet_norman_ceramic',
  'helmet_norman_copper',
  'helmet_norman_bronze',
  'helmet_norman_iron',
  'helmet_barbarian_leather',
  'helmet_barbarian_nasal_leather',
] as const satisfies readonly DynamicEquipmentKey[]

const SOLDIER_LAYER_EQUIPMENT_KEY_LIST = [
  'shoulder_legion_leather',
  'shoulder_legion_copper',
  'shoulder_legion_bronze',
  'shoulder_legion_iron',
  'bracers_leather',
  'bracers_copper',
  'bracers_bronze',
  'bracers_iron',
  'leg_armor_leather',
  'leg_armor_copper',
  'leg_armor_bronze',
  'leg_armor_iron',
] as const satisfies readonly DynamicEquipmentKey[]

export const GENDERED_EQUIPMENT_KEYS = new Set<DynamicEquipmentKey>([
  ...ARMOR_EQUIPMENT_KEY_LIST,
  ...SOLDIER_LAYER_EQUIPMENT_KEY_LIST.filter(key => !key.startsWith('bracers_')),
  'axe_ceramic',
  'axe_copper',
  'axe_bronze',
  'axe_iron',
  'pickaxe_ceramic',
  'pickaxe_copper',
  'pickaxe_bronze',
  'pickaxe_iron',
  'hammer_ceramic',
  'hammer_copper',
  'hammer_bronze',
  'hammer_iron',
])

const WEARABLE_EQUIPMENT_KEY_LIST = [
  ...ARMOR_EQUIPMENT_KEY_LIST,
  ...HELMET_EQUIPMENT_KEY_LIST,
  'sack_cloth_hood_leather',
] as const satisfies readonly DynamicEquipmentKey[]

export const WEARABLE_EQUIPMENT_KEYS = new Set<DynamicEquipmentKey>([
  ...WEARABLE_EQUIPMENT_KEY_LIST,
  ...SOLDIER_LAYER_EQUIPMENT_KEY_LIST,
])

export const WEARABLE_SHOOTING_EQUIPMENT_KEYS = new Set<DynamicEquipmentKey>([
  ...ARMOR_EQUIPMENT_KEY_LIST,
  ...HELMET_EQUIPMENT_KEY_LIST,
  ...SOLDIER_LAYER_EQUIPMENT_KEY_LIST,
  'sack_cloth_hood_leather',
  'slingshot',
  'bow',
  'bow_great',
  'bow_recurve',
  'arrow_ceramic',
  'arrow_copper',
  'arrow_bronze',
  'arrow_iron',
  'quiver',
  'cape_solid',
  'centurion_crest',
  'legion_plumage',
  'plumage',
  'helmet_wings',
  'upward_horns_white',
  'horns_short',
])

export const PLAYER_COLORED_EQUIPMENT_KEYS = new Set<DynamicEquipmentKey>(['cape_solid'])

export const HELMET_DECOR_EQUIPMENT_KEYS = new Set<DynamicEquipmentKey>([
  'centurion_crest',
  'legion_plumage',
  'plumage',
  'helmet_wings',
  'upward_horns_white',
  'horns_short',
])

export const BACK_WORN_DEATH_EQUIPMENT_KEYS = new Set<DynamicEquipmentKey>(['cape_solid', 'quiver'])
export const NON_SLASH_ACTION_EQUIPMENT_KEYS = new Set<string>([
  'arrow_bronze',
  'arrow_ceramic',
  'arrow_copper',
  'arrow_iron',
  'slingshot',
  'bow',
  'bow_great',
  'bow_recurve',
  'cane',
  'gold',
  'meat',
  'quiver',
  'stone',
])
export const ACTION_BACKED_SHOOTING_EQUIPMENT_KEYS = new Set<DynamicEquipmentKey>([
  'slingshot',
  'bow',
  'bow_great',
  'bow_recurve',
  'arrow_ceramic',
  'arrow_copper',
  'arrow_bronze',
  'arrow_iron',
  'quiver',
])

export const MOUNTED_WALKING_SHEET_EQUIPMENT_KEYS = new Set<DynamicEquipmentKey>([
  'centurion_crest',
  'legion_plumage',
  'plumage',
  'helmet_wings',
  'upward_horns_white',
  'horns_short',
])

export const MOUNTED_UNCUT_EQUIPMENT_KEYS = new Set<DynamicEquipmentKey>([
  'axe_copper',
  'axe_ceramic',
  'axe_bronze',
  'axe_iron',
  'pickaxe_copper',
  'pickaxe_ceramic',
  'pickaxe_bronze',
  'pickaxe_iron',
  'hammer_copper',
  'hammer_ceramic',
  'hammer_bronze',
  'hammer_iron',
  'scythe_copper',
  'scythe_ceramic',
  'scythe_bronze',
  'scythe_iron',
  'longstick',
  'slingshot',
  'bow',
  'bow_great',
  'bow_recurve',
  'arrow_ceramic',
  'arrow_copper',
  'arrow_bronze',
  'arrow_iron',
  'spear_ceramic',
  'spear_bronze',
  'spear_iron',
  'club_ceramic',

  'sword_copper',
  'sword_ceramic',
  'sword_bronze',
  'sword_iron',
  'helmet_pointed_leather',
  'helmet_pointed_copper',
  'helmet_pointed_bronze',
  'helmet_pointed_iron',
  'helmet_barbuta_ceramic',
  'helmet_barbuta_copper',
  'helmet_barbuta_bronze',
  'helmet_barbuta_iron',
  'helmet_legion_ceramic',
  'helmet_legion_copper',
  'helmet_legion_bronze',
  'helmet_legion_iron',
  'helmet_nasal_ceramic',
  'helmet_nasal_copper',
  'helmet_nasal_bronze',
  'helmet_nasal_iron',
  'helmet_bascinet_round_ceramic',
  'helmet_bascinet_round_copper',
  'helmet_bascinet_round_bronze',
  'helmet_bascinet_round_iron',
  'helmet_norman_ceramic',
  'helmet_norman_copper',
  'helmet_norman_bronze',
  'helmet_norman_iron',
  'helmet_barbarian_leather',
  'helmet_barbarian_nasal_leather',
  'sack_cloth_hood_leather',
  'centurion_crest',
  'legion_plumage',
  'plumage',
  'helmet_wings',
  'upward_horns_white',
  'horns_short',
  'round_shield_wood_slash',
  'round_shield_copper_slash',
  'round_shield_bronze_slash',
  'round_shield_iron_slash',
  'cane',
  'quiver',
])

export const EQUIPMENT_SHEET_OVERRIDES: Partial<
  Record<DynamicEquipmentKey, Partial<Record<EquipmentLayer, readonly EquipmentSheet[]>>>
> = {
  armor_leather: { front: EQUIPMENT_DEATH_SHEETS },
  slingshot: { back: EQUIPMENT_DEATH_SHEETS, front: EQUIPMENT_DEATH_SHEETS },
  bow: { back: EQUIPMENT_DEATH_SHEETS, front: EQUIPMENT_DEATH_SHEETS },
  bow_great: { back: EQUIPMENT_DEATH_SHEETS, front: EQUIPMENT_DEATH_SHEETS },
  bow_recurve: { back: EQUIPMENT_DEATH_SHEETS, front: EQUIPMENT_DEATH_SHEETS },
  cape_solid: { back: EQUIPMENT_DEATH_SHEETS, front: EQUIPMENT_DEATH_SHEETS },
  helmet_barbarian_leather: { front: EQUIPMENT_DEATH_SHEETS },
  helmet_barbarian_nasal_leather: { front: EQUIPMENT_DEATH_SHEETS },
  legion_plumage: { front: EQUIPMENT_DEATH_SHEETS },
  quiver: { back: EQUIPMENT_DEATH_SHEETS },
  sack_cloth_hood_leather: { front: EQUIPMENT_DEATH_SHEETS },
  sword_ceramic: { back: EQUIPMENT_DEATH_SHEETS, front: EQUIPMENT_DEATH_SHEETS },
  sword_copper: { back: EQUIPMENT_DEATH_SHEETS, front: EQUIPMENT_DEATH_SHEETS },
  sword_bronze: { back: EQUIPMENT_DEATH_SHEETS, front: EQUIPMENT_DEATH_SHEETS },
  sword_curved_bronze: { back: EQUIPMENT_DEATH_SHEETS, front: EQUIPMENT_DEATH_SHEETS },
  sword_curved_iron: { back: EQUIPMENT_DEATH_SHEETS, front: EQUIPMENT_DEATH_SHEETS },
  dagger_bronze: { back: EQUIPMENT_DEATH_SHEETS, front: EQUIPMENT_DEATH_SHEETS },
  dagger_iron: { back: EQUIPMENT_DEATH_SHEETS, front: EQUIPMENT_DEATH_SHEETS },
  spear_ceramic: { back: EQUIPMENT_DEATH_SHEETS, front: EQUIPMENT_DEATH_SHEETS },
  spear_bronze: { back: EQUIPMENT_DEATH_SHEETS, front: EQUIPMENT_DEATH_SHEETS },
  spear_iron: { back: EQUIPMENT_DEATH_SHEETS, front: EQUIPMENT_DEATH_SHEETS },
  mace_bronze: { back: EQUIPMENT_DEATH_SHEETS, front: EQUIPMENT_DEATH_SHEETS },
  mace_iron: { back: EQUIPMENT_DEATH_SHEETS, front: EQUIPMENT_DEATH_SHEETS },
  club_ceramic: { back: EQUIPMENT_DEATH_SHEETS, front: EQUIPMENT_DEATH_SHEETS },
  sword_iron: { back: EQUIPMENT_DEATH_SHEETS, front: EQUIPMENT_DEATH_SHEETS },
  upward_horns_white: { back: EQUIPMENT_DEATH_SHEETS, front: EQUIPMENT_DEATH_SHEETS },
  horns_short: { back: EQUIPMENT_DEATH_SHEETS, front: EQUIPMENT_DEATH_SHEETS },
  cane: { front: ['walking'] },
  arrow_ceramic: { front: ['action'] },
  arrow_copper: { front: ['action'] },
  arrow_bronze: { front: ['action'] },
  arrow_iron: { front: ['action'] },
}

export const DYNAMIC_EQUIPMENT_KEYS = [
  'axe_ceramic',
  'axe_bronze',
  'axe_iron',
  'pickaxe_ceramic',
  'pickaxe_bronze',
  'pickaxe_iron',
  'hammer_ceramic',
  'hammer_bronze',
  'hammer_iron',
  'scythe_ceramic',
  'scythe_bronze',
  'scythe_iron',
  'longstick',
  'slingshot',
  'bow',
  'bow_great',
  'bow_recurve',
  'arrow_ceramic',
  'arrow_copper',
  'arrow_bronze',
  'arrow_iron',
  'spear_ceramic',
  'spear_bronze',
  'spear_iron',
  'club_ceramic',

  'sword_copper',
  'sword_ceramic',
  'sword_bronze',
  'sword_curved_bronze',
  'sword_curved_iron',
  'dagger_bronze',
  'dagger_iron',
  'mace_bronze',
  'mace_iron',
  'sword_iron',
  ...WEARABLE_EQUIPMENT_KEY_LIST,
  ...SOLDIER_LAYER_EQUIPMENT_KEY_LIST,
  'cape_solid',
  'centurion_crest',
  'legion_plumage',
  'plumage',
  'helmet_wings',
  'upward_horns_white',
  'horns_short',
  'round_shield_wood_slash',
  'round_shield_copper_slash',
  'round_shield_bronze_slash',
  'round_shield_iron_slash',
  'cane',
  'quiver',
].filter(isCurrentEquipment) as DynamicEquipmentKey[]

export type UnitEquipmentEntry = {
  equipment: DynamicEquipmentKey
  civilizations?: string[]
  minLevel?: number
  maxLevel?: number
  options?: EquipmentOptions
}

export type UnitEquipmentDefinition = DynamicEquipmentKey | UnitEquipmentEntry

const DEFAULT_CIVILIZATION = 'Hellas'

export function civilizationKey(civilization: string | null | undefined): string {
  return normalizeCivilization(civilization || DEFAULT_CIVILIZATION)
}

export function isEquipmentEnabledForCivilization(
  entry: Pick<UnitEquipmentEntry, 'civilizations'>,
  civilization?: string
): boolean {
  if (!entry.civilizations?.length) return true
  return entry.civilizations.includes(civilizationKey(civilization))
}

export { UNIT_EQUIPMENT, VILLAGER_WORK_EQUIPMENT } from './unitEquipmentData'
