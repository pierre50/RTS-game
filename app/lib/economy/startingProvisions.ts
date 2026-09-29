import { personalFoodReserve } from './villagerProvisions'
import type { ResourceAmount } from '../../types/common'

/** Provisions for newly created villagers; saved or transferred inventories remain authoritative. */
export function startingVillagerInventory(): { resources: ResourceAmount } {
  const total = personalFoodReserve()
  const meat = Math.floor(total / 2)
  return { resources: { meat, berry: total - meat } }
}
