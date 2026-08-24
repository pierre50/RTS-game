import { UNIT_TYPES } from '../constants'
import { hasLivingChief } from '../lib/chief'
import type { UnitCreationExtra } from '../types/entities'
import type { AIBuildingLike, AIResourceAmount, AIStrategyPlayerLike, AIStrategySnapshot } from './types'

type ProductionStrategy = {
  ai: AIStrategyPlayerLike
  buyUnits(
    currentCount: number,
    maxCount: number,
    buildingList: AIBuildingLike[],
    unitType: string,
    extra: UnitCreationExtra | undefined,
    reserve?: AIResourceAmount,
    debug?: boolean
  ): number
  getEconomicDemand(): AIResourceAmount
}

export function handleAIProductionActions(
  strategy: ProductionStrategy,
  snapshot: AIStrategySnapshot,
  debug: boolean = false
): number {
  const {
    villagers,
    maxVillagers,
    towncenters,
    infantry,
    maxInfantry,
    barracks,
    infantryUnit,
    archers,
    maxArcher,
    archeryRanges,
    archerUnit,
  } = snapshot

  let actions = 0
  const reserve = strategy.getEconomicDemand()
  const chiefAlive = hasLivingChief(strategy.ai)

  if (chiefAlive) {
    actions += strategy.buyUnits(
      villagers.length,
      maxVillagers,
      towncenters,
      UNIT_TYPES.villager,
      undefined,
      reserve,
      debug
    )
  }
  actions += strategy.buyUnits(infantry.length, maxInfantry, barracks, infantryUnit, undefined, reserve, debug)
  actions += strategy.buyUnits(archers.length, maxArcher, archeryRanges, archerUnit, undefined, reserve, debug)
  return actions
}
