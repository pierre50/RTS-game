import { UNIT_TYPES } from '../../constants'
import { getEquipmentSlot, getWeaponSlot } from '../../lib/equipment/equipmentLoot'
import { DYNAMIC_EQUIPMENT_KEYS } from '../../lib/lpc/equipment'
import type { CommandResult } from '../DevCommandRegistry'
import type { DevConsoleContext } from '../types'
import { RESOURCE_NAMES, findKey } from './shared'
import type { ResourceAmount } from '../../types/common'

const SPECIAL_HERO_INVENTORY_ITEMS = ['lasso'] as const
const HERO_INVENTORY_COMMAND_EXCLUDED_ITEMS = new Set(['longsword', 'quiver'])

function getHero(context: DevConsoleContext) {
  return (
    context.controls?.heroUnit ??
    context.player.units.find(unit => unit.controlMode === 'hero' || unit.type === UNIT_TYPES.hero) ??
    null
  )
}

type ResourceName = (typeof RESOURCE_NAMES)[number]

function isResourceName(value: string): value is ResourceName {
  return (RESOURCE_NAMES as readonly string[]).includes(value)
}

export function addHeroInventoryResources(
  context: DevConsoleContext,
  resourceName: string,
  amount: number
): CommandResult {
  const inventory = ensureHeroInventory(context)
  if (!inventory) return { ok: false, message: 'No hero found' }

  const resources: ResourceAmount = inventory.resources!
  if (resourceName === 'all') {
    RESOURCE_NAMES.forEach(name => {
      resources[name] = Number(resources[name] ?? 0) + amount
    })
    context.menu.refreshInventory?.()
    context.menu.updateTopbar()
    return { ok: true, message: `Added ${amount} to all hero resources` }
  }

  // 'food' is a virtual aggregate (berry + meat + wheat) — route convenience gives into wheat.
  if (resourceName === 'food') {
    resources.wheat = Number(resources.wheat ?? 0) + amount
    context.menu.refreshInventory?.()
    context.menu.updateTopbar()
    return { ok: true, message: `Added ${amount} food (as wheat) to hero resources` }
  }

  if (!isResourceName(resourceName)) {
    return { ok: false, message: `Unknown hero resource: ${resourceName}` }
  }

  resources[resourceName] = Number(resources[resourceName] ?? 0) + amount
  context.menu.refreshInventory?.()
  context.menu.updateTopbar()
  return { ok: true, message: `Added ${amount} ${resourceName} to hero resources` }
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
  hero.inventory.resources = hero.inventory.resources ?? {}
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
