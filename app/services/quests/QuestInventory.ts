import { RESOURCE_STORAGE_NAMES } from '../../constants'
import { equipHeroInventoryItemData } from '../../lib/equipment/heroEquipmentData'
import { addHeroInventoryItem } from '../../lib/equipment/heroInventory'
import { getEquipmentSlot, getWeaponSlot } from '../../lib/equipment/equipmentSlots'
import type { UnitEntity } from '../../types/entities'
import type { ResourceAmount } from '../../types/common'
import type { ResourceEffect } from './QuestSystem'

export function questItemCount(hero: UnitEntity | null | undefined, item: string): number {
  const matches = (value: string) => (item === 'arrow' ? value.startsWith('arrow_') : value === item)
  const inventory = hero?.inventory
  return (
    (inventory?.equipment ?? []).filter(matches).length +
    Object.entries(inventory?.equipped ?? {}).reduce(
      (sum, [slot, value]) =>
        sum +
        (matches(value)
          ? Math.max(1, inventory?.equippedCounts?.[slot as keyof NonNullable<typeof inventory.equippedCounts>] ?? 1)
          : 0),
      0
    ) +
    Object.values(inventory?.activeWeapons ?? {}).filter(matches).length
  )
}

/** Work on detached inventories so an invalid effect cannot partially charge or reward a quest. */
export function commitQuestInventory(hero: UnitEntity, npc: UnitEntity, effects: ResourceEffect[]): boolean {
  const staged = { inventory: structuredClone(hero.inventory ?? {}) } as UnitEntity
  const recipient = { ...npc.inventory?.resources }
  staged.inventory!.resources ??= {}
  for (const effect of effects) {
    if (!Number.isSafeInteger(effect.quantity) || effect.quantity < 0) return false
    if (effect.quantity === 0) continue
    if (effect.type === 'give-item') {
      if (!getEquipmentSlot(effect.resource) && !getWeaponSlot(effect.resource)) return false
      addHeroInventoryItem(staged, effect.resource, effect.quantity)
      if (effect.equip && !equipHeroInventoryItemData(staged, effect.resource, effect.quantity)) return false
      continue
    }
    if (!(RESOURCE_STORAGE_NAMES as readonly string[]).includes(effect.resource)) return false
    const resource = effect.resource as keyof ResourceAmount
    const resources = staged.inventory!.resources!
    const amount = resources[resource] ?? 0
    if (effect.type === 'take-resource') {
      if (amount < effect.quantity) return false
      resources[resource] = amount - effect.quantity
      recipient[resource] = (recipient[resource] ?? 0) + effect.quantity
    } else if (effect.type === 'give-resource') resources[resource] = amount + effect.quantity
    else if (effect.type === 'top-up-resource') resources[resource] = Math.max(amount, effect.quantity)
    else return false
  }
  hero.inventory = staged.inventory
  npc.inventory ??= {}
  npc.inventory.resources = recipient
  return true
}
