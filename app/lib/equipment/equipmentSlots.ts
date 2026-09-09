import type { HeroEquipmentSlot, HeroWeaponSlot } from '../../types/entities'

export const HERO_EQUIPMENT_SLOTS: readonly HeroEquipmentSlot[] = [
  'helmet',
  'helmetDecor',
  'cape',
  'armor',
  'legs',
  'shoulders',
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

const HELMET_DECOR_PREFIXES = [
  'upward_horns',
  'helmet_wings',
  'plumage',
  'centurion_crest',
  'centurion_plumage',
  'legion_plumage',
  'crest',
]

export function getHeroEquipmentSlotLabelKey(slot: HeroEquipmentSlot): string {
  return SLOT_LABEL_KEYS[slot]
}

export function getEquipmentSlot(equipment: string): HeroEquipmentSlot | null {
  if (HELMET_DECOR_PREFIXES.some(prefix => equipment === prefix || equipment.startsWith(`${prefix}_`))) {
    return 'helmetDecor'
  }
  if (equipment.startsWith('helmet_') || equipment.includes('_hood_')) return 'helmet'
  if (equipment.startsWith('cape_')) return 'cape'
  if (equipment.startsWith('armor_')) return 'armor'
  if (equipment.startsWith('leg_')) return 'legs'
  if (equipment.startsWith('shoulder_')) return 'shoulders'
  if (equipment.startsWith('bracers_')) return 'bracers'
  if (equipment.includes('shield')) return 'offhand'
  if (equipment.startsWith('arrow_')) return 'arrow'
  return null
}

export function getWeaponSlot(equipment: string): HeroWeaponSlot | null {
  if (equipment === 'quiver') return 'quiver'
  if (equipment.startsWith('bow')) return 'ranged'
  if (
    equipment.startsWith('sword_') ||
    equipment.startsWith('axe_') ||
    equipment === 'longsword' ||
    equipment === 'halberd' ||
    equipment === 'cane' ||
    equipment === 'catchingPole' ||
    equipment === 'longstick'
  ) {
    return 'melee'
  }
  return null
}

export function formatEquipmentLootLabel(equipment: string): string {
  return equipment
    .split('_')
    .filter(Boolean)
    .filter(part => part.toLowerCase() !== 'bandit')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function formatEquipmentStackLabel(equipment: string, count = 1): string {
  const label = formatEquipmentLootLabel(equipment)
  return count > 1 ? `${label} x${count}` : label
}
