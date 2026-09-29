import { BUILDING_TYPES, RESOURCE_STORAGE_NAMES } from '../../constants'
import type { ResourceAmount } from '../../types/common'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'
import type { ResourceStoreOwner, ResourceTotalOptions } from './playerResourceStores'
import {
  getPersonalResourceHero,
  getPlayerResourceHeroes,
  getPlayerResourceStores,
  isVisibleStorageBuilding,
} from './playerResourceStores'
import { getBuildingStorageCapacity } from './resourceDelivery'
import type { ResourceName } from './resourceFoodAmounts'
import { expandFoodCost, expandFoodDeposit } from './resourceFoodAmounts'
import { allowsVillagerDeliveries, storageResourcePriority } from './storagePolicy'

function createEmptyResourceTotals(): Record<ResourceName, number> {
  return Object.fromEntries([...RESOURCE_STORAGE_NAMES, 'food'].map(resource => [resource, 0])) as Record<
    ResourceName,
    number
  >
}

/** Personal spending uses the active hero's bag until they can command the village.
 * Explicit village-only queries remain available to upkeep and offline simulation. */

export function hasPlayerResourceChests(player: unknown): player is ResourceStoreOwner {
  return Boolean(player && typeof player === 'object' && Array.isArray((player as ResourceStoreOwner).buildings))
}

function getPlayerStoredResourceTotals(
  player: ResourceStoreOwner | PlayerLike | null | undefined,
  options: ResourceTotalOptions = {}
): Record<ResourceName, number> {
  const totals = createEmptyResourceTotals()
  if (!player) return totals

  for (const building of getPlayerResourceStores(player)) {
    if (options.visibleOnly && !isVisibleStorageBuilding(building, player)) continue
    const resources = building.inventory?.resources
    if (!resources) continue
    for (const resource of RESOURCE_STORAGE_NAMES) {
      totals[resource] += Math.max(0, Math.floor(resources[resource] ?? 0))
    }
  }

  return totals
}

export function getPlayerResourceTotals(
  player: ResourceStoreOwner | PlayerLike | null | undefined,
  options: ResourceTotalOptions = {}
): Record<ResourceName, number> {
  const personalHero = getPersonalResourceHero(player, options)
  const totals = personalHero ? createEmptyResourceTotals() : getPlayerStoredResourceTotals(player, options)
  if (!player) return totals

  if (options.includeHero !== false) {
    for (const hero of personalHero ? [personalHero] : getPlayerResourceHeroes(player, options.hero)) {
      const resources = hero.inventory?.resources
      if (!resources) continue
      for (const resource of RESOURCE_STORAGE_NAMES) {
        totals[resource] += Math.max(0, Math.floor(resources[resource] ?? 0))
      }
    }
  }

  totals.food = totals.berry + totals.meat + totals.wheat

  return totals
}

export function getMissingPlayerResources(
  player: ResourceStoreOwner | PlayerLike | null | undefined,
  cost: ResourceAmount,
  options: { includeHero?: boolean; hero?: UnitEntity | null } = {}
): ResourceAmount {
  const totals = getPlayerResourceTotals(player, options)
  const missing: ResourceAmount = {}
  for (const [resource, amount] of Object.entries(cost) as [keyof ResourceAmount, number][]) {
    const needed = Math.max(0, Math.floor(amount ?? 0))
    if (needed > 0 && (totals[resource] ?? 0) < needed) missing[resource] = needed - (totals[resource] ?? 0)
  }
  return missing
}

export function syncPlayerResourceFieldsFromChests(player: ResourceStoreOwner | PlayerLike | null | undefined): void {
  if (!player || typeof player !== 'object') return
  const totals = getPlayerResourceTotals(player)
  for (const resource of [...RESOURCE_STORAGE_NAMES, 'food'] as ResourceName[]) {
    ;(player as ResourceAmount)[resource] = totals[resource]
  }
}

