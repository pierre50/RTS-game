import type { ResourceAmount } from '../../types/common'
import type { UnitConfig } from '../../types/config'
import type { HeroEquipmentSlot, HeroWeaponSlot, UnitEntity } from '../../types/entities'
import { RESOURCE_STORAGE_NAMES, SHEET_TYPES, UNIT_TYPES } from '../constants'
import { applyBakedLpcUnitAssets } from '../lpc'
import { getUnitEquipmentTier } from '../units/unitExperience'
import { getEquipmentSlot, getWeaponSlot } from './equipmentSlots'
import { getUnitEquipment, refreshUnitEquipmentStats } from './equipmentStats'
import { addHeroInventoryItem, getHeroInventory, pushEquipmentCopies, removeHeroInventoryItem } from './heroInventory'
export {
  formatEquipmentLootLabel,
  formatEquipmentStackLabel,
  getEquipmentSlot,
  getHeroEquipmentSlotLabelKey,
  getWeaponSlot,
  HERO_EQUIPMENT_SLOTS,
} from './equipmentSlots'
export { addHeroInventoryItem, getHeroInventory, removeHeroInventoryItem } from './heroInventory'

export type EquipmentStack = {
  equipment: string
  count: number
}

function cleanEquipment(items: readonly string[]): string[] {
  return items.filter(item => typeof item === 'string' && item.length > 0)
}

function randomArrowLootCount(
  unit: UnitEntity,
  config?: Pick<UnitConfig, 'corpseLootArrowMin' | 'corpseLootArrowMax'>
): number {
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

export function getHeroEquippedItemCount(hero: UnitEntity | null | undefined, slot: HeroEquipmentSlot): number {
  if (!hero?.inventory?.equipped?.[slot]) return 0
  return Math.max(1, Math.floor(hero.inventory.equippedCounts?.[slot] ?? 1))
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

  const heroResources = getHeroInventory(hero).resources
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
  if (slot === 'helmetDecor' && !inventory.equipped.helmet) return false
  const bag = inventory.equipment
  const bagIndex = bag.indexOf(equipment)
  if (bagIndex < 0) return false

  const availableCount = countBagEquipment(bag, equipment)
  const defaultCount = slot === 'arrow' ? availableCount : 1
  const equipCount = Math.min(availableCount, Math.max(1, Math.floor(requestedCount ?? defaultCount)))
  if (!removeHeroInventoryItem(hero, equipment, equipCount)) return false
  const previous = inventory.equipped[slot]
  let nextEquippedCount = equipCount
  if (previous === equipment) {
    nextEquippedCount += getHeroEquippedItemCount(hero, slot)
  } else if (previous) {
    pushEquipmentCopies(bag, previous, getHeroEquippedItemCount(hero, slot))
  }
  inventory.equipped[slot] = equipment
  inventory.equippedCounts[slot] = nextEquippedCount
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
  const bag = inventory.equipment
  const bagIndex = bag.indexOf(equipment)
  if (bagIndex < 0) return false

  bag.splice(bagIndex, 1)
  const previous = inventory.activeWeapons[slot]
  if (previous) bag.push(previous)
  inventory.activeWeapons[slot] = equipment
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
  const equipment = inventory.equipped[slot]
  const count = getHeroEquippedItemCount(hero, slot)
  const unequipCount = Math.min(count, Math.max(1, Math.floor(requestedCount ?? count)))
  if (unequipCount >= count) {
    delete inventory.equipped[slot]
    delete inventory.equippedCounts[slot]
  } else {
    inventory.equippedCounts[slot] = count - unequipCount
  }
  if (equipment) pushEquipmentCopies(inventory.equipment, equipment, unequipCount)
  if (slot === 'helmet' && unequipCount >= count && inventory.equipped.helmetDecor) {
    const decor = inventory.equipped.helmetDecor
    const decorCount = getHeroEquippedItemCount(hero, 'helmetDecor')
    delete inventory.equipped.helmetDecor
    delete inventory.equippedCounts.helmetDecor
    pushEquipmentCopies(inventory.equipment, decor, decorCount)
  }
  refreshUnitEquipmentStats(hero)
  applyBakedLpcUnitAssets(hero)
  hero.syncAppearanceLayers?.(hero.currentSheet ?? SHEET_TYPES.standing)
  return true
}

export function unequipHeroActiveWeaponSlot(hero: UnitEntity | null | undefined, slot: HeroWeaponSlot): boolean {
  if (!hero?.inventory?.activeWeapons?.[slot]) return false
  const inventory = getHeroInventory(hero)
  const equipment = inventory.activeWeapons[slot]
  delete inventory.activeWeapons[slot]
  if (equipment) inventory.equipment.push(equipment)
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
    inventory.equippedCounts[slot] = nextCount
  } else {
    delete inventory.equipped[slot]
    delete inventory.equippedCounts[slot]
  }
  refreshUnitEquipmentStats(hero)
  applyBakedLpcUnitAssets(hero)
  return true
}
