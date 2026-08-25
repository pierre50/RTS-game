import { ACTION_TYPES, SHEET_TYPES, UNIT_TYPES, WORK_TYPES } from '../../constants'
import type { UnitAppearanceLayerConfig } from '../../types/config'

const EQUIPMENT_BASE_ALIAS = 'lpc-equipment'
const EQUIPMENT_BASE_URL = 'assets/graphics/lpc-equipment'
const EQUIPMENT_DEATH_SHEETS = ['walking', 'action', 'dying', 'corpse'] as const
const EQUIPMENT_SHOOTING_SHEET = 'shooting'

type EquipmentSheet = (typeof EQUIPMENT_DEATH_SHEETS)[number]
type EquipmentLoadSheet = EquipmentSheet | typeof EQUIPMENT_SHOOTING_SHEET
const EQUIPMENT_SHEETS = ['walking', 'action'] as const satisfies readonly EquipmentSheet[]
type EquipmentLayer = 'back' | 'front'
type DynamicEquipmentAsset = { alias: string; src: string }
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
  | 'bow'
  | 'bow_great'
  | 'bow_recurve'
  | 'arrow_ceramic'
  | 'arrow_copper'
  | 'arrow_bronze'
  | 'arrow_iron'
  | 'halberd'
  | 'sword_copper'
  | 'sword_ceramic'
  | 'sword_bronze'
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
  | 'helmet_pointed_ceramic'
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
  | 'helmet_barbarian_ceramic'
  | 'helmet_barbarian_nasal_ceramic'
  | 'sack_cloth_hood_leather'
  | 'shoulder_legion_ceramic'
  | 'shoulder_legion_copper'
  | 'shoulder_legion_bronze'
  | 'shoulder_legion_iron'
  | 'bracers_ceramic'
  | 'bracers_copper'
  | 'bracers_bronze'
  | 'bracers_iron'
  | 'leg_armor_ceramic'
  | 'leg_armor_copper'
  | 'leg_armor_bronze'
  | 'leg_armor_iron'
  | 'cape_solid'
  | 'crest'
  | 'centurion_crest'
  | 'centurion_plumage'
  | 'legion_plumage'
  | 'plumage'
  | 'helmet_wings'
  | 'upward_horns_white'
  | 'upward_horns_ceramic'
  | 'longsword'
  | 'round_shield_ceramic_slash'
  | 'round_shield_copper_slash'
  | 'round_shield_bronze_slash'
  | 'round_shield_iron_slash'
  | 'cane'
  | 'quiver'

type EquipmentOptions = Pick<
  UnitAppearanceLayerConfig,
  | 'workTypes'
  | 'civilizations'
  | 'hideForActions'
  | 'hideOnOrAfterFrame'
  | 'minLevel'
  | 'maxLevel'
  | 'mountedCut'
  | 'actionWorkSheetOverrides'
>
type AgeEquipmentOverrides = Partial<Record<number, DynamicEquipmentKey>>

const EQUIPMENT_LAYER_Z_INDEX: Record<EquipmentLayer, number> = {
  back: 8,
  front: 12,
}

const WEARABLE_EQUIPMENT_Z_INDEX = 11
const BACK_WORN_DEATH_Z_INDEX = 11
const HELMET_DECOR_DEATH_Z_INDEX = 13

const EQUIPMENT_LAYERS = ['back', 'front'] as const satisfies readonly EquipmentLayer[]