export function withdrawChestResources(
  player: ResourceStoreOwner | PlayerLike | null | undefined,
  cost: ResourceAmount | null | undefined,
  options: { includeHero?: boolean; hero?: UnitEntity | null } = {}
): boolean {
  if (!player || !cost) return false
  const missing = getMissingPlayerResources(player, cost, options)
  if (Object.keys(missing).length > 0) return false

  const totals = getPlayerResourceTotals(player, options)
  const expandedCost = expandFoodCost(cost, totals)
  const personalHero = getPersonalResourceHero(player, options)

  for (const [resource, rawAmount] of Object.entries(expandedCost) as [keyof ResourceAmount, number][]) {
    let remaining = Math.max(0, Math.floor(rawAmount ?? 0))
    if (remaining <= 0) continue

    const stores = personalHero ? [] : getPlayerResourceStores(player)
    const heroes =
      options.includeHero === false ? [] : personalHero ? [personalHero] : getPlayerResourceHeroes(player, options.hero)
    for (const store of [...stores, ...heroes]) {
      if (remaining <= 0) break
      const resources = store.inventory?.resources
      if (!resources) continue
      const available = Math.max(0, Math.floor(resources[resource] ?? 0))
      if (available <= 0) continue
      const consumed = Math.min(available, remaining)
      resources[resource] = available - consumed
      if ((resources[resource] ?? 0) <= 0) delete resources[resource]
      remaining -= consumed
    }
  }

  syncPlayerResourceFieldsFromChests(player)
  return true
}

function getStoreResourceTotal(store: BuildingEntity): number {
  return Object.values(store.inventory?.resources ?? {}).reduce(
    (sum, amount) => sum + Math.max(0, Math.floor(amount ?? 0)),
    0
  )
}

export function depositChestResources(
  player: ResourceStoreOwner | PlayerLike | null | undefined,
  resourcesToDeposit: ResourceAmount | null | undefined,
  options: { automaticDelivery?: boolean; allowPartial?: boolean } = {}
): boolean {
  if (!player || !resourcesToDeposit) return false
  const stores = getPlayerResourceStores(player).filter(store => store.isBuilt !== false)
  if (!stores.length) return false
  const buildings = player.buildings ?? []
  const parentOf = (store: BuildingEntity) =>
    store.type !== BUILDING_TYPES.chest
      ? store
      : buildings.find(
          parent =>
            (parent as BuildingEntity & { interiorBuildings?: BuildingEntity[] }).interiorBuildings?.includes(store) ||
            (store.spaceId && store.spaceId === `interior:${player.label}:${parent.label}`)
        )
  const candidates = stores
    .map(store => ({ store, parent: parentOf(store) }))
    .filter(
      ({ store, parent }) =>
        !options.automaticDelivery ||
        (allowsVillagerDeliveries(store, player) && (!parent || allowsVillagerDeliveries(parent, player)))
    )
  const expandedDeposit = expandFoodDeposit(resourcesToDeposit)
  const deposits: Array<{ destination: BuildingEntity; resource: keyof ResourceAmount; amount: number }> = []
  for (const [resource, rawAmount] of Object.entries(expandedDeposit) as [keyof ResourceAmount, number][]) {
    const amount = Math.max(0, Math.floor(rawAmount ?? 0))
    if (amount <= 0) continue
    const eligible = candidates.filter(
      ({ parent }) =>
        parent?.isBuilt !== false &&
        !parent?.isDead &&
        !parent?.isDestroyed &&
        Number.isFinite(storageResourcePriority(parent?.type ?? 'Chest', resource))
    )
    eligible.sort(
      (a, b) =>
        storageResourcePriority(a.parent?.type ?? 'Chest', resource) -
          storageResourcePriority(b.parent?.type ?? 'Chest', resource) ||
        Number(b.store.type === 'Chest') - Number(a.store.type === 'Chest') ||
        (a.store.inventory?.resources?.[resource] ?? 0) - (b.store.inventory?.resources?.[resource] ?? 0)
    )
    let remaining = amount
    for (const { store: destination } of eligible) {
      const reserved = deposits
        .filter(deposit => deposit.destination === destination)
        .reduce((sum, deposit) => sum + deposit.amount, 0)
      const room = Math.max(0, getBuildingStorageCapacity(destination) - getStoreResourceTotal(destination) - reserved)
      const accepted = Math.min(remaining, room)
      if (accepted) deposits.push({ destination, resource, amount: accepted })
      remaining -= accepted
      if (!remaining) break
    }
    // Commit only after every resource fits, except explicitly bounded starting grants.
    if (remaining && !options.allowPartial) return false
  }
  for (const { destination, resource, amount } of deposits) {
    destination.inventory ??= {}
    destination.inventory.resources ??= {}
    destination.inventory.resources[resource] = (destination.inventory.resources[resource] ?? 0) + amount
  }
  syncPlayerResourceFieldsFromChests(player)
  return true
}

export type { ResourceStoreOwner } from './playerResourceStores'

export { expandLegacyFoodAmount } from './resourceFoodAmounts'
