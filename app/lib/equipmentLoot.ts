import { SHEET_TYPES, UNIT_TYPES } from '../constants'
import { getUnitEquipment, refreshUnitEquipmentStats } from './equipmentStats'
import { getUnitEquipmentLevel } from './unitExperience'
import { applyBakedLpcUnitAssets } from './lpc'
import type { HeroEquipmentSlot, HeroWeaponSlot, UnitEntity } from '../types/entities'

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

export const HERO_WEAPON_SLOTS: readonly HeroWeaponSlot[] = ['melee', 'ranged']

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

const WEAPON_SLOT_LABEL_KEYS: Record<HeroWeaponSlot, string> = {
  melee: 'heroWeaponSlotMelee',
  ranged: 'heroWeaponSlotRanged',
  lasso: 'heroWeaponSlotLasso',
  offhand: 'heroWeaponSlotOffhand',
  quiver: 'heroWeaponSlotQuiver',
}

const HELMET_DECOR_PREFIXES = ['upward_horns', 'helmet_wings', 'plumage', 'centurion_crest', 'centurion_plumage', 'legion_plumage', 'crest']
const HELMET_DECOR_COMPANIONS: Partial<Record<string, string>> = {
  helmet_barbarian_ceramic: 'upward_horns_ceramic',
  helmet_norman_bronze: 'upward_horns_white',
  helmet_norman_iron: 'upward_horns_white',
}

export type EquipmentStack = {
  equipment: string
  count: number
}

export function getHeroEquipmentSlotLabelKey(slot: HeroEquipmentSlot): string {
  return SLOT_LABEL_KEYS[slot]
}

export function getHeroWeaponSlotLabelKey(slot: HeroWeaponSlot): string {
  return WEAPON_SLOT_LABEL_KEYS[slot]
}

export function getEquipmentSlot(equipment: string): HeroEquipmentSlot | null {
  if (equipment.startsWith('helmet_') || equipment.includes('_hood_')) return 'helmet'
  if (HELMET_DECOR_PREFIXES.some(prefix => equipment === prefix || equipment.startsWith(`${prefix}_`))) {
    return 'helmetDecor'
  }
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
  if (equipment === 'lasso') return 'lasso'
  if (equipment.startsWith('bow')) return 'ranged'
  if (
    equipment.startsWith('sword_') ||
    equipment.startsWith('axe_') ||
    equipment === 'longsword' ||
    equipment === 'halberd' ||
    equipment === 'cane'
  ) {
    return 'melee'
  }
  return null
}

function getHeroInventory(hero: UnitEntity): NonNullable<UnitEntity['inventory']> {
  hero.inventory = hero.inventory ?? {}
  hero.inventory.equipment = hero.inventory.equipment ?? []
  hero.inventory.equipped = hero.inventory.equipped ?? {}
  hero.inventory.equippedCounts = hero.inventory.equippedCounts ?? {}
  hero.inventory.activeWeapons = hero.inventory.activeWeapons ?? {}
  return hero.inventory
}

function cleanEquipment(items: readonly string[]): string[] {
  return items.filter(item => typeof item === 'string' && item.length > 0)
}

export function getEquipmentStacks(items: readonly string[]): EquipmentStack[] {
  const counts = new Map<string, number>()
  for (const item of cleanEquipment(items)) {
    counts.set(item, (counts.get(item) ?? 0) + 1)
  }
  return [...counts.entries()].map(([equipment, count]) => ({ equipment, count }))
}

