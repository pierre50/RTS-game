import { SOLDIER_CIVILIZATION_HELMET_EQUIPMENT } from './civilizationHelmets'
import { SOLDIER_CIVILIZATION_DECORATION_EQUIPMENT } from './civilizationHelmetDecorations'
import { ACTION_TYPES, UNIT_TYPES, WORK_TYPES } from '../../constants'
import type { UnitEquipmentDefinition, DynamicEquipmentKey, EquipmentOptions } from './equipmentData'

const HIDE_ARROW_LAYER_FROM_SHOOT_RELEASE_FRAME = 9

const SOLDIER_EARLY_ARMOR_EQUIPMENT: readonly UnitEquipmentDefinition[] = [
  { equipment: 'armor_leather', minLevel: 2, maxLevel: 9 },
  {
    equipment: 'shoulder_legion_leather',
    minLevel: 4,
  },
  {
    equipment: 'bracers_leather',
    minLevel: 5,
  },
  {
    equipment: 'helmet_pointed_leather',
    minLevel: 6,
    maxLevel: 14,
  },
]

const SOLDIER_HEAVY_ARMOR_EQUIPMENT: readonly UnitEquipmentDefinition[] = [
  {
    equipment: 'armor_mail_iron',
    minLevel: 10,
    maxLevel: 17,
  },
  {
    equipment: 'armor_legion_bronze',
    minLevel: 18,
  },
  {
    equipment: 'leg_armor_leather',
    minLevel: 12,
  },
  ...SOLDIER_CIVILIZATION_HELMET_EQUIPMENT,
  ...SOLDIER_CIVILIZATION_DECORATION_EQUIPMENT,
]

export const UNIT_EQUIPMENT: Partial<Record<string, readonly UnitEquipmentDefinition[]>> = {
  [UNIT_TYPES.chief]: [{ equipment: 'sword_bronze' }],
  [UNIT_TYPES.infantry]: [
    { equipment: 'spear_ceramic' },
    ...SOLDIER_EARLY_ARMOR_EQUIPMENT,
    {
      equipment: 'round_shield_wood_slash',
      minLevel: 8,
    },
    ...SOLDIER_HEAVY_ARMOR_EQUIPMENT,
  ],
  [UNIT_TYPES.bowman]: [
    'dagger_bronze',
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
    'mace_bronze',
    'armor_leather',
    'helmet_barbarian_leather',
    'upward_horns_white',
    'round_shield_wood_slash',
  ],
  [UNIT_TYPES.banditSword]: ['sword_bronze', 'helmet_barbarian_nasal_leather', 'round_shield_wood_slash'],
  [UNIT_TYPES.banditArcher]: [
    'dagger_bronze',
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
    equipment: 'sword_bronze',
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
