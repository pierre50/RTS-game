import type { ResourceAmount } from '../../types/common'
import type { ResourceCost } from '../ResourceCost'

export type InventoryCostMetaPart = { resourceCost: ResourceCost }

export function inventoryCostMetaParts(cost: ResourceAmount, totals: ResourceAmount): InventoryCostMetaPart[] {
  return [{ resourceCost: { mode: 'craft', cost, available: totals } }]
}
