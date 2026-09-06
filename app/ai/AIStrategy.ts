import {
  ACTION_TYPES,
  AGE_GATE_MAX_UNLOCKABLE_VALUE,
  AGE_UP_ENABLED,
  BUILDING_TYPES,
  DAILY_CONSUMPTION_PER_VILLAGER,
  UNIT_TYPES,
  VILLAGER_ARRIVAL_CONFIG,
} from '../constants'
import { AIMilitary } from './AIMilitary'
import { buyAIBuildingIfNeeded, buyAIWheatFieldIfNeeded, handleAIBuildingActions } from './AIStrategyBuilding'
import { handleAIProductionActions } from './AIStrategyProduction'
import { canResearchTechForAI } from './AIStrategyTech'
import { handleAITechnologyActions } from './AIStrategyTechnologyActions'
import { getPlayerResourceTotals, hasPlayerResourceChests } from '../lib/resources/playerResourceTotals'
import {
  AGE_UP_COSTS,
  AI_DIFFICULTIES,
  CHIEF_TECH_PRIORITY,
  MAX_ARCHER_BY_AGE,
  MAX_BUILDING_BY_AGE,
  MAX_BUILDING_BY_AGE_FROZEN,
  MAX_CAVALRY_BY_AGE,
  MAX_INFANTRY_BY_AGE,
  MAX_VILLAGER_PER_AGE,
  NEXT_AGE,
  TECH_PRIORITY_BY_BUILDING,
  VILLAGE_TARGET_PERCENTAGE_BY_AGE,
} from './config'
import { ARCHER_TECH_UPGRADES, getBestUnitFromTechs } from './unitGroups'
import type {
  AIAge,
  AIBuildingLike,
  AIDifficultyConfig,
  AIEntityLike,
  AIGridPosition,
  AIResourceAmount,
  AIResourceName,
  AIStrategyPlayerLike,
  AIStrategySnapshot,
} from './types'

type AgeMap<T> = Record<AIAge, T>
type NextAgeMap = Partial<Record<1 | 2 | 3, string>>
type BuildingListByType = Record<string, AIBuildingLike[]>
type MilitaryOptions = Parameters<AIMilitary['handleActions']>[0]
type MilitaryActionsResult = ReturnType<AIMilitary['handleActions']>

const RESOURCE_NAMES: AIResourceName[] = ['wood', 'food', 'gold', 'stone']
const AI_BUILDING_TRAINING_CAPACITY = 5

function resourceEntries(cost: AIResourceAmount = {}): [AIResourceName, number][] {
  return RESOURCE_NAMES.map(resource => [resource, cost[resource]] as [AIResourceName, number | undefined]).filter(
    (entry): entry is [AIResourceName, number] => typeof entry[1] === 'number'
  )
}

function livingBuildings(buildings: AIBuildingLike[] = [], type: string): AIBuildingLike[] {
  return buildings.filter(building => building.type === type && !building.isDead && !building.isDestroyed)
}

function getExpectedVillagerArrivalWave(population: number): number {
  if (population <= 0) return 0
  return Math.min(
    Math.max(1, Math.floor(population * VILLAGER_ARRIVAL_CONFIG.growthRate)),
    VILLAGER_ARRIVAL_CONFIG.maxArrivalsPerDay
  )
}

function addResourceAmounts(a: AIResourceAmount, b: AIResourceAmount): AIResourceAmount {
  const result = { ...a }
  for (const [resource, amount] of resourceEntries(b)) {
    result[resource] = (result[resource] ?? 0) + amount
  }
  return result
}

function canAiVillagerTrainAtBuilding(building: AIBuildingLike, villager: AIEntityLike, unitType: string): boolean {
  return villager.type === UNIT_TYPES.villager && Boolean(building.units?.includes(unitType))
}

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

