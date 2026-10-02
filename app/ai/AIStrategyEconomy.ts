import { remainingConstructionMaterials } from '../lib/economy/constructionMaterials'
import { villageFoodReserve } from '../lib/economy/collectiveNeeds'
import { getPlayerBuildingConfig } from '../lib/buildings/buildingLevel'
import { BUILDING_TYPES } from '../constants'
import { getPlayerResourceTotals, hasPlayerResourceChests } from '../lib/resources/playerResourceTotals'
import type { AIStrategy } from './AIStrategy'
import { resourceEntries } from './AIStrategyResources'
import type { AIBuildingLike, AIEntityLike, AIResourceAmount } from './types'

export function getCurrentResources(strategy: AIStrategy): AIResourceAmount {
  const resources = hasPlayerResourceChests(strategy.ai) ? getPlayerResourceTotals(strategy.ai) : strategy.ai
  return {
    food: resources.food ?? 0,
    gold: resources.gold ?? 0,
    stone: resources.stone ?? 0,
    wood: resources.wood ?? 0,
    ...(resources.wheat != null ? { wheat: resources.wheat } : {}),
    ...(resources.fiber != null ? { fiber: resources.fiber } : {}),
    ...(resources.leather != null ? { leather: resources.leather } : {}),
  }
}

export function getVillagerGrowthFoodReserve(strategy: AIStrategy): number {
  return villageFoodReserve(strategy.ai.population, strategy.ai.populationMax)
}

export function addBuildingReserve(
  strategy: AIStrategy,
  demand: AIResourceAmount,
  buildingType: string,
  count: number = 1
): void {
  const cost = getPlayerBuildingConfig(strategy.ai, buildingType)?.cost ?? {}
  for (const [resource, amount] of resourceEntries(cost)) {
    demand[resource] = (demand[resource] ?? 0) + amount * count
  }
}

export function getEconomicDemand(strategy: AIStrategy): AIResourceAmount {
  const { ai } = strategy
  const demand: AIResourceAmount = { food: 0, wood: 0, gold: 0, stone: 0 }
  const growthReserveFood = strategy.getVillagerGrowthFoodReserve()
  if (growthReserveFood > 0) demand.food = (demand.food ?? 0) + growthReserveFood

  for (const site of ai.buildings) {
    if (site.isDead || site.isDestroyed || site.isBuilt) continue
    for (const [resource, amount] of resourceEntries(remainingConstructionMaterials(site))) {
      demand[resource] = (demand[resource] ?? 0) + amount
    }
  }

  return demand
}

export function canSpendWithReserve(
  strategy: AIStrategy,
  cost: AIResourceAmount,
  reserve: AIResourceAmount = {}
): boolean {
  const { ai } = strategy
  const resources = hasPlayerResourceChests(ai) ? getPlayerResourceTotals(ai) : ai
  return resourceEntries(cost).every(
    ([resource, amount]) => (resources[resource] ?? 0) - amount >= (reserve[resource] || 0)
  )
}

export function getViableBerryBushCount(strategy: AIStrategy): number {
  const { ai } = strategy
  const dropSites = ai.buildings.filter(
    (building: AIBuildingLike) =>
      [BUILDING_TYPES.townCenter, BUILDING_TYPES.granary].includes(building.type) &&
      building.isBuilt &&
      !building.isDead &&
      !building.isDestroyed
  )
  const homeAnchor = ai.getHomeAnchor()
  const MAX_BERRY_DROP_DIST = 14
  const MAX_BERRY_HOME_DIST = 30

  return [...ai.foundedBerrybushs].filter((bush: AIEntityLike) => {
    if (!bush || bush.isDead || bush.isDestroyed || (bush.quantity || 0) <= 0) return false
    if (dropSites.length > 0) {
      const nearDropSite = dropSites.some(
        (site: AIBuildingLike) => Math.abs(bush.i - site.i) + Math.abs(bush.j - site.j) <= MAX_BERRY_DROP_DIST
      )
      if (!nearDropSite) return false
    }
    if (!homeAnchor) return true
    return Math.abs(bush.i - homeAnchor.i) + Math.abs(bush.j - homeAnchor.j) <= MAX_BERRY_HOME_DIST
  }).length
}
