import type { UnitEntity, HeroEquipmentSlot } from '../../types/entities'
import { getEquipmentSlot, getWeaponSlot } from './equipmentSlots'
import { getHeroInventory, pushEquipmentCopies, removeHeroInventoryItem } from './heroInventory'

const countBagEquipment = (bag: string[], item: string) => bag.filter(value => value === item).length
const getHeroEquippedItemCount = (hero: UnitEntity, slot: HeroEquipmentSlot) =>
  Math.max(1, Math.floor(hero.inventory?.equippedCounts?.[slot] ?? 1))

export function equipHeroInventoryItemData(
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
  return true
}
