import { BUILDING_TYPES, RESOURCE_NAMES, UNIT_TYPES } from '../../constants'
import type { ResourceAmount } from '../../types/common'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'

type ResourceName = (typeof RESOURCE_NAMES)[number]
export type ResourceStoreOwner = {
  buildings?: BuildingEntity[]
  label?: string
  units?: UnitEntity[]
}
type ResourceTotalOptions = {
  includeHero?: boolean
  hero?: UnitEntity | null
  visibleOnly?: boolean
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

function isOwnedStartingResourceDepot(building: BuildingEntity, player: ResourceStoreOwner): boolean {
  if (building.type !== BUILDING_TYPES.townCenter) return false
  if (building.isDead || building.isDestroyed) return false
  if (!building.inventory?.resources) return false
  if (!building.owner) return true
  return building.owner === player || building.owner.label === player.label
}

function getPlayerStartingResourceDepots(player: ResourceStoreOwner | null | undefined): BuildingEntity[] {
  if (!player) return []
  return (player.buildings ?? []).filter(building => isOwnedStartingResourceDepot(building, player))
}

function isOwnedHero(unit: UnitEntity, player: ResourceStoreOwner): boolean {
  if (unit.type !== UNIT_TYPES.hero) return false
  if (unit.isDead || unit.isDestroyed) return false
  if (!unit.owner) return true
  return unit.owner === player || unit.owner.label === player.label
}

function getPlayerResourceHeroes(player: ResourceStoreOwner | null | undefined, extraHero?: UnitEntity | null): UnitEntity[] {
  if (!player && !extraHero) return []
  const heroes = new Set<UnitEntity>()
  if (player) {
    for (const unit of player.units ?? []) {
      if (isOwnedHero(unit, player)) heroes.add(unit)
    }
  }
  if (extraHero && (!player || isOwnedHero(extraHero, player))) heroes.add(extraHero)
  return [...heroes]
}

function isVisibleStorageBuilding(building: BuildingEntity, player: ResourceStoreOwner | PlayerLike): boolean {
  const map = building.context?.map
  if (map?.revealEverything) return true
  const views = (player as PlayerLike).views
  if (!views) return building.visible !== false
  const checkVisible = () => views.isVisible(building.i, building.j)
  return views.withSpace?.(building.spaceId, checkVisible) ?? checkVisible()
}

export function hasPlayerResourceChests(player: unknown): player is ResourceStoreOwner {
  return Boolean(player && typeof player === 'object' && Array.isArray((player as ResourceStoreOwner).buildings))
}

function getPlayerChestResourceTotals(
  player: ResourceStoreOwner | PlayerLike | null | undefined,
  options: ResourceTotalOptions = {}
): Record<ResourceName, number> {
  const totals = createEmptyResourceTotals()
  if (!player) return totals

  for (const building of getPlayerResourceChests(player)) {
    if (options.visibleOnly && !isVisibleStorageBuilding(building, player)) continue
    const resources = building.inventory?.resources
    if (!resources) continue
    for (const resource of RESOURCE_NAMES) {
      totals[resource] += Math.max(0, Math.floor(resources[resource] ?? 0))
    }
  }

  return totals
}

export function getPlayerResourceTotals(
  player: ResourceStoreOwner | PlayerLike | null | undefined,
  options: ResourceTotalOptions = {}
): Record<ResourceName, number> {
  const totals = getPlayerChestResourceTotals(player, options)
  if (!player) return totals

  for (const building of getPlayerStartingResourceDepots(player)) {
    if (options.visibleOnly && !isVisibleStorageBuilding(building, player)) continue
    const resources = building.inventory?.resources
    if (!resources) continue
    for (const resource of RESOURCE_NAMES) {
      totals[resource] += Math.max(0, Math.floor(resources[resource] ?? 0))
    }
  }

  if (options.includeHero !== false) {
    for (const hero of getPlayerResourceHeroes(player, options.hero)) {
      const resources = hero.inventory?.resources
      if (!resources) continue
      for (const resource of RESOURCE_NAMES) {
        totals[resource] += Math.max(0, Math.floor(resources[resource] ?? 0))
      }
    }
  }

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
  for (const resource of RESOURCE_NAMES) {
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

    for (const depot of getPlayerStartingResourceDepots(player)) {
      if (remaining <= 0) break
      const resources = depot.inventory?.resources
      if (!resources) continue
      const available = Math.max(0, Math.floor(resources[resource] ?? 0))
      if (available <= 0) continue

      const consumed = Math.min(available, remaining)
      resources[resource] = available - consumed
      if ((resources[resource] ?? 0) <= 0) delete resources[resource]
      remaining -= consumed
    }

    if (options.includeHero !== false) {
      for (const hero of getPlayerResourceHeroes(player, options.hero)) {
        if (remaining <= 0) break
        const resources = hero.inventory?.resources
        if (!resources) continue
        const available = Math.max(0, Math.floor(resources[resource] ?? 0))
        if (available <= 0) continue

        const consumed = Math.min(available, remaining)
        resources[resource] = available - consumed
        if ((resources[resource] ?? 0) <= 0) delete resources[resource]
        remaining -= consumed
      }
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
  const destination = chest ?? getPlayerStartingResourceDepots(player)[0]
  if (!destination) return false

  destination.inventory = destination.inventory ?? {}
  destination.inventory.resources = destination.inventory.resources ?? {}
  for (const [resource, rawAmount] of Object.entries(resourcesToDeposit) as [keyof ResourceAmount, number][]) {
    const amount = Math.max(0, Math.floor(rawAmount ?? 0))
    if (amount <= 0) continue
    destination.inventory.resources[resource] = (destination.inventory.resources[resource] ?? 0) + amount
  }
  syncPlayerResourceFieldsFromChests(player)
  return true
}
