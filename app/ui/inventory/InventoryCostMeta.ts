import type { ResourceAmount } from '../../types/common'
import type { ResourceCost } from '../ResourceCost'

export type InventoryCostMetaPart = { resourceCost: ResourceCost }

export function inventoryCostMetaParts(cost: ResourceAmount, totals: ResourceAmount): InventoryCostMetaPart[] {
  return [{ resourceCost: { mode: 'craft', cost, available: totals } }]
}

/** Construction materials are delivered over time, never an upfront affordability check. */
export function inventoryDeliveryMetaParts(cost: ResourceAmount, inProgress = false): InventoryCostMetaPart[] {
  return [{ resourceCost: { mode: inProgress ? 'remaining' : 'delivery', cost } }]
}
