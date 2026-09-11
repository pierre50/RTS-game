import { getPlayerBuildingConfig } from '../lib/buildings/buildingAge'
import { BUILDING_TYPES, DAILY_CONSUMPTION_PER_VILLAGER, VILLAGER_ARRIVAL_CONFIG } from '../constants'
import { getPlayerResourceTotals, hasPlayerResourceChests } from '../lib/resources/playerResourceTotals'
import type { AIStrategy } from './AIStrategy'
import { resourceEntries } from './AIStrategyResources'
import type { AIBuildingLike, AIEntityLike, AIResourceAmount } from './types'
import {
  expectedVillageArrivals as getExpectedVillagerArrivalWave,
  villageBuildingNeeds,
  villageConstructionReserve,
} from './AIDevelopmentPolicy'

function livingBuildings(buildings: AIBuildingLike[] = [], type: string): AIBuildingLike[] {
  return buildings.filter(building => building.type === type && !building.isDead && !building.isDestroyed)
}

export function getCurrentResources(strategy: AIStrategy): AIResourceAmount {
  const resources = hasPlayerResourceChests(strategy.ai) ? getPlayerResourceTotals(strategy.ai) : strategy.ai
  return {
    food: resources.food ?? 0,
    gold: resources.gold ?? 0,
    stone: resources.stone ?? 0,
    wood: resources.wood ?? 0,
    ...(resources.fiber != null ? { fiber: resources.fiber } : {}),
    ...(resources.leather != null ? { leather: resources.leather } : {}),
  }
}

export function getVillagerGrowthFoodReserve(strategy: AIStrategy): number {
  const dailyFood = DAILY_CONSUMPTION_PER_VILLAGER.food ?? 0
  if (dailyFood <= 0 || strategy.ai.population <= 0) return 0
  const expectedArrivals = Math.min(
    getExpectedVillagerArrivalWave(strategy.ai.population),
    Math.max(0, strategy.ai.populationMax - strategy.ai.population)
  )
  return (
    dailyFood * strategy.ai.population * VILLAGER_ARRIVAL_CONFIG.currentPopulationReserveDays +
    dailyFood * expectedArrivals * VILLAGER_ARRIVAL_CONFIG.newVillagerReserveDays
  )
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
  const resources = strategy.getCurrentResources()
  const growthReserveFood = strategy.getVillagerGrowthFoodReserve()
  if (growthReserveFood > 0) demand.food = (demand.food ?? 0) + Math.max(0, growthReserveFood - (resources.food ?? 0))

  const needs = villageBuildingNeeds({
    population: ai.population,
    populationMax: ai.populationMax,
    age: ai.age,
    phase: ai.phase,
    desiredBarracks: strategy.getDesiredBarracksCount(),
    buildings: ai.buildings,
  })
  const currentBarracks = livingBuildings(ai.buildings, BUILDING_TYPES.barracks).length
  const desiredBarracks = strategy.getDesiredBarracksCount()
  const reserve = villageConstructionReserve(
    needs,
    type => getPlayerBuildingConfig(ai, type)?.cost ?? {},
    desiredBarracks - currentBarracks
  )
  for (const [resource, amount] of resourceEntries(reserve)) {
    demand[resource] = (demand[resource] ?? 0) + amount
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
