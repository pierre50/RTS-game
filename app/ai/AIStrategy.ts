import { AGE_GATE_MAX_UNLOCKABLE_VALUE, AGE_UP_ENABLED } from '../constants'
import { AIMilitary } from './AIMilitary'
import { buyAIBuildingIfNeeded, buyAIWheatFieldIfNeeded, handleAIBuildingActions } from './AIStrategyBuilding'
import {
  addBuildingReserve as runAddBuildingReserve,
  canSpendWithReserve as runCanSpendWithReserve,
  getAgeUpReserve as runGetAgeUpReserve,
  getCurrentResources as runGetCurrentResources,
  getEconomicDemand as runGetEconomicDemand,
  getViableBerryBushCount as runGetViableBerryBushCount,
  getVillagerGrowthFoodReserve as runGetVillagerGrowthFoodReserve,
} from './AIStrategyEconomy'
import { handleAIProductionActions } from './AIStrategyProduction'
import { canResearchTechForAI } from './AIStrategyTech'
import { handleAITechnologyActions } from './AIStrategyTechnologyActions'
import {
  getDesiredBarracksCount as runGetDesiredBarracksCount,
  getTrainingLoad as runGetTrainingLoad,
  trainUnits as runTrainUnits,
} from './AIStrategyTraining'
import {
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
import type {
  AIAge,
  AIBuildingLike,
  AIDifficultyConfig,
  AIEntityLike,
  AIGridPosition,
  AIResourceAmount,
  AIStrategyPlayerLike,
  AIStrategySnapshot,
} from './types'
import { ARCHER_TECH_UPGRADES, getBestUnitFromTechs } from './unitGroups'

type AgeMap<T> = Record<AIAge, T>
type NextAgeMap = Partial<Record<1 | 2 | 3, string>>
type BuildingListByType = Record<string, AIBuildingLike[]>
type MilitaryOptions = Parameters<AIMilitary['handleActions']>[0]
type MilitaryActionsResult = ReturnType<AIMilitary['handleActions']>

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
    return runGetTrainingLoad(buildings)
  }

  getDesiredBarracksCount(snapshot: Partial<AIStrategySnapshot> | null = null): number {
    return runGetDesiredBarracksCount(this, snapshot)
  }

  getCurrentResources(): AIResourceAmount {
    return runGetCurrentResources(this)
  }

  getVillagerGrowthFoodReserve(): number {
    return runGetVillagerGrowthFoodReserve(this)
  }

  addBuildingReserve(demand: AIResourceAmount, buildingType: string, count: number = 1): void {
    return runAddBuildingReserve(this, demand, buildingType, count)
  }

  getEconomicDemand(): AIResourceAmount {
    return runGetEconomicDemand(this)
  }

  getAgeUpReserve(): AIResourceAmount {
    return runGetAgeUpReserve(this)
  }

  canSpendWithReserve(cost: AIResourceAmount, reserve: AIResourceAmount = {}): boolean {
    return runCanSpendWithReserve(this, cost, reserve)
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
    return runTrainUnits(this, currentCount, maxCount, buildingList, unitType, villagers, reserve, debug)
  }

  handleProductionActions(snapshot: AIStrategySnapshot, debug: boolean = false): number {
    return handleAIProductionActions(this, snapshot, debug)
  }

  getViableBerryBushCount(): number {
    return runGetViableBerryBushCount(this)
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
