import { ACTION_TYPES, SHEET_TYPES, UNIT_TYPES, WORK_TYPES } from '../../constants'
import type { UnitAppearanceLayerConfig } from '../../types/config'

const EQUIPMENT_BASE_ALIAS = 'lpc-equipment'
const EQUIPMENT_BASE_URL = 'assets/graphics/lpc-equipment'
const EQUIPMENT_DEATH_SHEETS = ['walking', 'action', 'dying', 'corpse'] as const

type EquipmentSheet = (typeof EQUIPMENT_DEATH_SHEETS)[number]
const EQUIPMENT_SHEETS = ['walking', 'action'] as const satisfies readonly EquipmentSheet[]
type EquipmentLayer = 'back' | 'front'
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
  | 'meat'
  | 'stone'
  | 'gold'
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
  | 'hideWhenLoading'
  | 'showWhenLoading'
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

const EQUIPMENT_LAYERS = ['back', 'front'] as const satisfies readonly EquipmentLayer[]

// Equipment whose art never populates one side of the back/front split (e.g. a shield
// held in front has no "behind the body" counterpart) — baking/wiring that empty side
// would just be a fully transparent spritesheet. Keep in sync with
// equipment.active_layer_keys() in the Python bake pipeline.
const EQUIPMENT_LAYER_OVERRIDES: Partial<Record<DynamicEquipmentKey, readonly EquipmentLayer[]>> = {
  meat: ['front'],
  stone: ['front'],
  gold: ['front'],
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

const GENDERED_EQUIPMENT_KEYS = new Set<DynamicEquipmentKey>([
  'armor_leather',
  'armor_mail_ceramic',
  'armor_mail_copper',
  'armor_mail_bronze',
  'armor_mail_iron',
  'armor_legion_ceramic',
  'armor_legion_copper',
  'armor_legion_bronze',
  'armor_legion_iron',
  'shoulder_legion_ceramic',
  'shoulder_legion_copper',
  'shoulder_legion_bronze',
  'shoulder_legion_iron',
  'leg_armor_ceramic',
  'leg_armor_copper',
  'leg_armor_bronze',
  'leg_armor_iron',
])

const WEARABLE_EQUIPMENT_KEYS = new Set<DynamicEquipmentKey>([
  'armor_leather',
  'armor_mail_ceramic',
  'armor_mail_copper',
  'armor_mail_bronze',
  'armor_mail_iron',
  'armor_legion_ceramic',
  'armor_legion_copper',
  'armor_legion_bronze',
  'armor_legion_iron',
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
])

const PLAYER_COLORED_EQUIPMENT_KEYS = new Set<DynamicEquipmentKey>([
  'cape_solid',
  'crest',
  'centurion_crest',
  'centurion_plumage',
  'legion_plumage',
  'plumage',
])

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
  helmet_barbarian_ceramic: { front: EQUIPMENT_DEATH_SHEETS },
  helmet_barbarian_nasal_ceramic: { front: EQUIPMENT_DEATH_SHEETS },
  quiver: { back: EQUIPMENT_DEATH_SHEETS },
  sack_cloth_hood_leather: { front: EQUIPMENT_DEATH_SHEETS },
  sword_ceramic: { back: EQUIPMENT_DEATH_SHEETS, front: EQUIPMENT_DEATH_SHEETS },
  sword_copper: { back: EQUIPMENT_DEATH_SHEETS, front: EQUIPMENT_DEATH_SHEETS },
  sword_bronze: { back: EQUIPMENT_DEATH_SHEETS, front: EQUIPMENT_DEATH_SHEETS },
  sword_iron: { back: EQUIPMENT_DEATH_SHEETS, front: EQUIPMENT_DEATH_SHEETS },
  upward_horns_ceramic: { back: EQUIPMENT_DEATH_SHEETS, front: EQUIPMENT_DEATH_SHEETS },
  cane: { front: ['walking'] },
  arrow_ceramic: { front: ['action'] },
  arrow_copper: { front: ['action'] },
  arrow_bronze: { front: ['action'] },
  arrow_iron: { front: ['action'] },
}

