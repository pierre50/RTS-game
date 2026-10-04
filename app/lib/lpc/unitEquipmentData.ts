import { ACTION_TYPES, UNIT_TYPES, WORK_TYPES } from '../../constants'
import type { UnitEquipmentDefinition, DynamicEquipmentKey, EquipmentOptions } from './equipmentData'

const HIDE_ARROW_LAYER_FROM_SHOOT_RELEASE_FRAME = 9

const SOLDIER_EARLY_ARMOR_EQUIPMENT: readonly UnitEquipmentDefinition[] = [
  { equipment: 'armor_leather', minLevel: 2, maxLevel: 9 },
  {
    equipment: 'shoulder_legion_ceramic',
    minLevel: 4,
  },
  {
    equipment: 'bracers_ceramic',
    minLevel: 5,
  },
  {
    equipment: 'helmet_pointed_ceramic',
    minLevel: 6,
    maxLevel: 14,
  },
]

const SOLDIER_CIVILIZATION_HELMET_EQUIPMENT: readonly UnitEquipmentDefinition[] = [
  {
    equipment: 'helmet_barbuta_ceramic',
    civilizations: ['Hellas'],
    minLevel: 15,
  },
  {
    equipment: 'helmet_legion_ceramic',
    civilizations: ['Latium'],
    minLevel: 15,
  },
  {
    equipment: 'helmet_nasal_ceramic',
    civilizations: ['Sumeria', 'Nobatia'],
    minLevel: 15,
  },
  {
    equipment: 'helmet_bascinet_round_ceramic',
    civilizations: ['Kemet', 'Xia', 'Alba'],
    minLevel: 15,
  },
  {
    equipment: 'helmet_norman_ceramic',
    civilizations: ['Nord'],
    minLevel: 15,
  },
]

const SOLDIER_CIVILIZATION_DECORATION_EQUIPMENT: readonly UnitEquipmentDefinition[] = [
  { equipment: 'centurion_crest', civilizations: ['Hellas'], minLevel: 16 },
  { equipment: 'centurion_plumage', civilizations: ['Latium'], minLevel: 16 },
  { equipment: 'legion_plumage', civilizations: ['Sumeria'], minLevel: 16 },
  { equipment: 'plumage', civilizations: ['Kemet', 'Xia', 'Nobatia'], minLevel: 16 },
  { equipment: 'helmet_wings', civilizations: ['Alba'], minLevel: 16 },
  { equipment: 'upward_horns_white', civilizations: ['Nord'], minLevel: 16 },
]

const SOLDIER_HEAVY_ARMOR_EQUIPMENT: readonly UnitEquipmentDefinition[] = [
  {
    equipment: 'armor_mail_ceramic',
    minLevel: 10,
    maxLevel: 17,
  },
  {
    equipment: 'armor_legion_ceramic',
    minLevel: 18,
  },
  {
    equipment: 'leg_armor_ceramic',
    minLevel: 12,
  },
  { equipment: 'cape_solid', minLevel: 14 },
  ...SOLDIER_CIVILIZATION_HELMET_EQUIPMENT,
  ...SOLDIER_CIVILIZATION_DECORATION_EQUIPMENT,
]

export const UNIT_EQUIPMENT: Partial<Record<string, readonly UnitEquipmentDefinition[]>> = {
  [UNIT_TYPES.chief]: [{ equipment: 'sword_ceramic' }],
  [UNIT_TYPES.infantry]: [
    { equipment: 'sword_ceramic' },
    ...SOLDIER_EARLY_ARMOR_EQUIPMENT,
    {
      equipment: 'round_shield_ceramic_slash',
      minLevel: 8,
    },
    ...SOLDIER_HEAVY_ARMOR_EQUIPMENT,
  ],
  [UNIT_TYPES.bowman]: [
    'quiver',
    'bow',
    {
      equipment: 'arrow_ceramic',
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

export const VILLAGER_WORK_EQUIPMENT: readonly {
  workType: string
  equipment: DynamicEquipmentKey
  options?: EquipmentOptions
}[] = [
  {
    workType: WORK_TYPES.woodcutter,
    equipment: 'axe_ceramic',
  },
  {
    workType: WORK_TYPES.stoneminer,
    equipment: 'pickaxe_ceramic',
  },
  {
    workType: WORK_TYPES.goldminer,
    equipment: 'pickaxe_ceramic',
  },
  {
    workType: WORK_TYPES.builder,
    equipment: 'hammer_ceramic',
  },
  {
    workType: 'heroSword',
    equipment: 'sword_ceramic',
  },
  {
    workType: WORK_TYPES.farmer,
    equipment: 'scythe_ceramic',
  },
  {
    workType: WORK_TYPES.horseCapture,
    equipment: 'longstick',
  },
  {
    workType: WORK_TYPES.hunter,
    equipment: 'quiver',
    options: { hideForActions: [ACTION_TYPES.takemeat] },
  },
  {
    workType: WORK_TYPES.hunter,
    equipment: 'bow',
    options: { hideForActions: [ACTION_TYPES.takemeat] },
  },
  {
    workType: WORK_TYPES.hunter,
    equipment: 'arrow_ceramic',
    options: {
      hideForActions: [ACTION_TYPES.takemeat],
      hideOnOrAfterFrame: HIDE_ARROW_LAYER_FROM_SHOOT_RELEASE_FRAME,
    },
  },
]