export class AIStrategy {
  ai: AIStrategyPlayerLike
  difficulty: string
  difficultyConfig: AIDifficultyConfig
  nextAge: NextAgeMap
  maxVillagerPerAge: AgeMap<number>
  villageTargetPercentageByAge: AgeMap<Record<keyof AIResourceAmount, number>>
  maxBuildingByAge: AgeMap<Record<string, number>>
  maxInfantryByAge: AgeMap<number>
  maxArcherByAge: AgeMap<number>
  maxCavalryByAge: AgeMap<number>
  chiefTechPriority: string[]
  techPriorityByBuilding: Record<string, string[]>
  military: AIMilitary

  constructor(ai: AIStrategyPlayerLike, difficulty: string = 'medium') {
    this.ai = ai
    this.difficulty = difficulty
    this.difficultyConfig =
      (AI_DIFFICULTIES as Record<string, AIDifficultyConfig>)[difficulty] || AI_DIFFICULTIES.medium
    this.nextAge = NEXT_AGE
    this.maxVillagerPerAge = MAX_VILLAGER_PER_AGE
    this.villageTargetPercentageByAge = VILLAGE_TARGET_PERCENTAGE_BY_AGE
    this.maxBuildingByAge = AGE_UP_ENABLED ? MAX_BUILDING_BY_AGE : MAX_BUILDING_BY_AGE_FROZEN
    this.maxInfantryByAge = MAX_INFANTRY_BY_AGE
    this.maxArcherByAge = MAX_ARCHER_BY_AGE
    this.maxCavalryByAge = MAX_CAVALRY_BY_AGE
    this.chiefTechPriority = CHIEF_TECH_PRIORITY
    this.techPriorityByBuilding = TECH_PRIORITY_BY_BUILDING
    this.military = new AIMilitary(ai, this)
  }

  applyConfig(target: AIStrategyPlayerLike): void {
    target.difficultyConfig = this.difficultyConfig
    target.nextAge = this.nextAge
    target.maxVillagerPerAge = this.maxVillagerPerAge
    target.villageTargetPercentageByAge = this.villageTargetPercentageByAge
    target.maxBuildingByAge = this.maxBuildingByAge
    target.maxInfantryByAge = this.maxInfantryByAge
    target.maxArcherByAge = this.maxArcherByAge
    target.maxCavalryByAge = this.maxCavalryByAge
    target.techPriorityByBuilding = this.techPriorityByBuilding
  }

  // Vrai si l'IA doit être considérée comme ayant atteint `requiredAge` : soit réellement (age-up
  // actif), soit parce que ce palier est "atteignable" (<= AGE_GATE_MAX_UNLOCKABLE_VALUE) et qu'on
  // ne veut pas la brider à vie pendant que le passage d'âge est désactivé.
  hasReachedAge(requiredAge: number): boolean {
    if (!AGE_UP_ENABLED) return requiredAge <= AGE_GATE_MAX_UNLOCKABLE_VALUE
    return this.ai.age >= requiredAge
  }

  canResearchTech(techKey: string): boolean {
    return canResearchTechForAI(this.ai, techKey, requiredAge => this.hasReachedAge(requiredAge))
  }

  getBestInfantryUnit(): string {
    return 'Fantassin'
  }

  getBestArcherUnit(): string {
    return getBestUnitFromTechs(this.ai.technologies, ARCHER_TECH_UPGRADES, 'Bowman')
  }

  updatePhase(villagersCount: number): string {
    const { ai, difficultyConfig } = this
    if (ai.phase === 'economy' && villagersCount >= difficultyConfig.econToMilVillagers) {
      ai.phase = 'military_build'
      return 'military_build'
    }
    if (ai.phase === 'military_build' && villagersCount < Math.floor(difficultyConfig.econToMilVillagers * 0.6)) {
      ai.phase = 'economy'
      return 'economy'
    }
    if ((ai.phase as string) === 'attack') {
      ai.phase = 'military_build'
      return 'military_build'
    }
    return ai.phase
  }