// Equipment whose art never populates one side of the back/front split (e.g. a shield
// held in front has no "behind the body" counterpart) — baking/wiring that empty side
// would just be a fully transparent spritesheet. Keep in sync with
// equipment.active_layer_keys() in the Python bake pipeline.
const EQUIPMENT_LAYER_OVERRIDES: Partial<Record<DynamicEquipmentKey, readonly EquipmentLayer[]>> = {
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
  helmet_pointed_ceramic: ['front'],
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
  helmet_barbarian_ceramic: ['front'],
  helmet_barbarian_nasal_ceramic: ['front'],
  sack_cloth_hood_leather: ['front'],
  shoulder_legion_ceramic: ['front'],
  shoulder_legion_copper: ['front'],
  shoulder_legion_bronze: ['front'],
  shoulder_legion_iron: ['front'],
  bracers_ceramic: ['front'],
  bracers_copper: ['front'],
  bracers_bronze: ['front'],
  bracers_iron: ['front'],
  leg_armor_ceramic: ['front'],
  leg_armor_copper: ['front'],
  leg_armor_bronze: ['front'],
  leg_armor_iron: ['front'],
  crest: ['front'],
  centurion_crest: ['front'],
  centurion_plumage: ['front'],
  legion_plumage: ['front'],
  plumage: ['front'],
  round_shield_ceramic_slash: ['front'],
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
  'helmet_pointed_ceramic',
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
  'helmet_barbarian_ceramic',
  'helmet_barbarian_nasal_ceramic',
] as const satisfies readonly DynamicEquipmentKey[]

const SOLDIER_LAYER_EQUIPMENT_KEY_LIST = [
  'shoulder_legion_ceramic',
  'shoulder_legion_copper',
  'shoulder_legion_bronze',
  'shoulder_legion_iron',
  'bracers_ceramic',
  'bracers_copper',
  'bracers_bronze',
  'bracers_iron',
  'leg_armor_ceramic',
  'leg_armor_copper',
  'leg_armor_bronze',
  'leg_armor_iron',
] as const satisfies readonly DynamicEquipmentKey[]

const GENDERED_EQUIPMENT_KEYS = new Set<DynamicEquipmentKey>([
  ...ARMOR_EQUIPMENT_KEY_LIST,
  ...SOLDIER_LAYER_EQUIPMENT_KEY_LIST.filter(key => !key.startsWith('bracers_')),
])

const WEARABLE_EQUIPMENT_KEY_LIST = [
  ...ARMOR_EQUIPMENT_KEY_LIST,
  ...HELMET_EQUIPMENT_KEY_LIST,
  'sack_cloth_hood_leather',
] as const satisfies readonly DynamicEquipmentKey[]

const WEARABLE_EQUIPMENT_KEYS = new Set<DynamicEquipmentKey>([
  ...WEARABLE_EQUIPMENT_KEY_LIST,
  ...SOLDIER_LAYER_EQUIPMENT_KEY_LIST,
])

const WEARABLE_SHOOTING_EQUIPMENT_KEYS = new Set<DynamicEquipmentKey>([
  ...ARMOR_EQUIPMENT_KEY_LIST,
  ...HELMET_EQUIPMENT_KEY_LIST,
  ...SOLDIER_LAYER_EQUIPMENT_KEY_LIST,
])

const PLAYER_COLORED_EQUIPMENT_KEYS = new Set<DynamicEquipmentKey>([
  'cape_solid',
  'crest',
  'centurion_crest',
  'centurion_plumage',
  'legion_plumage',
  'plumage',
])

const HELMET_DECOR_EQUIPMENT_KEYS = new Set<DynamicEquipmentKey>([
  'crest',
  'centurion_crest',
  'centurion_plumage',
  'legion_plumage',
  'plumage',
  'helmet_wings',
  'upward_horns_white',
  'upward_horns_ceramic',
])

const BACK_WORN_DEATH_EQUIPMENT_KEYS = new Set<DynamicEquipmentKey>(['cape_solid', 'quiver'])

const MOUNTED_WALKING_SHEET_EQUIPMENT_KEYS = new Set<DynamicEquipmentKey>([
  'crest',
  'centurion_crest',
  'centurion_plumage',
  'legion_plumage',
  'plumage',
  'helmet_wings',
  'upward_horns_white',
  'upward_horns_ceramic',
])

