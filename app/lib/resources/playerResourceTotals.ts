import { BUILDING_TYPES, RESOURCE_NAMES } from '../../constants'
import type { ResourceAmount } from '../../types/common'
import type { BuildingEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'

type ResourceName = (typeof RESOURCE_NAMES)[number]
export type ResourceStoreOwner = {
  buildings?: BuildingEntity[]
  label?: string
}

function createEmptyResourceTotals(): Record<ResourceName, number> {
  return Object.fromEntries(RESOURCE_NAMES.map(resource => [resource, 0])) as Record<ResourceName, number>
}

function isOwnedChest(building: BuildingEntity, player: ResourceStoreOwner): boolean {
  if (building.type !== BUILDING_TYPES.chest) return false
  if (building.isDead || building.isDestroyed) return false
  if (!building.owner) return true
  return building.owner === player || building.owner.label === player.label
}

function getPlayerResourceChests(player: ResourceStoreOwner | null | undefined): BuildingEntity[] {
  if (!player) return []
  return (player.buildings ?? []).filter(building => isOwnedChest(building, player))
}

export function hasPlayerResourceChests(player: unknown): player is ResourceStoreOwner {
  return Boolean(player && typeof player === 'object' && Array.isArray((player as ResourceStoreOwner).buildings))
}

export function getPlayerChestResourceTotals(
  player: ResourceStoreOwner | PlayerLike | null | undefined
): Record<ResourceName, number> {
  const totals = createEmptyResourceTotals()
  if (!player) return totals

  for (const building of getPlayerResourceChests(player)) {
    const resources = building.inventory?.resources
    if (!resources) continue
    for (const resource of RESOURCE_NAMES) {
      totals[resource] += Math.max(0, Math.floor(resources[resource] ?? 0))
    }
  }

  return totals
}

export function getMissingChestResources(
  player: ResourceStoreOwner | PlayerLike | null | undefined,
  cost: ResourceAmount
): ResourceAmount {
  const totals = getPlayerChestResourceTotals(player)
  const missing: ResourceAmount = {}
  for (const [resource, amount] of Object.entries(cost) as [keyof ResourceAmount, number][]) {
    const needed = Math.max(0, Math.floor(amount ?? 0))
    if (needed > 0 && (totals[resource] ?? 0) < needed) missing[resource] = needed - (totals[resource] ?? 0)
  }
  return missing
}

export function syncPlayerResourceFieldsFromChests(player: ResourceStoreOwner | PlayerLike | null | undefined): void {
  if (!player || typeof player !== 'object') return
  const totals = getPlayerChestResourceTotals(player)
  for (const resource of RESOURCE_NAMES) {
    ;(player as ResourceAmount)[resource] = totals[resource]
  }
}

export function withdrawChestResources(
  player: ResourceStoreOwner | PlayerLike | null | undefined,
  cost: ResourceAmount | null | undefined
): boolean {
  if (!player || !cost) return false
  const missing = getMissingChestResources(player, cost)
  if (Object.keys(missing).length > 0) return false

  for (const [resource, rawAmount] of Object.entries(cost) as [keyof ResourceAmount, number][]) {
    let remaining = Math.max(0, Math.floor(rawAmount ?? 0))
    if (remaining <= 0) continue

    for (const chest of getPlayerResourceChests(player)) {
      const resources = chest.inventory?.resources
      if (!resources) continue
      const available = Math.max(0, Math.floor(resources[resource] ?? 0))
      if (available <= 0) continue

      const consumed = Math.min(available, remaining)
      resources[resource] = available - consumed
      if ((resources[resource] ?? 0) <= 0) delete resources[resource]
      remaining -= consumed
      if (remaining <= 0) break
    }
  }

  syncPlayerResourceFieldsFromChests(player)
  return true
}

export function depositChestResources(
  player: ResourceStoreOwner | PlayerLike | null | undefined,
  resourcesToDeposit: ResourceAmount | null | undefined
): boolean {
  if (!player || !resourcesToDeposit) return false
  const chest = getPlayerResourceChests(player)[0]
  if (!chest) return false

  chest.inventory = chest.inventory ?? {}
  chest.inventory.resources = chest.inventory.resources ?? {}
  for (const [resource, rawAmount] of Object.entries(resourcesToDeposit) as [keyof ResourceAmount, number][]) {
    const amount = Math.max(0, Math.floor(rawAmount ?? 0))
    if (amount <= 0) continue
    chest.inventory.resources[resource] = (chest.inventory.resources[resource] ?? 0) + amount
  }
  syncPlayerResourceFieldsFromChests(player)
  return true
}
