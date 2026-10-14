import { workToolFamily } from './workTools'
import { getEquipmentDisplayName } from './equipmentNames'
import { isHelmetDecoration } from './helmetVariants'
import { equipmentBaseKey } from './equipmentCondition'
import type { HeroEquipmentSlot, HeroWeaponSlot } from '../../types/entities'

export const HERO_EQUIPMENT_SLOTS: readonly HeroEquipmentSlot[] = [
  'helmet',
  'armor',
  'shoulders',
  'legs',
  'bracers',
  'offhand',
  'arrow',
]

const SLOT_LABEL_KEYS: Record<HeroEquipmentSlot, string> = {
  helmet: 'heroEquipmentSlotHelmet',
  helmetDecor: 'heroEquipmentSlotHelmetDecor',
  cape: 'heroEquipmentSlotCape',
  armor: 'heroEquipmentSlotArmor',
  legs: 'heroEquipmentSlotLegs',
  shoulders: 'heroEquipmentSlotShoulders',
  bracers: 'heroEquipmentSlotBracers',
  offhand: 'heroEquipmentSlotOffhand',
  arrow: 'heroEquipmentSlotArrow',
}

export function getHeroEquipmentSlotLabelKey(slot: HeroEquipmentSlot): string {
  return SLOT_LABEL_KEYS[slot]
}

export function getEquipmentSlot(equipment: string): HeroEquipmentSlot | null {
  equipment = equipmentBaseKey(equipment)
  if (isHelmetDecoration(equipment)) {
    return 'helmetDecor'
  }
  if (equipment.startsWith('helmet_') || equipment.includes('_hood_')) return 'helmet'
  if (equipment.startsWith('cape_')) return null
  if (equipment.startsWith('armor_')) return 'armor'
  if (equipment.startsWith('leg_')) return 'legs'
  if (equipment.startsWith('shoulder_')) return 'shoulders'
  if (equipment.startsWith('bracers_')) return 'bracers'
  if (equipment.includes('shield')) return 'offhand'
  if (equipment.startsWith('arrow_')) return 'arrow'
  return null
}

export function getWeaponSlot(equipment: string): HeroWeaponSlot | null {
  equipment = equipmentBaseKey(equipment)
  if (workToolFamily(equipment)) return 'tool'
  if (equipment === 'slingshot' || equipment.startsWith('bow')) return 'ranged'
  if (
    equipment.startsWith('sword_') ||
    equipment.startsWith('dagger_') ||
    equipment.startsWith('spear_') ||
    equipment.startsWith('mace_') ||
    equipment === 'club_ceramic' ||
    equipment === 'cane' ||
    equipment === 'catchingPole' ||
    equipment === 'longstick'
  ) {
    return 'melee'
  }
  return null
}

export function formatEquipmentLootLabel(equipment: string): string {
  return getEquipmentDisplayName(equipment)
}

export function formatEquipmentStackLabel(equipment: string, count = 1): string {
  const label = formatEquipmentLootLabel(equipment)
  return count > 1 ? `${label} x${count}` : label
}
