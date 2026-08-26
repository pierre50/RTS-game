import { UNIT_TYPES } from '../../constants'
import { getEquipmentSlot, getWeaponSlot } from '../../lib/equipment/equipmentLoot'
import { DYNAMIC_EQUIPMENT_KEYS } from '../../lib/lpc/equipment'
import type { CommandResult } from '../DevCommandRegistry'
import type { DevConsoleContext } from '../types'
import { findKey } from './shared'

const SPECIAL_HERO_INVENTORY_ITEMS = ['lasso'] as const
const HERO_INVENTORY_COMMAND_EXCLUDED_ITEMS = new Set(['longsword', 'quiver'])

function getHero(context: DevConsoleContext) {
  return (
    context.controls?.heroUnit ??
    context.player.units.find(unit => unit.controlMode === 'hero' || unit.type === UNIT_TYPES.hero) ??
    null
  )
}

export function getAllHeroInventoryItems(): string[] {
  return [...DYNAMIC_EQUIPMENT_KEYS, ...SPECIAL_HERO_INVENTORY_ITEMS].filter(
    item =>
      !HERO_INVENTORY_COMMAND_EXCLUDED_ITEMS.has(item) &&
      (Boolean(getEquipmentSlot(item)) || Boolean(getWeaponSlot(item)))
  )
}

function ensureHeroInventory(context: DevConsoleContext): NonNullable<ReturnType<typeof getHero>>['inventory'] | null {
  const hero = getHero(context)
  if (!hero) return null

  hero.inventory = hero.inventory ?? {}
  hero.inventory.equipment = hero.inventory.equipment ?? []
  hero.inventory.equipped = hero.inventory.equipped ?? {}
  hero.inventory.equippedCounts = hero.inventory.equippedCounts ?? {}
  hero.inventory.activeWeapons = hero.inventory.activeWeapons ?? {}
  return hero.inventory
}

function parseQuantity(quantity: string | number | undefined): number | null {
  if (quantity == null || quantity === '') return 1
  const parsed = Number(quantity)
  if (!Number.isInteger(parsed) || parsed < 1) return null
  return parsed
}

export function addHeroInventoryEquipment(
  context: DevConsoleContext,
  requestedItem = 'all',
  requestedQuantity?: string | number
): CommandResult {
  const inventory = ensureHeroInventory(context)
  if (!inventory) return { ok: false, message: 'No hero found' }

  const allItems = getAllHeroInventoryItems()
  const item =
    requestedItem === 'all' ? 'all' : findKey(Object.fromEntries(allItems.map(key => [key, true])), requestedItem)
  if (!item) return { ok: false, message: `Unknown hero inventory item: ${requestedItem}` }
  const quantity = parseQuantity(requestedQuantity)
  if (quantity == null) return { ok: false, message: `Quantity must be a positive integer: ${requestedQuantity}` }

  const bag = inventory.equipment!
  const items = item === 'all' ? allItems : [item]
  for (let i = 0; i < quantity; i++) {
    bag.push(...items)
  }

  context.menu.refreshInventory?.()
  context.menu.updateActionTarget?.()

  if (item !== 'all') {
    return {
      ok: true,
      message: quantity > 1 ? `Added ${quantity} ${item} to hero inventory` : `Added ${item} to hero inventory`,
    }
  }

  return {
    ok: true,
    message:
      quantity > 1
        ? `Added ${quantity}x ${items.length} hero inventory items`
        : `Added ${items.length} hero inventory items`,
  }
}
