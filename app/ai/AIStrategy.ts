import { AIMilitary } from './AIMilitary'
import { villagePhase } from './AIDevelopmentPolicy'
import { buyAIBuildingIfNeeded, buyAIWheatFieldIfNeeded, handleAIBuildingActions } from './AIStrategyBuilding'
import {
  addBuildingReserve as runAddBuildingReserve,
  canSpendWithReserve as runCanSpendWithReserve,
  getCurrentResources as runGetCurrentResources,
  getEconomicDemand as runGetEconomicDemand,
  getViableBerryBushCount as runGetViableBerryBushCount,
  getVillagerGrowthFoodReserve as runGetVillagerGrowthFoodReserve,
} from './AIStrategyEconomy'
import { handleAIProductionActions } from './AIStrategyProduction'
import {
  getDesiredBarracksCount as runGetDesiredBarracksCount,
  getTrainingLoad as runGetTrainingLoad,
  trainUnits as runTrainUnits,
} from './AIStrategyTraining'
import {
  AI_DIFFICULTIES,
  MAX_ARCHERS,
  MAX_BUILDINGS,
  MAX_CAVALRY,
  MAX_INFANTRY,
  MAX_VILLAGERS,
} from './config'
import type {
  AIBuildingLike,
  AIDifficultyConfig,
  AIEntityLike,
  AIGridPosition,
  AIResourceAmount,
  AIStrategyPlayerLike,
  AIStrategySnapshot,
} from './types'

type BuildingListByType = Record<string, AIBuildingLike[]>
type MilitaryOptions = Parameters<AIMilitary['handleActions']>[0]
type MilitaryActionsResult = ReturnType<AIMilitary['handleActions']>

export class AIStrategy {
  ai: AIStrategyPlayerLike
  difficulty: string
  difficultyConfig: AIDifficultyConfig
  maxVillagers: number
  maxBuildings: Record<string, number>
  maxInfantry: number
  maxArchers: number
  maxCavalry: number
  military: AIMilitary

  constructor(ai: AIStrategyPlayerLike, difficulty: string = 'medium') {
    this.ai = ai
    this.difficulty = difficulty
    this.difficultyConfig =
      (AI_DIFFICULTIES as Record<string, AIDifficultyConfig>)[difficulty] || AI_DIFFICULTIES.medium
    this.maxVillagers = MAX_VILLAGERS
    this.maxBuildings = MAX_BUILDINGS
    this.maxInfantry = MAX_INFANTRY
    this.maxArchers = MAX_ARCHERS
    this.maxCavalry = MAX_CAVALRY
    this.military = new AIMilitary(ai, this)
  }

  applyConfig(target: AIStrategyPlayerLike): void {
    target.difficultyConfig = this.difficultyConfig
    target.maxVillagers = this.maxVillagers
    target.maxBuildings = this.maxBuildings
    target.maxInfantry = this.maxInfantry
    target.maxArchers = this.maxArchers
    target.maxCavalry = this.maxCavalry
  }

  getBestInfantryUnit(): string {
    return 'Fantassin'
  }

  getBestArcherUnit(): string {
    return 'Bowman'
  }

  updatePhase(villagersCount: number): string {
    const { ai, difficultyConfig } = this
    ai.phase = villagePhase(ai.phase, villagersCount, difficultyConfig.econToMilVillagers) as typeof ai.phase
    return ai.phase
  }

  handleMilitaryActions(options: MilitaryOptions): MilitaryActionsResult {
    return this.military.handleActions(options)
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
}
