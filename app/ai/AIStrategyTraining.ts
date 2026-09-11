import { ACTION_TYPES, BUILDING_TYPES, UNIT_TYPES } from '../constants'
import type { AIStrategy } from './AIStrategy'
import { addResourceAmounts } from './AIStrategyResources'
import type { AIBuildingLike, AIEntityLike, AIResourceAmount, AIStrategySnapshot } from './types'

import { AI_BUILDING_TRAINING_CAPACITY } from './config'
import { getUnitTrainingCost } from '../lib/training/unitTrainingCost'
function hasAiBuildingTrainingCapacity(building: AIBuildingLike): boolean {
  const active = building.loading != null || building.trainingUnit ? 1 : 0
  const queued = Math.max(0, (building.queue?.length ?? 0) - active)
  const concurrent = building.trainingQueue?.length ?? 0
  const incoming =
    building.owner?.units?.filter(
      unit => unit.dest === building && Boolean(unit.trainingTargetType) && !unit.isDead && !unit.isDestroyed
    ).length ?? 0
  return active + queued + concurrent + incoming < AI_BUILDING_TRAINING_CAPACITY
}

function canAiVillagerTrainAtBuilding(building: AIBuildingLike, villager: AIEntityLike, unitType: string): boolean {
  return villager.type === UNIT_TYPES.villager && Boolean(building.units?.includes(unitType))
}

export function getTrainingLoad(buildings: AIBuildingLike[] = []): number {
  return buildings.reduce((total: number, building: AIBuildingLike) => {
    if (!building || building.isDead || building.isDestroyed) return total
    return total + (building.queue?.length || 0) + (building.loading != null ? 1 : 0)
  }, 0)
}

export function getDesiredBarracksCount(
  strategy: AIStrategy,
  snapshot: Partial<AIStrategySnapshot> | null = null
): number {
  const { ai } = strategy
  const barracks: AIBuildingLike[] =
    snapshot?.barracks || ai.buildings.filter((building: AIBuildingLike) => building.type === BUILDING_TYPES.barracks)
  const builtBarracks = barracks.filter(
    (building: AIBuildingLike) => building.isBuilt && !building.isDead && !building.isDestroyed
  )
  const totalMilitary =
    (snapshot?.infantry?.length || 0) + (snapshot?.archers?.length || 0) + (snapshot?.cavalry?.length || 0)

  let desired = ai.phase !== 'economy' ? 1 : 0

  if (
    strategy.hasReachedAge(2) &&
    ai.phase !== 'economy' &&
    (totalMilitary >= 8 || strategy.getTrainingLoad(builtBarracks) >= Math.max(2, builtBarracks.length * 2))
  ) {
    desired = 2
  }

  return desired
}

export function trainUnits(
  strategy: AIStrategy,
  currentCount: number,
  maxCount: number,
  buildingList: AIBuildingLike[],
  unitType: string,
  villagers: AIEntityLike[],
  reserve: AIResourceAmount = {},
  debug: boolean = false
): number {
  const unitsNeeded = maxCount - currentCount
  let trainingOrders = 0
  if (unitsNeeded <= 0) return 0
  const unitCost = getUnitTrainingCost(strategy.ai, unitType)
  let reservedForOrders = reserve
  const candidates = villagers.filter(
    villager =>
      villager.type === UNIT_TYPES.villager &&
      !villager.isDead &&
      !villager.isDestroyed &&
      villager.action !== ACTION_TYPES.attack &&
      !villager.trainingTargetType
  )

  for (const villager of candidates) {
    if (trainingOrders >= unitsNeeded) break
    if (!strategy.canSpendWithReserve(unitCost, reservedForOrders)) break
    const building = buildingList.find(
      candidate =>
        candidate &&
        !candidate.isDead &&
        !candidate.isDestroyed &&
        hasAiBuildingTrainingCapacity(candidate) &&
        canAiVillagerTrainAtBuilding(candidate, villager, unitType)
    )
    if (!building) break

    if (!villager.sendToEvt) continue
    villager.trainingTargetType = unitType
    const sent = villager.sendToEvt(building, ACTION_TYPES.train, { forceRepath: true, allowPassageStop: true })
    if (sent === false) {
      villager.trainingTargetType = null
      continue
    }
    trainingOrders++
    reservedForOrders = addResourceAmounts(reservedForOrders, unitCost)
    if (debug)
      console.log(`Sending ${villager.label} to train ${unitType} at ${building.type}, Total Orders: ${trainingOrders}`)
  }
  return trainingOrders
}
