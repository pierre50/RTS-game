import { AGE_GATE_MAX_UNLOCKABLE_VALUE, AGE_UP_ENABLED, BUILDING_TYPES } from '../constants'
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
import type { UnitCreationExtra } from '../types/entities'
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

function resourceEntries(cost: AIResourceAmount = {}): [AIResourceName, number][] {
  return RESOURCE_NAMES.map(resource => [resource, cost[resource]] as [AIResourceName, number | undefined]).filter(
    (entry): entry is [AIResourceName, number] => typeof entry[1] === 'number'
  )
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

  getEconomicDemand(): AIResourceAmount {
    const { ai } = this
    const demand: Record<keyof AIResourceAmount, number> = { food: 0, wood: 0, gold: 0, stone: 0 }
    const nextAgeKey = ai.age + 1
    const nextAgeCost = (AGE_UP_COSTS as Record<number, AIResourceAmount>)[nextAgeKey]
    if (AGE_UP_ENABLED && nextAgeCost) {
      const maxVillagers = Math.floor(this.maxVillagerPerAge[ai.age] * ai.difficultyConfig.popCapMultiplier)
      const shouldReserveAgeUp = ai.population >= Math.floor(maxVillagers * 0.7)
      for (const [resource, amount] of resourceEntries(nextAgeCost)) {
        demand[resource] += shouldReserveAgeUp ? amount : Math.max(0, amount - ai[resource])
      }
    }

    if (ai.population + 2 > ai.populationMax) {
      demand.wood += ai.config.buildings[BUILDING_TYPES.house]?.cost?.wood || 0
    }
    const currentBarracks = ai.buildings.filter(
      (building: AIBuildingLike) =>
        building.type === BUILDING_TYPES.barracks && !building.isDead && !building.isDestroyed
    ).length
    const desiredBarracks = this.getDesiredBarracksCount()
    if (ai.phase !== 'economy' && currentBarracks < desiredBarracks) {
      demand.wood +=
        (ai.config.buildings[BUILDING_TYPES.barracks]?.cost?.wood || 0) * (desiredBarracks - currentBarracks)
    }
    if (!ai.buildings.some((building: AIBuildingLike) => building.type === BUILDING_TYPES.market)) {
      demand.wood += ai.config.buildings[BUILDING_TYPES.market]?.cost?.wood || 0
    }

    return demand
  }

  getAgeUpReserve(): AIResourceAmount {
    if (!AGE_UP_ENABLED) return {}
    const { ai } = this
    const nextAgeCost = (AGE_UP_COSTS as Record<number, AIResourceAmount>)[ai.age + 1]
    if (!nextAgeCost) return {}

    const maxVillagers = Math.floor(this.maxVillagerPerAge[ai.age] * ai.difficultyConfig.popCapMultiplier)
    return ai.population >= Math.floor(maxVillagers * 0.7) ? nextAgeCost : {}
  }

  canSpendWithReserve(cost: AIResourceAmount, reserve: AIResourceAmount = {}): boolean {
    const { ai } = this
    const resources = hasPlayerResourceChests(ai) ? getPlayerResourceTotals(ai) : ai
    return resourceEntries(cost).every(([resource, amount]) => (resources[resource] ?? 0) - amount >= (reserve[resource] || 0))
  }

  buyUnits(
    currentCount: number,
    maxCount: number,
    buildingList: AIBuildingLike[],
    unitType: string,
    extra: UnitCreationExtra | undefined,
    reserve: AIResourceAmount = {},
    debug: boolean = false
  ): number {
    const unitsNeeded = maxCount - currentCount
    let unitsBought = 0
    if (unitsNeeded <= 0) return 0
    const unitCost = this.ai.config.units[unitType]?.cost || {}
    for (const building of buildingList) {
      if (unitsBought >= unitsNeeded) break
      if (
        building &&
        this.canSpendWithReserve(unitCost, reserve) &&
        building.buyUnit?.(unitType, false, false, extra)
      ) {
        unitsBought++
        if (debug) console.log(`Buying ${unitType} from ${building.type}, Total Bought: ${unitsBought}`)
      }
    }
    return unitsBought
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
