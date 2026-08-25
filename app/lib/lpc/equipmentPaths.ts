import type { DynamicEquipmentKey, EquipmentLayer, EquipmentLoadSheet } from './equipmentData'

const EQUIPMENT_BASE_ALIAS = 'lpc-equipment'
const EQUIPMENT_BASE_URL = 'assets/graphics/lpc-equipment'

export function equipmentAlias(equipment: DynamicEquipmentKey, layer: EquipmentLayer, sheet: EquipmentLoadSheet): string {
  return `${EQUIPMENT_BASE_ALIAS}/${equipment}/${layer}/${sheet}`
}

export function equipmentVariantAlias(
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

export function equipmentFamilyAlias(equipment: DynamicEquipmentKey): string {
  return `${EQUIPMENT_BASE_ALIAS}/${equipmentFamilyPath(equipment)}`
}

export function equipmentFamilySrc(equipment: DynamicEquipmentKey): string {
  return `${EQUIPMENT_BASE_URL}/${equipmentFamilyPath(equipment)}/texture.json`
}

export function frameSuffixForAlias(alias: string): string {
  return `_graphics_${alias.split('/').join('_')}.png`
}
