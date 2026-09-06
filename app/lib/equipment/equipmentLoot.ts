import { RESOURCE_STORAGE_NAMES, SHEET_TYPES, UNIT_TYPES } from '../constants'
import { getUnitEquipment, refreshUnitEquipmentStats } from './equipmentStats'
import { discoverHeroEquipment } from './equipmentDiscoveries'
import { getUnitEquipmentTier } from '../units/unitExperience'
import { applyBakedLpcUnitAssets } from '../lpc'
import type { ResourceAmount } from '../../types/common'
import type { UnitConfig } from '../../types/config'
import type { HeroEquipmentSlot, HeroWeaponSlot, UnitEntity } from '../../types/entities'

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

export type EquipmentStack = {
  equipment: string
  count: number
}

export function getHeroEquipmentSlotLabelKey(slot: HeroEquipmentSlot): string {
  return SLOT_LABEL_KEYS[slot]
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

export function getHeroInventory(hero: UnitEntity): NonNullable<UnitEntity['inventory']> {
  hero.inventory = hero.inventory ?? {}
  hero.inventory.resources = hero.inventory.resources ?? {}
  hero.inventory.equipment = hero.inventory.equipment ?? []
  hero.inventory.equipped = hero.inventory.equipped ?? {}
  hero.inventory.equippedCounts = hero.inventory.equippedCounts ?? {}
  hero.inventory.activeWeapons = hero.inventory.activeWeapons ?? {}
  return hero.inventory
}

function cleanEquipment(items: readonly string[]): string[] {
  return items.filter(item => typeof item === 'string' && item.length > 0)
}

function randomArrowLootCount(unit: UnitEntity, config?: Pick<UnitConfig, 'corpseLootArrowMin' | 'corpseLootArrowMax'>): number {
  const min = Math.max(1, Math.floor(config?.corpseLootArrowMin ?? 1))
  const max = Math.max(min, Math.floor(config?.corpseLootArrowMax ?? min))
  return unit.context?.map?.randomRange?.(min, max) ?? Math.floor(Math.random() * (max - min + 1) + min)
}

function expandCorpseLootArrowStack(
  unit: UnitEntity,
  equipment: string[],
  config?: Pick<UnitConfig, 'corpseLootArrowMin' | 'corpseLootArrowMax'>
): string[] {
  const arrowCount = randomArrowLootCount(unit, config)
  if (arrowCount <= 1) return equipment
  const arrow = equipment.find(item => item.startsWith('arrow_'))
  if (!arrow) return equipment
  return [...equipment, ...Array.from({ length: arrowCount - 1 }, () => arrow)]
}

export function getEquipmentStacks(items: readonly string[]): EquipmentStack[] {
  const counts = new Map<string, number>()
  for (const item of cleanEquipment(items)) {
    counts.set(item, (counts.get(item) ?? 0) + 1)
  }
  return [...counts.entries()].map(([equipment, count]) => ({ equipment, count }))
}

export function removeHeroInventoryItem(hero: UnitEntity | null | undefined, item: string, count = 1): boolean {
  if (!hero || !item) return false
  const inventory = getHeroInventory(hero)
  const bag = inventory.equipment!
  const amount = Math.max(1, Math.floor(count))
  const indexes: number[] = []
  for (let i = 0; i < bag.length && indexes.length < amount; i++) {
    if (bag[i] === item) indexes.push(i)
  }
  if (indexes.length < amount) return false
  for (let i = indexes.length - 1; i >= 0; i--) bag.splice(indexes[i], 1)
  return true
}

export function addHeroInventoryItem(hero: UnitEntity | null | undefined, item: string, count = 1): boolean {
  if (!hero || !item) return false
  const inventory = getHeroInventory(hero)
  pushEquipmentCopies(inventory.equipment!, item, Math.max(1, Math.floor(count)))
  discoverHeroEquipment(hero, item)
  return true
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

function countBagEquipment(bag: readonly string[], equipment: string): number {
  return bag.reduce((count, item) => count + (item === equipment ? 1 : 0), 0)
}

function cleanResourceAmount(resources: ResourceAmount | null | undefined): ResourceAmount {
  const clean: ResourceAmount = {}
  for (const resource of RESOURCE_STORAGE_NAMES) {
    const amount = Math.max(0, Math.floor(resources?.[resource] ?? 0))
    if (amount > 0) clean[resource] = amount
  }
  return clean
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
        getUnitEquipmentTier(unit, config?.category),
        unit.owner?.civ
      )

  unit.lootEquipment = expandCorpseLootArrowStack(unit, cleanEquipment(equipment), config)
  return unit.lootEquipment
}

export function initializeUnitCorpseLootEquipment(unit: UnitEntity): string[] {
  const previousLoot = unit.lootEquipment
  unit.lootEquipment = undefined
  const loot = getUnitCorpseLootEquipment(unit)
  if (loot.length || !Array.isArray(previousLoot)) return loot
  unit.lootEquipment = previousLoot
  return previousLoot
}

export function getUnitCorpseLootResources(unit: UnitEntity): ResourceAmount {
  if (!unit.isDead || unit.isDestroyed) return {}
  const resources = cleanResourceAmount(unit.inventory?.resources)
  if (unit.inventory) unit.inventory.resources = resources
  return resources
}

export function pickupCorpseResource(
  corpse: UnitEntity,
  hero: UnitEntity | null | undefined,
  resource: keyof ResourceAmount,
  requestedAmount?: number
): number {
  if (!hero || !corpse.isDead || corpse.isDestroyed) return 0
  const loot = getUnitCorpseLootResources(corpse)
  const available = Math.max(0, Math.floor(loot[resource] ?? 0))
  const amount = requestedAmount == null ? available : Math.min(available, Math.max(0, Math.floor(requestedAmount)))
  if (amount <= 0) return 0

  const heroResources = getHeroInventory(hero).resources!
  heroResources[resource] = (heroResources[resource] ?? 0) + amount
  const remaining = available - amount
  if (remaining > 0) loot[resource] = remaining
  else delete loot[resource]
  return amount
}

export function pickupCorpseEquipment(
  corpse: UnitEntity,
  hero: UnitEntity | null | undefined,
  equipment: string
): boolean {
  if (!hero || !corpse.isDead || corpse.isDestroyed) return false
  const loot = getUnitCorpseLootEquipment(corpse)
  const index = loot.indexOf(equipment)
  if (index < 0) return false

  loot.splice(index, 1)
  if (Array.isArray(corpse.equipment)) {
    const equipmentIndex = corpse.equipment.indexOf(equipment)
    if (equipmentIndex >= 0) corpse.equipment.splice(equipmentIndex, 1)
  }

  addHeroInventoryItem(hero, equipment)
  applyBakedLpcUnitAssets(corpse)
  corpse.syncAppearanceLayers?.(corpse.currentSheet ?? SHEET_TYPES.corpse)
  return true
}

export function equipHeroInventoryItem(
  hero: UnitEntity | null | undefined,
  equipment: string,
  requestedCount?: number
): boolean {
  if (!hero) return false
  const slot = getEquipmentSlot(equipment)
  if (!slot) return equipHeroWeaponInventoryItem(hero, equipment)
  const inventory = getHeroInventory(hero)
  if (slot === 'helmetDecor' && !inventory.equipped!.helmet) return false
  const bag = inventory.equipment!
  const bagIndex = bag.indexOf(equipment)
  if (bagIndex < 0) return false

  const availableCount = countBagEquipment(bag, equipment)
  const defaultCount = slot === 'arrow' ? availableCount : 1
  const equipCount = Math.min(availableCount, Math.max(1, Math.floor(requestedCount ?? defaultCount)))
  if (!removeHeroInventoryItem(hero, equipment, equipCount)) return false
  const previous = inventory.equipped![slot]
  let nextEquippedCount = equipCount
  if (previous === equipment) {
    nextEquippedCount += getHeroEquippedItemCount(hero, slot)
  } else if (previous) {
    pushEquipmentCopies(bag, previous, getHeroEquippedItemCount(hero, slot))
  }
  inventory.equipped![slot] = equipment
  inventory.equippedCounts![slot] = nextEquippedCount
  refreshUnitEquipmentStats(hero)
  applyBakedLpcUnitAssets(hero)
  hero.syncAppearanceLayers?.(hero.currentSheet ?? SHEET_TYPES.standing)
  return true
}

function equipHeroWeaponInventoryItem(hero: UnitEntity | null | undefined, equipment: string): boolean {
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

export function unequipHeroInventorySlot(
  hero: UnitEntity | null | undefined,
  slot: HeroEquipmentSlot,
  requestedCount?: number
): boolean {
  if (!hero?.inventory?.equipped?.[slot]) return false
  const inventory = getHeroInventory(hero)
  const equipment = inventory.equipped![slot]
  const count = getHeroEquippedItemCount(hero, slot)
  const unequipCount = Math.min(count, Math.max(1, Math.floor(requestedCount ?? count)))
  if (unequipCount >= count) {
    delete inventory.equipped![slot]
    delete inventory.equippedCounts![slot]
  } else {
    inventory.equippedCounts![slot] = count - unequipCount
  }
  if (equipment) pushEquipmentCopies(inventory.equipment!, equipment, unequipCount)
  if (slot === 'helmet' && unequipCount >= count && inventory.equipped!.helmetDecor) {
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

export function consumeHeroEquippedItem(
  hero: UnitEntity | null | undefined,
  slot: HeroEquipmentSlot,
  count = 1
): boolean {
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