export function formatEquipmentLootLabel(equipment: string): string {
  return equipment
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function formatEquipmentStackLabel(equipment: string, count = 1): string {
  const label = formatEquipmentLootLabel(equipment)
  return count > 1 ? `${label} x${count}` : label
}

export function getHeroEquippedItemCount(hero: UnitEntity | null | undefined, slot: HeroEquipmentSlot): number {
  if (!hero?.inventory?.equipped?.[slot]) return 0
  return Math.max(1, Math.floor(hero.inventory.equippedCounts?.[slot] ?? 1))
}

function pushEquipmentCopies(bag: string[], equipment: string, count: number): void {
  for (let i = 0; i < count; i++) {
    bag.push(equipment)
  }
}

function removeAllBagEquipment(bag: string[], equipment: string): number {
  let count = 0
  for (let i = bag.length - 1; i >= 0; i--) {
    if (bag[i] !== equipment) continue
    bag.splice(i, 1)
    count += 1
  }
  return count
}

export function getUnitCorpseLootEquipment(unit: UnitEntity): string[] {
  if (!unit.isDead || unit.isDestroyed) return []
  if (Array.isArray(unit.lootEquipment)) return unit.lootEquipment

  const config = unit.owner?.config.units[unit.type]
  const isVillagerWithWorkTool = unit.type === UNIT_TYPES.villager && Boolean(unit.work)
  const equipment = isVillagerWithWorkTool
    ? []
    : getUnitEquipment(
        unit.type,
        config,
        unit.owner?.age,
        getUnitEquipmentLevel(unit, config?.category),
        unit.owner?.civ
      )

  unit.lootEquipment = cleanEquipment(equipment)
  return unit.lootEquipment
}

export function pickupCorpseEquipment(corpse: UnitEntity, hero: UnitEntity | null | undefined, equipment: string): boolean {
  if (!hero || !corpse.isDead || corpse.isDestroyed) return false
  const loot = getUnitCorpseLootEquipment(corpse)
  const index = loot.indexOf(equipment)
  if (index < 0) return false

  loot.splice(index, 1)
  if (Array.isArray(corpse.equipment)) {
    const equipmentIndex = corpse.equipment.indexOf(equipment)
    if (equipmentIndex >= 0) corpse.equipment.splice(equipmentIndex, 1)
  }

  getHeroInventory(hero).equipment!.push(equipment)
  applyBakedLpcUnitAssets(corpse)
  corpse.syncAppearanceLayers?.(corpse.currentSheet ?? SHEET_TYPES.corpse)
  return true
}

export function equipHeroInventoryItem(hero: UnitEntity | null | undefined, equipment: string): boolean {
  if (!hero) return false
  const slot = getEquipmentSlot(equipment)
  if (!slot) return equipHeroWeaponInventoryItem(hero, equipment)
  const inventory = getHeroInventory(hero)
  if (slot === 'helmetDecor' && !inventory.equipped!.helmet) return false
  const bag = inventory.equipment!
  const bagIndex = bag.indexOf(equipment)
  if (bagIndex < 0) return false

  let equipCount = slot === 'arrow' ? removeAllBagEquipment(bag, equipment) : 1
  if (slot !== 'arrow') bag.splice(bagIndex, 1)
  const previous = inventory.equipped![slot]
  if (previous === equipment && slot === 'arrow') {
    equipCount += getHeroEquippedItemCount(hero, slot)
  } else if (previous) {
    pushEquipmentCopies(bag, previous, getHeroEquippedItemCount(hero, slot))
  }
  inventory.equipped![slot] = equipment
  inventory.equippedCounts![slot] = equipCount
  if (slot === 'helmet' && !inventory.equipped!.helmetDecor) {
    const decor = HELMET_DECOR_COMPANIONS[equipment]
    const decorIndex = decor ? bag.indexOf(decor) : -1
    if (decor && decorIndex >= 0) {
      bag.splice(decorIndex, 1)
      inventory.equipped!.helmetDecor = decor
      inventory.equippedCounts!.helmetDecor = 1
    }
  }
  refreshUnitEquipmentStats(hero)
  applyBakedLpcUnitAssets(hero)
  hero.syncAppearanceLayers?.(hero.currentSheet ?? SHEET_TYPES.standing)
  return true
}

export function equipHeroWeaponInventoryItem(hero: UnitEntity | null | undefined, equipment: string): boolean {
  if (!hero) return false
  const slot = getWeaponSlot(equipment)
  if (!slot) return false
  const inventory = getHeroInventory(hero)
  const bag = inventory.equipment!
  const bagIndex = bag.indexOf(equipment)
  if (bagIndex < 0) return false

  bag.splice(bagIndex, 1)
  const previous = inventory.activeWeapons![slot]
  if (previous) bag.push(previous)
  inventory.activeWeapons![slot] = equipment
  refreshUnitEquipmentStats(hero)
  applyBakedLpcUnitAssets(hero)
  hero.syncAppearanceLayers?.(hero.currentSheet ?? SHEET_TYPES.standing)
  return true
}

export function unequipHeroInventorySlot(hero: UnitEntity | null | undefined, slot: HeroEquipmentSlot): boolean {
  if (!hero?.inventory?.equipped?.[slot]) return false
  const inventory = getHeroInventory(hero)
  const equipment = inventory.equipped![slot]
  const count = getHeroEquippedItemCount(hero, slot)
  delete inventory.equipped![slot]
  delete inventory.equippedCounts![slot]
  if (equipment) pushEquipmentCopies(inventory.equipment!, equipment, count)
  if (slot === 'helmet' && inventory.equipped!.helmetDecor) {
    const decor = inventory.equipped!.helmetDecor
    const decorCount = getHeroEquippedItemCount(hero, 'helmetDecor')
    delete inventory.equipped!.helmetDecor
    delete inventory.equippedCounts!.helmetDecor
    pushEquipmentCopies(inventory.equipment!, decor, decorCount)
  }
  refreshUnitEquipmentStats(hero)
  applyBakedLpcUnitAssets(hero)
  hero.syncAppearanceLayers?.(hero.currentSheet ?? SHEET_TYPES.standing)
  return true
}

export function consumeHeroEquippedItem(hero: UnitEntity | null | undefined, slot: HeroEquipmentSlot, count = 1): boolean {
  if (!hero?.inventory?.equipped?.[slot]) return false
  const inventory = getHeroInventory(hero)
  const currentCount = getHeroEquippedItemCount(hero, slot)
  const nextCount = currentCount - Math.max(1, Math.floor(count))
  if (nextCount > 0) {
    inventory.equippedCounts![slot] = nextCount
  } else {
    delete inventory.equipped![slot]
    delete inventory.equippedCounts![slot]
  }
  refreshUnitEquipmentStats(hero)
  applyBakedLpcUnitAssets(hero)
  return true
}

export function unequipHeroWeaponSlot(hero: UnitEntity | null | undefined, slot: HeroWeaponSlot): boolean {
  if (!hero?.inventory?.activeWeapons?.[slot]) return false
  const inventory = getHeroInventory(hero)
  const equipment = inventory.activeWeapons![slot]
  delete inventory.activeWeapons![slot]
  if (equipment) inventory.equipment!.push(equipment)
  refreshUnitEquipmentStats(hero)
  applyBakedLpcUnitAssets(hero)
  hero.syncAppearanceLayers?.(hero.currentSheet ?? SHEET_TYPES.standing)
  return true
}