const MOUNTED_UNCUT_EQUIPMENT_KEYS = new Set<DynamicEquipmentKey>([
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
  'bow',
  'bow_great',
  'bow_recurve',
  'arrow_ceramic',
  'arrow_copper',
  'arrow_bronze',
  'arrow_iron',
  'halberd',
  'sword_copper',
  'sword_ceramic',
  'sword_bronze',
  'sword_iron',
  'helmet_pointed_ceramic',
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
  'helmet_barbarian_ceramic',
  'helmet_barbarian_nasal_ceramic',
  'sack_cloth_hood_leather',
  'crest',
  'centurion_crest',
  'centurion_plumage',
  'legion_plumage',
  'plumage',
  'helmet_wings',
  'upward_horns_white',
  'upward_horns_ceramic',
  'longsword',
  'round_shield_ceramic_slash',
  'round_shield_copper_slash',
  'round_shield_bronze_slash',
  'round_shield_iron_slash',
  'cane',
  'quiver',
])

const EQUIPMENT_SHEET_OVERRIDES: Partial<
  Record<DynamicEquipmentKey, Partial<Record<EquipmentLayer, readonly EquipmentSheet[]>>>
> = {
  armor_leather: { front: EQUIPMENT_DEATH_SHEETS },
  bow: { back: EQUIPMENT_DEATH_SHEETS, front: EQUIPMENT_DEATH_SHEETS },
  bow_great: { back: EQUIPMENT_DEATH_SHEETS, front: EQUIPMENT_DEATH_SHEETS },
  bow_recurve: { back: EQUIPMENT_DEATH_SHEETS, front: EQUIPMENT_DEATH_SHEETS },
  cape_solid: { back: EQUIPMENT_DEATH_SHEETS, front: EQUIPMENT_DEATH_SHEETS },
  centurion_plumage: { front: EQUIPMENT_DEATH_SHEETS },
  helmet_barbarian_ceramic: { front: EQUIPMENT_DEATH_SHEETS },
  helmet_barbarian_nasal_ceramic: { front: EQUIPMENT_DEATH_SHEETS },
  legion_plumage: { front: EQUIPMENT_DEATH_SHEETS },
  quiver: { back: EQUIPMENT_DEATH_SHEETS },
  sack_cloth_hood_leather: { front: EQUIPMENT_DEATH_SHEETS },
  sword_ceramic: { back: EQUIPMENT_DEATH_SHEETS, front: EQUIPMENT_DEATH_SHEETS },
  sword_copper: { back: EQUIPMENT_DEATH_SHEETS, front: EQUIPMENT_DEATH_SHEETS },
  sword_bronze: { back: EQUIPMENT_DEATH_SHEETS, front: EQUIPMENT_DEATH_SHEETS },
  sword_iron: { back: EQUIPMENT_DEATH_SHEETS, front: EQUIPMENT_DEATH_SHEETS },
  upward_horns_white: { back: EQUIPMENT_DEATH_SHEETS, front: EQUIPMENT_DEATH_SHEETS },
  upward_horns_ceramic: { back: EQUIPMENT_DEATH_SHEETS, front: EQUIPMENT_DEATH_SHEETS },
  cane: { front: ['walking'] },
  arrow_ceramic: { front: ['action'] },
  arrow_copper: { front: ['action'] },
  arrow_bronze: { front: ['action'] },
  arrow_iron: { front: ['action'] },
}

export const DYNAMIC_EQUIPMENT_KEYS = [
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
  'bow',
  'bow_great',
  'bow_recurve',
  'arrow_ceramic',
  'arrow_copper',
  'arrow_bronze',
  'arrow_iron',
  'halberd',
  'sword_copper',
  'sword_ceramic',
  'sword_bronze',
  'sword_iron',
  ...WEARABLE_EQUIPMENT_KEY_LIST,
  ...SOLDIER_LAYER_EQUIPMENT_KEY_LIST,
  'cape_solid',
  'crest',
  'centurion_crest',
  'centurion_plumage',
  'legion_plumage',
  'plumage',
  'helmet_wings',
  'upward_horns_white',
  'upward_horns_ceramic',
  'longsword',
  'round_shield_ceramic_slash',
  'round_shield_copper_slash',
  'round_shield_bronze_slash',
  'round_shield_iron_slash',
  'cane',
  'quiver',
] as const satisfies readonly DynamicEquipmentKey[]