  handleMilitaryActions(options: MilitaryOptions): MilitaryActionsResult {
    return this.military.handleActions(options)
  }

  isTechnologyInProgress(_technologyType: string, _buildingList: AIBuildingLike[] = []): boolean {
    return false
  }

  getTrainingLoad(buildings: AIBuildingLike[] = []): number {
    return buildings.reduce((total: number, building: AIBuildingLike) => {
      if (!building || building.isDead || building.isDestroyed) return total
      return total + (building.queue?.length || 0) + (building.loading != null ? 1 : 0)
    }, 0)
  }

  getDesiredBarracksCount(snapshot: Partial<AIStrategySnapshot> | null = null): number {
    const { ai } = this
    const barracks: AIBuildingLike[] =
      snapshot?.barracks || ai.buildings.filter((building: AIBuildingLike) => building.type === BUILDING_TYPES.barracks)
    const builtBarracks = barracks.filter(
      (building: AIBuildingLike) => building.isBuilt && !building.isDead && !building.isDestroyed
    )
    const totalMilitary =
      (snapshot?.infantry?.length || 0) + (snapshot?.archers?.length || 0) + (snapshot?.cavalry?.length || 0)

    let desired = ai.phase !== 'economy' ? 1 : 0

    if (
      this.hasReachedAge(2) &&
      ai.phase !== 'economy' &&
      (totalMilitary >= 8 || this.getTrainingLoad(builtBarracks) >= Math.max(2, builtBarracks.length * 2))
    ) {
      desired = 2
    }

    return desired
  }

  getCurrentResources(): AIResourceAmount {
    const resources = hasPlayerResourceChests(this.ai) ? getPlayerResourceTotals(this.ai) : this.ai
    return {
      food: resources.food ?? 0,
      gold: resources.gold ?? 0,
      stone: resources.stone ?? 0,
      wood: resources.wood ?? 0,
    }
  }

  getVillagerGrowthFoodReserve(): number {
    const dailyFood = DAILY_CONSUMPTION_PER_VILLAGER.food ?? 0
    if (dailyFood <= 0 || this.ai.population <= 0) return 0
    const expectedArrivals = Math.min(
      getExpectedVillagerArrivalWave(this.ai.population),
      Math.max(0, this.ai.populationMax - this.ai.population)
    )
    return (
      dailyFood * this.ai.population * VILLAGER_ARRIVAL_CONFIG.currentPopulationReserveDays +
      dailyFood * expectedArrivals * VILLAGER_ARRIVAL_CONFIG.newVillagerReserveDays
    )
  }

  addBuildingReserve(demand: AIResourceAmount, buildingType: string, count: number = 1): void {
    const cost = this.ai.config.buildings[buildingType]?.cost ?? {}
    for (const [resource, amount] of resourceEntries(cost)) {
      demand[resource] = (demand[resource] ?? 0) + amount * count
    }
  }

