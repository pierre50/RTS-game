import type { RESOURCE_STORAGE_NAMES } from '../../constants'
import type { ResourceAmount } from '../../types/common'

type StorageResourceName = (typeof RESOURCE_STORAGE_NAMES)[number]

export type ResourceName = StorageResourceName | 'food'

const FOOD_DEDUCTION_ORDER: readonly ('wheat' | 'meat' | 'berry')[] = ['wheat', 'meat', 'berry']

export function expandLegacyFoodAmount(amount: ResourceAmount | null | undefined): ResourceAmount {
  const { food, ...rest } = amount ?? {}
  const legacyFood = Math.max(0, Math.floor(food ?? 0))
  if (legacyFood <= 0) return rest
  const third = Math.floor(legacyFood / 3)
  return {
    ...rest,
    berry: (rest.berry ?? 0) + third,
    meat: (rest.meat ?? 0) + third,
    wheat: (rest.wheat ?? 0) + (legacyFood - third * 2),
  }
}

export function expandFoodCost(cost: ResourceAmount, totals: Record<ResourceName, number>): ResourceAmount {
  const foodAmount = Math.max(0, Math.floor(cost.food ?? 0))
  if (foodAmount <= 0) return cost
  const { food: _food, ...expanded } = cost
  let remaining = foodAmount
  for (const sub of FOOD_DEDUCTION_ORDER) {
    if (remaining <= 0) break
    const available = totals[sub] ?? 0
    const taken = Math.min(available, remaining)
    if (taken > 0) expanded[sub] = (expanded[sub] ?? 0) + taken
    remaining -= taken
  }
  return expanded
}

export function expandFoodDeposit(resources: ResourceAmount): ResourceAmount {
  const foodAmount = Math.max(0, Math.floor(resources.food ?? 0))
  if (foodAmount <= 0) return resources
  const { food: _food, ...expanded } = resources
  expanded.wheat = (expanded.wheat ?? 0) + foodAmount
  return expanded
}
