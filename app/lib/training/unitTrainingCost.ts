import { UNIT_TRAINING_AGE_METAL_COST } from '../../constants/unitTrainingAgeCost'
import type { ResourceAmount } from '../../types/common'
import type { PlayerLike } from '../../types/player'

export function getUnitTrainingCost(owner: PlayerLike | null | undefined, type: string): ResourceAmount {
  const baseCost = owner?.config?.units?.[type]?.cost ?? {}
  const age = Math.max(0, Math.floor(owner?.age ?? 0))
  const ageCost = UNIT_TRAINING_AGE_METAL_COST[type]?.[age]
  return ageCost ? { ...baseCost, ...ageCost } : baseCost
}
