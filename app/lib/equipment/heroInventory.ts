import type { UnitEntity } from '../../types/entities'

// Loose items sitting in a bag (distinct from the fixed equipped-gear slots, which only a hero
// has). These share the unit's single carry-weight pool with resources — see
// getUnitResourceCarryRemaining in resources/resourceDelivery.ts, which owns the actual capacity
// number for both heroes and villagers.
export function getUnitEquipmentBagCount(unit: UnitEntity): number {
  return unit.inventory?.equipment?.length ?? 0
}

export function getHeroInventory(hero: UnitEntity): Required<NonNullable<UnitEntity['inventory']>> {
  hero.inventory = hero.inventory ?? {}
  return Object.assign(hero.inventory, {
    resources: hero.inventory.resources ?? {},
    equipment: hero.inventory.equipment ?? [],
    equipped: hero.inventory.equipped ?? {},
    equippedCounts: hero.inventory.equippedCounts ?? {},
    activeWeapons: hero.inventory.activeWeapons ?? {},
  })
}

export function removeHeroInventoryItem(hero: UnitEntity | null | undefined, item: string, count = 1): boolean {
  if (!hero || !item || !Number.isFinite(count)) return false
  const inventory = getHeroInventory(hero)
  const bag = inventory.equipment
  const amount = Math.max(1, Math.floor(count))
  const indexes: number[] = []
  for (let i = 0; i < bag.length && indexes.length < amount; i++) {
    if (bag[i] === item) indexes.push(i)
  }
  if (indexes.length < amount) return false
  for (const index of indexes.reverse()) bag.splice(index, 1)
  return true
}

export function addHeroInventoryItem(hero: UnitEntity | null | undefined, item: string, count = 1): boolean {
  if (!hero || !item || !Number.isFinite(count)) return false
  const inventory = getHeroInventory(hero)
  pushEquipmentCopies(inventory.equipment, item, Math.max(1, Math.floor(count)))
  return true
}

export function pushEquipmentCopies(bag: string[], equipment: string, count: number): void {
  for (let i = 0; i < count; i++) {
    bag.push(equipment)
  }
}