const DYNAMIC_EQUIPMENT_KEYS = [
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
  'meat',
  'stone',
  'gold',
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
  'armor_leather',
  'armor_mail_ceramic',
  'armor_mail_copper',
  'armor_mail_bronze',
  'armor_mail_iron',
  'armor_legion_ceramic',
  'armor_legion_copper',
  'armor_legion_bronze',
  'armor_legion_iron',
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
    options: { hideWhenLoading: true },
  },
  {
    workType: WORK_TYPES.goldminer,
    equipment: 'pickaxe_ceramic',
    ageEquipment: metalAgeEquipment('pickaxe_copper', 'pickaxe_bronze', 'pickaxe_iron'),
    options: { hideWhenLoading: true },
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
    options: { hideWhenLoading: true, hideForActions: [ACTION_TYPES.takemeat] },
  },
  {
    workType: WORK_TYPES.hunter,
    equipment: 'bow',
    ageEquipment: { 1: 'bow_great', 2: 'bow_recurve' },
    options: { hideWhenLoading: true, hideForActions: [ACTION_TYPES.takemeat] },
  },
  {
    workType: WORK_TYPES.hunter,
    equipment: 'arrow_ceramic',
    ageEquipment: metalAgeEquipment('arrow_copper', 'arrow_bronze', 'arrow_iron'),
    options: {
      hideWhenLoading: true,
      hideForActions: [ACTION_TYPES.takemeat],
      hideOnOrAfterFrame: HIDE_ARROW_LAYER_FROM_SHOOT_RELEASE_FRAME,
    },
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

function equipmentVariantAlias(
  equipment: DynamicEquipmentKey,
  layer: EquipmentLayer,
  sheet: EquipmentSheet,
  variant: string
): string {
  return `${equipmentAlias(equipment, layer, sheet)}/${variant}`
}

function equipmentVariantSrc(
  equipment: DynamicEquipmentKey,
  layer: EquipmentLayer,
  sheet: EquipmentSheet,
  variant: string
): string {
  return `${EQUIPMENT_BASE_URL}/${equipment}/${layer}/${sheet}/${variant}/texture.json`
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
  const dyingSheet = sheets.includes('dying') ? equipmentAlias(equipment, layer, 'dying') : undefined
  const corpseSheet = sheets.includes('corpse') ? equipmentAlias(equipment, layer, 'corpse') : undefined

  return {
    zIndex:
      layer === 'front' && WEARABLE_EQUIPMENT_KEYS.has(equipment)
        ? WEARABLE_EQUIPMENT_Z_INDEX
        : EQUIPMENT_LAYER_Z_INDEX[layer],
    ...options,
    ageSheetOverrides: ageSheetOverrides(layer, ageEquipment),
    appearanceVariantKey: GENDERED_EQUIPMENT_KEYS.has(equipment) ? 'gender' : undefined,
    palette: PLAYER_COLORED_EQUIPMENT_KEYS.has(equipment) ? 'player' : undefined,
    mountedCut: MOUNTED_UNCUT_EQUIPMENT_KEYS.has(equipment) ? false : options.mountedCut,
    standingSheet: walkingSheet,
    walkingSheet,
    mountedSheet: MOUNTED_WALKING_SHEET_EQUIPMENT_KEYS.has(equipment) ? walkingSheet : undefined,
    actionSheet,
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

export function dynamicEquipmentAssets(): { alias: string; src: string }[] {
  return DYNAMIC_EQUIPMENT_KEYS.flatMap(equipment =>
    (EQUIPMENT_LAYER_OVERRIDES[equipment] ?? EQUIPMENT_LAYERS).flatMap(layer =>
      equipmentSheets(equipment, layer).flatMap(sheet => {
        if (GENDERED_EQUIPMENT_KEYS.has(equipment)) {
          return ['male', 'female'].map(variant => ({
            alias: equipmentVariantAlias(equipment, layer, sheet, variant),
            src: equipmentVariantSrc(equipment, layer, sheet, variant),
          }))
        }
        return [
          {
            alias: equipmentAlias(equipment, layer, sheet),
            src: equipmentSrc(equipment, layer, sheet),
          },
        ]
      })
    )
  )
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
  return VILLAGER_WORK_EQUIPMENT.filter(({ workType: equipmentWork, options }) => {
    if (equipmentWork !== workType) return false
    return !options?.showWhenLoading
  }).map(({ equipment, ageEquipment }) => equipmentForAge(equipment, ageEquipment, age))
}