type UnitEquipmentEntry = {
  equipment: DynamicEquipmentKey
  ageEquipment?: AgeEquipmentOverrides
  civilizations?: string[]
  minLevel?: number
  maxLevel?: number
  options?: EquipmentOptions
}

type UnitEquipmentDefinition = DynamicEquipmentKey | UnitEquipmentEntry

const metalAgeEquipment = (
  copper: DynamicEquipmentKey,
  bronze: DynamicEquipmentKey,
  iron: DynamicEquipmentKey
): AgeEquipmentOverrides => ({ 1: copper, 2: bronze, 3: iron })
const DEFAULT_CIVILIZATION = 'Greek'
const CIVILIZATION_ALIASES: Record<string, string> = {
  greek: 'Greek',
  roman: 'Roman',
  egyptian: 'Egyptian',
  babylonian: 'Babylonian',
  asian: 'Asian',
  celtic: 'Celtic',
  nordic: 'Nordic',
  viking: 'Nordic',
  nubian: 'Nubian',
}
const HIDE_ARROW_LAYER_FROM_SHOOT_RELEASE_FRAME = 9

export function civilizationKey(civilization: string | null | undefined): string {
  return CIVILIZATION_ALIASES[(civilization || DEFAULT_CIVILIZATION).toLowerCase()] ?? DEFAULT_CIVILIZATION
}

function isEquipmentEnabledForCivilization(
  entry: Pick<UnitEquipmentEntry, 'civilizations'>,
  civilization?: string
): boolean {
  if (!entry.civilizations?.length) return true
  return entry.civilizations.includes(civilizationKey(civilization))
}

const SOLDIER_EARLY_ARMOR_EQUIPMENT: readonly UnitEquipmentDefinition[] = [
  { equipment: 'armor_leather', minLevel: 2, maxLevel: 9 },
  {
    equipment: 'shoulder_legion_ceramic',
    ageEquipment: metalAgeEquipment('shoulder_legion_copper', 'shoulder_legion_bronze', 'shoulder_legion_iron'),
    minLevel: 4,
  },
  {
    equipment: 'bracers_ceramic',
    ageEquipment: metalAgeEquipment('bracers_copper', 'bracers_bronze', 'bracers_iron'),
    minLevel: 5,
  },
  {
    equipment: 'helmet_pointed_ceramic',
    ageEquipment: metalAgeEquipment('helmet_pointed_copper', 'helmet_pointed_bronze', 'helmet_pointed_iron'),
    minLevel: 6,
    maxLevel: 14,
  },
]

const SOLDIER_CIVILIZATION_HELMET_EQUIPMENT: readonly UnitEquipmentDefinition[] = [
  {
    equipment: 'helmet_barbuta_ceramic',
    ageEquipment: metalAgeEquipment('helmet_barbuta_copper', 'helmet_barbuta_bronze', 'helmet_barbuta_iron'),
    civilizations: ['Greek'],
    minLevel: 15,
  },
  {
    equipment: 'helmet_legion_ceramic',
    ageEquipment: metalAgeEquipment('helmet_legion_copper', 'helmet_legion_bronze', 'helmet_legion_iron'),
    civilizations: ['Roman'],
    minLevel: 15,
  },
  {
    equipment: 'helmet_nasal_ceramic',
    ageEquipment: metalAgeEquipment('helmet_nasal_copper', 'helmet_nasal_bronze', 'helmet_nasal_iron'),
    civilizations: ['Babylonian', 'Nubian'],
    minLevel: 15,
  },
  {
    equipment: 'helmet_bascinet_round_ceramic',
    ageEquipment: metalAgeEquipment(
      'helmet_bascinet_round_copper',
      'helmet_bascinet_round_bronze',
      'helmet_bascinet_round_iron'
    ),
    civilizations: ['Egyptian', 'Asian', 'Celtic'],
    minLevel: 15,
  },
  {
    equipment: 'helmet_norman_ceramic',
    ageEquipment: metalAgeEquipment('helmet_norman_copper', 'helmet_norman_bronze', 'helmet_norman_iron'),
    civilizations: ['Nordic'],
    minLevel: 15,
  },
]

