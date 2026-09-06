import type { AIBuildingLike, AIResourceAmount, AIStrategyPlayerLike, AIStrategySnapshot } from './types'

type ProductionStrategy = {
  ai: AIStrategyPlayerLike
  trainUnits(
    currentCount: number,
    maxCount: number,
    buildingList: AIBuildingLike[],
    unitType: string,
    villagers: AIStrategySnapshot['villagers'],
    reserve?: AIResourceAmount,
    debug?: boolean
  ): number
  getEconomicDemand(): AIResourceAmount
}

function addReservedTrainingCost(
  reserve: AIResourceAmount,
  cost: AIResourceAmount = {},
  count: number
): AIResourceAmount {
  const next = { ...reserve }
  for (const [resource, amount] of Object.entries(cost) as Array<[keyof AIResourceAmount, number | undefined]>) {
    if (typeof amount === 'number') next[resource] = (next[resource] ?? 0) + amount * count
  }
  return next
}

export function handleAIProductionActions(
  strategy: ProductionStrategy,
  snapshot: AIStrategySnapshot,
  debug: boolean = false
): number {
  const { villagers, infantry, maxInfantry, barracks, infantryUnit, archers, maxArcher, archeryRanges, archerUnit } =
    snapshot

  let actions = 0
  let reserve = strategy.getEconomicDemand()

  const infantryOrders = strategy.trainUnits(infantry.length, maxInfantry, barracks, infantryUnit, villagers, reserve, debug)
  actions += infantryOrders
  reserve = addReservedTrainingCost(reserve, strategy.ai.config.units[infantryUnit]?.cost, infantryOrders)

  const archerOrders = strategy.trainUnits(archers.length, maxArcher, archeryRanges, archerUnit, villagers, reserve, debug)
  actions += archerOrders
  return actions
}
