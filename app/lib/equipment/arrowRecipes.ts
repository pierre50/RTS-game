import type { ResourceAmount } from '../../types/common'

/** Batch costs shared by town supplies and the per-arrow manual crafting recipes. */
export const ARROW_BATCH_SIZE = 10
export const ARROW_RECIPES: readonly { item: string; cost: ResourceAmount }[] = [
  { item: 'arrow_ceramic', cost: { wood: 5, stone: 2 } },
  { item: 'arrow_bronze', cost: { wood: 5, bronzeIngot: 1 } },
  { item: 'arrow_iron', cost: { wood: 5, ironIngot: 1 } },
]