  getEconomicDemand(): AIResourceAmount {
    const { ai } = this
    const demand: Record<keyof AIResourceAmount, number> = { food: 0, wood: 0, gold: 0, stone: 0 }
    const resources = this.getCurrentResources()
    const growthReserveFood = this.getVillagerGrowthFoodReserve()
    if (growthReserveFood > 0) demand.food += Math.max(0, growthReserveFood - (resources.food ?? 0))

    const nextAgeKey = ai.age + 1
    const nextAgeCost = (AGE_UP_COSTS as Record<number, AIResourceAmount>)[nextAgeKey]
    if (AGE_UP_ENABLED && nextAgeCost) {
      const maxVillagers = Math.floor(this.maxVillagerPerAge[ai.age] * (ai.difficultyConfig.popCapMultiplier ?? 1))
      const shouldReserveAgeUp = ai.population >= Math.floor(maxVillagers * 0.7)
      for (const [resource, amount] of resourceEntries(nextAgeCost)) {
        demand[resource] += shouldReserveAgeUp ? amount : Math.max(0, amount - (resources[resource] ?? 0))
      }
    }

    const expectedArrivals = getExpectedVillagerArrivalWave(ai.population)
    if (ai.population + expectedArrivals + 2 > ai.populationMax) {
      this.addBuildingReserve(demand, BUILDING_TYPES.house)
    }
    if (!livingBuildings(ai.buildings, BUILDING_TYPES.storagePit).length) {
      this.addBuildingReserve(demand, BUILDING_TYPES.storagePit)
    }
    if (!livingBuildings(ai.buildings, BUILDING_TYPES.granary).length) {
      this.addBuildingReserve(demand, BUILDING_TYPES.granary)
    }

    const currentBarracks = livingBuildings(ai.buildings, BUILDING_TYPES.barracks).length
    const desiredBarracks = this.getDesiredBarracksCount()
    if (ai.phase !== 'economy' && currentBarracks < desiredBarracks) {
      this.addBuildingReserve(demand, BUILDING_TYPES.barracks, desiredBarracks - currentBarracks)
    }
    if (!livingBuildings(ai.buildings, BUILDING_TYPES.market).length) {
      this.addBuildingReserve(demand, BUILDING_TYPES.market)
    }

    return demand
  }

  getAgeUpReserve(): AIResourceAmount {
    if (!AGE_UP_ENABLED) return {}
    const { ai } = this
    const nextAgeCost = (AGE_UP_COSTS as Record<number, AIResourceAmount>)[ai.age + 1]
    if (!nextAgeCost) return {}

    const maxVillagers = Math.floor(this.maxVillagerPerAge[ai.age] * (ai.difficultyConfig.popCapMultiplier ?? 1))
    return ai.population >= Math.floor(maxVillagers * 0.7) ? nextAgeCost : {}
  }

  canSpendWithReserve(cost: AIResourceAmount, reserve: AIResourceAmount = {}): boolean {
    const { ai } = this
    const resources = hasPlayerResourceChests(ai) ? getPlayerResourceTotals(ai) : ai
    return resourceEntries(cost).every(
      ([resource, amount]) => (resources[resource] ?? 0) - amount >= (reserve[resource] || 0)
    )
  }

  trainUnits(
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
    const unitCost = this.ai.config.units[unitType]?.cost || {}
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
      if (!this.canSpendWithReserve(unitCost, reservedForOrders)) break
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
        console.log(
          `Sending ${villager.label} to train ${unitType} at ${building.type}, Total Orders: ${trainingOrders}`
        )
    }
    return trainingOrders
  }

  handleProductionActions(snapshot: AIStrategySnapshot, debug: boolean = false): number {
    return handleAIProductionActions(this, snapshot, debug)
  }

  getViableBerryBushCount(): number {
    const { ai } = this
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
      if (!bush || bush.isDead || (bush.quantity || 0) <= 0) return false
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

  buyBuildingIfNeeded(
    condition: boolean,
    buildingType: string,
    buildingsByType: BuildingListByType,
    positionCallback: () => AIGridPosition | null,
    reserve: AIResourceAmount = {},
    debug: boolean = false
  ): boolean {
    return buyAIBuildingIfNeeded(this, condition, buildingType, buildingsByType, positionCallback, reserve, debug)
  }

  buyWheatFieldIfNeeded(
    condition: boolean,
    currentWheatTiles: AIEntityLike[],
    positionCallback: () => AIGridPosition | null,
    reserve: AIResourceAmount = {},
    debug: boolean = false
  ): boolean {
    return buyAIWheatFieldIfNeeded(this, condition, currentWheatTiles, positionCallback, reserve, debug)
  }

  handleBuildingActions(snapshot: AIStrategySnapshot, debug: boolean = false): number {
    return handleAIBuildingActions(this, snapshot, debug)
  }

  handleTechnologyActions(snapshot: AIStrategySnapshot, debug: boolean = false): number {
    return handleAITechnologyActions(this, snapshot, debug)
  }
}
