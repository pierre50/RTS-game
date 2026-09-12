import { capitalizeFirstLetter } from '../../lib/extra'
import { t } from '../../lib/lang'
import type { ResourceAmount } from '../../types/common'

export function inventoryCostMetaParts(cost: ResourceAmount, totals: ResourceAmount): Array<{ text: string; className: string }> {
  const formatResourceLabel = (resource: string): string => capitalizeFirstLetter(t(resource))
  return Object.entries(cost)
    .map(([resource, amount]) => {
      const needed = Math.max(0, Math.floor(amount ?? 0))
      if (needed <= 0) return null
      const available = Math.max(0, Math.floor((totals[resource as keyof ResourceAmount] ?? 0)))
      const hasEnough = available >= needed
      return {
        text: `${formatResourceLabel(resource)} ${available}/${needed}`,
        className: hasEnough ? 'inventory-cost-is-available' : 'inventory-cost-is-missing',
      }
    })
    .filter((part): part is { text: string; className: string } => Boolean(part))
}
