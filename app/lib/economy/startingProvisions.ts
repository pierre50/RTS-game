import { personalFoodReserve } from './villagerProvisions'
import type { ResourceAmount } from '../../types/common'
import type { UnitEntity } from '../../types/entities'

export function startingHeroInventory(): NonNullable<UnitEntity['inventory']> {
  return { activeWeapons: { melee: 'sword_ceramic' } }
}

/** Provisions for newly created villagers; saved or transferred inventories remain authoritative. */
export function startingVillagerInventory(): { resources: ResourceAmount } {
  const total = personalFoodReserve()
  const meat = Math.floor(total / 2)
  return { resources: { meat, berry: total - meat } }
}
