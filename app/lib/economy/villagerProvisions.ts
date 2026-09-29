import { DAILY_CONSUMPTION_PER_VILLAGER } from '../../constants/consumption'
import { materialAmount } from './constructionMaterials'
import type { ResourceAmount } from '../../types/common'

const VILLAGER_PROVISION_DAYS = 3
export function personalFoodReserve(): number {
  return (DAILY_CONSUMPTION_PER_VILLAGER.food ?? 0) * VILLAGER_PROVISION_DAYS
}

export function depositableResource(bag: ResourceAmount, resource: keyof ResourceAmount): number {
  const amount = bag[resource] ?? 0
  return ['food', 'wheat', 'berry', 'meat'].includes(resource)
    ? Math.min(amount, Math.max(0, materialAmount(bag, 'food') - personalFoodReserve()))
    : amount
}