const SOLDIER_CIVILIZATION_DECORATION_EQUIPMENT: readonly UnitEquipmentDefinition[] = [
  { equipment: 'centurion_crest', civilizations: ['Greek'], minLevel: 16 },
  { equipment: 'centurion_plumage', civilizations: ['Roman'], minLevel: 16 },
  { equipment: 'legion_plumage', civilizations: ['Babylonian'], minLevel: 16 },
  { equipment: 'plumage', civilizations: ['Egyptian', 'Asian', 'Nubian'], minLevel: 16 },
  { equipment: 'helmet_wings', civilizations: ['Celtic'], minLevel: 16 },
  { equipment: 'upward_horns_white', civilizations: ['Nordic'], minLevel: 16 },
]

const SOLDIER_HEAVY_ARMOR_EQUIPMENT: readonly UnitEquipmentDefinition[] = [
  {
    equipment: 'armor_mail_ceramic',
    ageEquipment: metalAgeEquipment('armor_mail_copper', 'armor_mail_bronze', 'armor_mail_iron'),
    minLevel: 10,
    maxLevel: 17,
  },
  {
    equipment: 'armor_legion_ceramic',
    ageEquipment: metalAgeEquipment('armor_legion_copper', 'armor_legion_bronze', 'armor_legion_iron'),
    minLevel: 18,
  },
  {
    equipment: 'leg_armor_ceramic',
    ageEquipment: metalAgeEquipment('leg_armor_copper', 'leg_armor_bronze', 'leg_armor_iron'),
    minLevel: 12,
  },
  { equipment: 'cape_solid', minLevel: 14 },
  ...SOLDIER_CIVILIZATION_HELMET_EQUIPMENT,
  ...SOLDIER_CIVILIZATION_DECORATION_EQUIPMENT,
]

const UNIT_EQUIPMENT: Partial<Record<string, readonly UnitEquipmentDefinition[]>> = {
  [UNIT_TYPES.chief]: [
    { equipment: 'sword_ceramic', ageEquipment: metalAgeEquipment('sword_copper', 'sword_bronze', 'sword_iron') },
  ],
  [UNIT_TYPES.infantry]: [
    { equipment: 'sword_ceramic', ageEquipment: metalAgeEquipment('sword_copper', 'sword_bronze', 'sword_iron') },
    ...SOLDIER_EARLY_ARMOR_EQUIPMENT,
    {
      equipment: 'round_shield_ceramic_slash',
      ageEquipment: metalAgeEquipment(
        'round_shield_copper_slash',
        'round_shield_bronze_slash',
        'round_shield_iron_slash'
      ),
      minLevel: 8,
    },
    ...SOLDIER_HEAVY_ARMOR_EQUIPMENT,
  ],
  [UNIT_TYPES.bowman]: [
    'quiver',
    { equipment: 'bow', ageEquipment: { 1: 'bow_great', 2: 'bow_recurve' } },
    {
      equipment: 'arrow_ceramic',
      ageEquipment: metalAgeEquipment('arrow_copper', 'arrow_bronze', 'arrow_iron'),
      options: { hideOnOrAfterFrame: HIDE_ARROW_LAYER_FROM_SHOOT_RELEASE_FRAME },
    },
    ...SOLDIER_EARLY_ARMOR_EQUIPMENT,
    ...SOLDIER_HEAVY_ARMOR_EQUIPMENT,
  ],
  [UNIT_TYPES.priest]: ['cane'],
  [UNIT_TYPES.banditChief]: [
    'axe_ceramic',
    'armor_leather',
    'cape_solid',
    'helmet_barbarian_ceramic',
    'upward_horns_ceramic',
    'round_shield_ceramic_slash',
  ],
  [UNIT_TYPES.banditSword]: ['sword_ceramic', 'helmet_barbarian_nasal_ceramic', 'round_shield_ceramic_slash'],
  [UNIT_TYPES.banditArcher]: [
    'quiver',
    'bow',
    {
      equipment: 'arrow_ceramic',
      options: { hideOnOrAfterFrame: HIDE_ARROW_LAYER_FROM_SHOOT_RELEASE_FRAME },
    },
    'sack_cloth_hood_leather',
  ],
}

