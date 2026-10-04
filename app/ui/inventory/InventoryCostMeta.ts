import { t } from '../../lib/lang'
import type { ResourceAmount } from '../../types/common'

export function inventoryCostMetaParts(
  cost: ResourceAmount,
  totals: ResourceAmount
): Array<{ text: string; className: string }> {
  const formatResourceLabel = (resource: string): string => {
    const label = t(resource)
    return label.charAt(0).toUpperCase() + label.slice(1)
  }
  return Object.entries(cost)
    .map(([resource, amount]) => {
      const needed = Math.max(0, Math.floor(amount ?? 0))
      if (needed <= 0) return null
      const available = Math.max(0, Math.floor(totals[resource as keyof ResourceAmount] ?? 0))
      const hasEnough = available >= needed
      return {
        text: `${formatResourceLabel(resource)} ${available}/${needed}`,
        className: hasEnough ? 'inventory-cost-is-available' : 'inventory-cost-is-missing',
      }
    })
    .filter((part): part is { text: string; className: string } => Boolean(part))
}

/** Construction materials are delivered over time, never an upfront affordability check. */
export function inventoryDeliveryMetaParts(
  cost: ResourceAmount,
  inProgress = false
): Array<{ text: string; className: string }> {
  const materials = Object.entries(cost)
    .filter(([, amount]) => (amount ?? 0) > 0)
    .map(([resource, amount]) => `${amount} ${t(resource)}`)
    .join(', ')
  // "Delivered" only makes sense for a site already under way, not a free catalogue entry.
  if (!materials && !inProgress) return []
  return [
    {
      text: materials
        ? t(inProgress ? 'buildingUpgradeRemaining' : 'constructionMaterialsCost', { cost: materials })
        : t('constructionMaterialsDelivered'),
      className: '',
    },
  ]
}
