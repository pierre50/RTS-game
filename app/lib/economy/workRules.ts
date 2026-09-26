import { RESOURCE_GATHER_SWINGS } from '../../constants'

/** Economic effects of a work impact, shared by animated workers and catch-up. */
export function getWorkGatherAmount(amounts: Record<string, number> | undefined, work: string, bonus = 0): number {
  return Math.max(1, Math.round(amounts?.[work] ?? 1)) + bonus
}

export function getResourceGatherSwings(resource: string, override?: number): number {
  return Math.max(1, override ?? RESOURCE_GATHER_SWINGS?.[resource as keyof typeof RESOURCE_GATHER_SWINGS] ?? 1)
}

export function getConstructionGain(totalHitPoints: number, constructionTime: number, multiplier = 1): number {
  if (!(totalHitPoints > 0) || !(constructionTime > 0)) return 0
  return Math.max(0, Math.round((totalHitPoints / constructionTime) * multiplier))
}

export function advanceConstruction(
  hitPoints: number,
  totalHitPoints: number,
  constructionTime: number,
  multiplier = 1,
  impacts = 1
): number {
  return Math.min(
    totalHitPoints,
    hitPoints + getConstructionGain(totalHitPoints, constructionTime, multiplier) * impacts
  )
}

export function getHarvestAmount(requested: number, available: number, capacity = Infinity): number {
  return Math.max(0, Math.floor(Math.min(requested, available, capacity)))
}

/** Whole releases only: a two-stroke harvest must not yield half a batch after one stroke. */
export function harvestWithinBudget(
  milliseconds: number,
  releaseMs: number,
  gain: number,
  available: number,
  capacity: number,
  deliveryMsPerItem: number
): { amount: number; milliseconds: number } {
  const limit = getHarvestAmount(available, available, capacity)
  const batchMs = releaseMs + deliveryMsPerItem * gain
  const batches = Math.min(Math.floor(milliseconds / batchMs), Math.floor(limit / gain))
  let amount = batches * gain
  let spent = batches * batchMs
  const tail = limit - amount
  if (tail > 0 && tail < gain && milliseconds - spent >= releaseMs + tail * deliveryMsPerItem) {
    amount += tail
    spent += releaseMs + tail * deliveryMsPerItem
  }
  return { amount, milliseconds: spent }
}