const VILLAGER_WORK_EQUIPMENT: readonly {
  workType: string
  equipment: DynamicEquipmentKey
  ageEquipment?: AgeEquipmentOverrides
  options?: EquipmentOptions
}[] = [
  {
    workType: WORK_TYPES.woodcutter,
    equipment: 'axe_ceramic',
    ageEquipment: metalAgeEquipment('axe_copper', 'axe_bronze', 'axe_iron'),
    options: { actionWorkSheetOverrides: { [`${WORK_TYPES.attacker}:${ACTION_TYPES.attack}`]: {} } },
  },
  {
    workType: WORK_TYPES.stoneminer,
    equipment: 'pickaxe_ceramic',
    ageEquipment: metalAgeEquipment('pickaxe_copper', 'pickaxe_bronze', 'pickaxe_iron'),
  },
  {
    workType: WORK_TYPES.goldminer,
    equipment: 'pickaxe_ceramic',
    ageEquipment: metalAgeEquipment('pickaxe_copper', 'pickaxe_bronze', 'pickaxe_iron'),
  },
  {
    workType: WORK_TYPES.builder,
    equipment: 'hammer_ceramic',
    ageEquipment: metalAgeEquipment('hammer_copper', 'hammer_bronze', 'hammer_iron'),
  },
  {
    workType: 'heroSword',
    equipment: 'sword_ceramic',
    ageEquipment: metalAgeEquipment('sword_copper', 'sword_bronze', 'sword_iron'),
  },
  {
    workType: WORK_TYPES.farmer,
    equipment: 'scythe_ceramic',
    ageEquipment: metalAgeEquipment('scythe_copper', 'scythe_bronze', 'scythe_iron'),
  },
  {
    workType: WORK_TYPES.hunter,
    equipment: 'quiver',
    options: { hideForActions: [ACTION_TYPES.takemeat] },
  },
  {
    workType: WORK_TYPES.hunter,
    equipment: 'bow',
    ageEquipment: { 1: 'bow_great', 2: 'bow_recurve' },
    options: { hideForActions: [ACTION_TYPES.takemeat] },
  },
  {
    workType: WORK_TYPES.hunter,
    equipment: 'arrow_ceramic',
    ageEquipment: metalAgeEquipment('arrow_copper', 'arrow_bronze', 'arrow_iron'),
    options: {
      hideForActions: [ACTION_TYPES.takemeat],
      hideOnOrAfterFrame: HIDE_ARROW_LAYER_FROM_SHOOT_RELEASE_FRAME,
    },
  },
]

function equipmentAlias(equipment: DynamicEquipmentKey, layer: EquipmentLayer, sheet: EquipmentLoadSheet): string {
  return `${EQUIPMENT_BASE_ALIAS}/${equipment}/${layer}/${sheet}`
}

function equipmentVariantAlias(
  equipment: DynamicEquipmentKey,
  layer: EquipmentLayer,
  sheet: EquipmentLoadSheet,
  variant: string
): string {
  return `${equipmentAlias(equipment, layer, sheet)}/${variant}`
}

