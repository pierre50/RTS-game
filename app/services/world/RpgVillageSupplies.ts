import { isRpgVillage } from '../../config/rpgVillages'
import { getBuildingStorageRemaining } from '../../lib/resources/resourceDelivery'
import { communalStoreBuilding } from '../../lib/economy/constructionStores'
import { syncPlayerResourceFieldsFromChests } from '../../lib/resources/playerResourceTotals'
import type { PlayerLike } from '../../types/player'
import type { ResourceAmount } from '../../types/common'

const SUPPLIES: Record<string, { target: ResourceAmount; daily: ResourceAmount }> = {
  Granary: { target: { wheat: 200 }, daily: { wheat: 30 } },
  StoragePit: {
    target: { wood: 120, stone: 80, iron: 15, copper: 15 },
    daily: { wood: 20, stone: 10, iron: 2, copper: 2 },
  },
}

/** One modest delivery per day, including distant villages. No catch-up windfall or revived depots. */
export function replenishRpgVillage(owner: PlayerLike, day: number): boolean {
  if (!isRpgVillage(owner) || !Number.isInteger(day) || day <= 0 || day <= (owner.rpgRestockDay ?? 0)) return false
  owner.rpgRestockDay = day
  if (!owner.units?.some(unit => !unit.isDead && !unit.isDestroyed)) return false
  let changed = false
  for (const depot of owner.buildings ?? []) {
    const supply = SUPPLIES[depot.type]
    if (
      !supply ||
      depot.isBuilt === false ||
      depot.isDead ||
      depot.isDestroyed ||
      (depot.owner && depot.owner !== owner)
    )
      continue
    const chest = owner.buildings.find(
      building => building.type === 'Chest' && communalStoreBuilding(building, owner) === depot
    )
    if (chest?.isDead || chest?.isDestroyed) continue
    const store = chest ?? depot
    store.inventory ??= {}
    const resources = (store.inventory.resources ??= {})
    let free = getBuildingStorageRemaining(depot)
    for (const key of Object.keys(supply.daily) as Array<keyof ResourceAmount>) {
      if ((key === 'iron' || key === 'copper') && owner.settlementType !== 'city') continue
      const amount = Math.max(
        0,
        Math.min(
          free,
          supply.daily[key] ?? 0,
          (supply.target[key] ?? 0) - (resources[key] ?? 0) - (chest ? (depot.inventory?.resources?.[key] ?? 0) : 0)
        )
      )
      if (!amount) continue
      resources[key] = (resources[key] ?? 0) + amount
      free -= amount
      changed = true
    }
  }
  if (changed) syncPlayerResourceFieldsFromChests(owner)
  return changed
}