function equipmentFamilyPath(equipment: DynamicEquipmentKey): string {
  if (equipment.startsWith('armor_mail_')) return 'armor/armor_mail'
  if (equipment.startsWith('armor_legion_')) return 'armor/armor_legion'
  if (equipment === 'armor_leather') return 'armor/armor_leather'
  if (equipment.startsWith('helmet_pointed_')) return 'helmet/helmet_pointed'
  if (equipment.startsWith('helmet_barbuta_')) return 'helmet/helmet_barbuta'
  if (equipment.startsWith('helmet_legion_')) return 'helmet/helmet_legion'
  if (equipment.startsWith('helmet_nasal_')) return 'helmet/helmet_nasal'
  if (equipment.startsWith('helmet_bascinet_round_')) return 'helmet/helmet_bascinet_round'
  if (equipment.startsWith('helmet_norman_')) return 'helmet/helmet_norman'
  if (equipment.startsWith('helmet_barbarian_nasal_')) return 'helmet/helmet_barbarian_nasal'
  if (equipment.startsWith('helmet_barbarian_')) return 'helmet/helmet_barbarian'
  if (equipment.startsWith('shoulder_legion_')) return 'armor/shoulder_legion'
  if (equipment.startsWith('bracers_')) return 'armor/bracers'
  if (equipment.startsWith('leg_armor_')) return 'armor/leg_armor'
  if (equipment.startsWith('axe_')) return 'weapon/axe'
  if (equipment.startsWith('pickaxe_')) return 'tool/pickaxe'
  if (equipment.startsWith('hammer_')) return 'tool/hammer'
  if (equipment.startsWith('scythe_')) return 'tool/scythe'
  if (equipment === 'bow' || equipment === 'bow_great' || equipment === 'bow_recurve') return 'weapon/bow'
  if (equipment.startsWith('arrow_')) return 'weapon/arrow'
  if (equipment === 'halberd') return 'weapon/halberd'
  if (equipment.startsWith('sword_') || equipment === 'longsword') return 'weapon/sword'
  if (equipment.startsWith('round_shield_')) return 'weapon/round_shield'
  if (equipment === 'cape_solid') return 'accessory/cape'
  if (
    equipment === 'crest' ||
    equipment === 'centurion_crest' ||
    equipment === 'centurion_plumage' ||
    equipment === 'legion_plumage' ||
    equipment === 'plumage'
  ) {
    return 'accessory/plumage'
  }
  if (equipment.startsWith('upward_horns_')) return 'accessory/upward_horns'
  if (equipment === 'helmet_wings') return 'accessory/helmet_wings'
  if (equipment === 'sack_cloth_hood_leather') return 'helmet/sack_cloth_hood'
  if (equipment === 'cane') return 'weapon/cane'
  if (equipment === 'quiver') return 'weapon/quiver'
  return `misc/${equipment}`
}

function equipmentFamilyAlias(equipment: DynamicEquipmentKey): string {
  return `${EQUIPMENT_BASE_ALIAS}/${equipmentFamilyPath(equipment)}`
}

function equipmentFamilySrc(equipment: DynamicEquipmentKey): string {
  return `${EQUIPMENT_BASE_URL}/${equipmentFamilyPath(equipment)}/texture.json`
}

function frameSuffixForAlias(alias: string): string {
  return `_graphics_${alias.split('/').join('_')}.png`
}

function animationSpeedForEquipmentSheet(sheet: EquipmentLoadSheet): number {
  return sheet === 'corpse' ? 0 : 0.3
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
              ? { shootingSheet: equipmentAlias(equipment, layer, EQUIPMENT_SHOOTING_SHEET) }
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
    ? equipmentAlias(equipment, layer, EQUIPMENT_SHOOTING_SHEET)
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
      if (WEARABLE_SHOOTING_EQUIPMENT_KEYS.has(equipment)) sheetsToLoad.push(EQUIPMENT_SHOOTING_SHEET)
      return sheetsToLoad.flatMap(sheet => {
        if (GENDERED_EQUIPMENT_KEYS.has(equipment)) {
          return ['male', 'female'].map(variant => {
            const alias = equipmentVariantAlias(equipment, layer, sheet, variant)
            return {
              alias,
              atlasAlias: equipmentFamilyAlias(equipment),
              animationSpeed: animationSpeedForEquipmentSheet(sheet),
              frameSuffix: frameSuffixForAlias(alias),
            }
          })
        }
        const alias = equipmentAlias(equipment, layer, sheet)
        return [
          {
            alias,
            atlasAlias: equipmentFamilyAlias(equipment),
            animationSpeed: animationSpeedForEquipmentSheet(sheet),
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
