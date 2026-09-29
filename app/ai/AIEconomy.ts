import { flushCollectiveVillageWork } from '../services/CollectiveVillageWork'
import type { PlayerLike } from '../types/player'
import { collectiveWorkerClaims } from '../lib/economy/collectiveNeeds'
import { releaseCollectiveWorker } from './AICollectiveWorkers'
import { withinVillageActivity } from '../lib/units/villageActivity'
import type { UnitEntity } from '../types/entities'
import { knowsNativeResources } from '../lib/campaign/nativeEconomy'
import { ACTION_TYPES, UNIT_TYPES, WORK_TYPES } from '../constants'
import { instancesDistance } from '../lib'
import { assignBuilders, getBuildersNeeded, isValidBuildAssignment, recoverInvalidBuilder } from './AIEconomyBuilders'
import { AIEconomyFoodManager } from './AIEconomyFoodManager'
import {
  assignHorseCaptures,
  getAvailableHorseCaptureSlots,
  getAvailableStableForCapture,
  getCapturableHorses,
} from './AIEconomyHorseCapture'
import { getPlayerResourceTotals, hasPlayerResourceChests } from '../lib/resources/playerResourceTotals'
import type { RuntimeMap } from '../types/map'
import type {
  AIBuildingLike,
  AIEntityLike,
  AIFoodSources,
  AIFoodSourceType,
  AIFoodWorkerCounts,
  AIStrategyPlayerLike,
  AIVillagerActionOptions,
  AIWorkerSnapshot,
  AIWorkerTargets,
} from './types'
import type { BuildingEntity } from '../types/entities'

type DemandResource = 'food' | 'wood' | 'gold' | 'stone'

function getAIResourceSnapshot(ai: AIStrategyPlayerLike): Record<DemandResource, number> {
  const resources = hasPlayerResourceChests(ai) ? getPlayerResourceTotals(ai) : ai
  return {
    food: resources.food ?? 0,
    gold: resources.gold ?? 0,
    stone: resources.stone ?? 0,
    wood: resources.wood ?? 0,
  }
}

export class AIEconomy {
  ai: AIStrategyPlayerLike
  food: AIEconomyFoodManager
  _exploredAll: boolean
  _unexploredScanIndex: number

  getBuildingAsRuntimeEntity(building: AIBuildingLike): BuildingEntity {
    return building as unknown as BuildingEntity
  }

  private measureStage<T>(stage: string, callback: () => T): T {
    const monitor = this.ai.context.performance
    return monitor ? monitor.measure(`ai.economy.${stage}`, callback) : callback()
  }

  constructor(ai: AIStrategyPlayerLike) {
    this.ai = ai
    this.food = new AIEconomyFoodManager(ai, {
      isLocationSafe: pos => this.isLocationSafe(pos),
      assignVillagersToResource: (...args) => this.assignVillagersToResource(...args),
    })
    this._exploredAll = false
    this._unexploredScanIndex = 0
  }

  getStorageDropSites(extraBuildings: AIBuildingLike[] = []): AIBuildingLike[] {
    return this.food.getStorageDropSites(extraBuildings)
  }

  getViableBerryBushes(dropSites: AIBuildingLike[] = []): Set<AIEntityLike> {
    return this.food.getViableBerryBushes(dropSites)
  }

  getWorkerSnapshot(villagers: AIEntityLike[]): AIWorkerSnapshot {
    const byWork = (works: string[]) => villagers.filter(v => !v.inactif && works.includes(v.work || ''))
    const inactifVillagers = villagers.filter(v => v.inactif && v.action !== ACTION_TYPES.attack)

    const villagersForaging = byWork([WORK_TYPES.forager])
    const villagersHunting = byWork([WORK_TYPES.hunter])
    const villagersFarming = byWork([WORK_TYPES.farmer])
    const villagersOnFood = [...villagersForaging, ...villagersHunting, ...villagersFarming]
    const villagersOnWood = byWork([WORK_TYPES.woodcutter])
    const villagersOnGold = byWork([WORK_TYPES.goldminer])
    const villagersOnStone = byWork([WORK_TYPES.stoneminer])

    return {
      inactifVillagers,
      villagersForaging,
      villagersHunting,
      villagersFarming,
      villagersOnFood,
      villagersOnWood,
      villagersOnGold,
      villagersOnStone,
    }
  }

  getResourceTargets(villagersCount: number): AIWorkerTargets {
    const { ai } = this
    const demand = ai.strategy.getEconomicDemand()
    const resources = getAIResourceSnapshot(ai)
    // Count cargo already on its way once, separately from stored resources.
    for (const unit of ai.units ?? []) {
      if (unit.isDead || unit.isDestroyed || unit.controlMode === 'hero') continue
      const cargo = (unit as UnitEntity).inventory?.resources ?? {}
      resources.food += (cargo.berry ?? 0) + (cargo.meat ?? 0) + (cargo.wheat ?? 0)
      for (const resource of ['wood', 'stone', 'gold'] as const) resources[resource] += cargo[resource] ?? 0
    }
    const claims = collectiveWorkerClaims(ai.population ?? villagersCount, demand, resources, villagersCount)
    return {
      maxVillagersOnFood: claims.food ?? 0,
      maxVillagersOnWood: claims.wood ?? 0,
      maxVillagersOnGold: claims.gold ?? 0,
      maxVillagersOnStone: claims.stone ?? 0,
    }
  }

  hasUnexploredCells(): boolean {
    if (knowsNativeResources(this.ai)) return false
    if (this._exploredAll) return false
    const { views } = this.ai
    if (!views) return false
    const total = views.length

    if (total === 0) return false

    for (let offset = 0; offset < total; offset++) {
      const index = (this._unexploredScanIndex + offset) % total
      const [i, j] = views.coordinates(index)
      if (!views.isViewed(i, j)) {
        this._unexploredScanIndex = index
        return true
      }
    }

    this._exploredAll = true
    this._unexploredScanIndex = 0
    return false
  }

  // Keep real Scout units exploring — villager exploration is handled demand-driven separately
  updateRealScout(): void {
    const { ai } = this
    ai.scout =
      ai.units.find((u: AIEntityLike) => u.type === UNIT_TYPES.scout && !u.isDead && (u.hitPoints || 0) > 0) || null
    if (ai.scout && ai.scout.inactif && this.hasUnexploredCells()) ai.scout.explore?.()
  }

  // How many villagers should explore based on the gap between known resource nodes and actual need.
  // 1 explorer per 4 units of worker-deficit, capped at 3.
  getExplorationNeed(targets: AIWorkerTargets): number {
    const { ai } = this
    const aliveAnimals = [...ai.foundedAnimals].filter((a: AIEntityLike) => !a.isDead).length

    const deficit =
      Math.max(0, targets.maxVillagersOnWood - ai.foundedTrees.size * 2) +
      Math.max(0, targets.maxVillagersOnFood * 0.6 - (ai.foundedBerrybushs.size * 2 + aliveAnimals * 3)) +
      Math.max(0, targets.maxVillagersOnGold - ai.foundedGolds.size * 3) +
      Math.max(0, targets.maxVillagersOnStone - ai.foundedStones.size * 3)

    return Math.min(3, Math.ceil(deficit / 4))
  }

  sendVillagerExploring(villager: AIEntityLike): boolean {
    villager.work = null
    villager.previousWork = null
    villager.previousDest = null
    return villager.explore?.() ?? false
  }

  assignVillagersToResource(
    availableVillagers: AIEntityLike[],
    villagersOnResource: AIEntityLike[],
    resourceList: Set<AIEntityLike>,
    maxVillagersForResource: number,
    actionCallback: (villager: AIEntityLike, resource: AIEntityLike) => void
  ): number {
    for (let i = maxVillagersForResource; i < villagersOnResource.length; i++) {
      const villager = villagersOnResource[i]
      releaseCollectiveWorker(villager, availableVillagers)
    }
    if (resourceList.size === 0) return 0
    const activeVillagers = Math.min(villagersOnResource.length, maxVillagersForResource)
    const needed = Math.max(0, maxVillagersForResource - activeVillagers)
    const toAssign = Math.min(needed, availableVillagers.length)
    if (toAssign === 0) return 0

    // Track workers per node to spread evenly instead of stacking on the closest
    const nodeLoad = new Map<AIEntityLike, number>()
    for (let i = 0; i < activeVillagers; i++) {
      const v = villagersOnResource[i]
      if (v.dest && 'type' in v.dest && 'label' in v.dest) {
        nodeLoad.set(v.dest, (nodeLoad.get(v.dest) || 0) + 1)
      }
    }

    let assigned = 0
    for (let i = 0; i < toAssign; i++) {
      const villager = availableVillagers.shift() as AIEntityLike
      let best: AIEntityLike | null = null,
        bestScore = Infinity
      for (const resource of resourceList) {
        const dist = Math.abs(villager.i - resource.i) + Math.abs(villager.j - resource.j)
        const score = dist + (nodeLoad.get(resource) || 0) * 8
        // Resolve village/space constraints only for candidates that could win.
        // Preserve the original score, tie order and fresh eligibility check.
        if (score < bestScore && withinVillageActivity(villager as UnitEntity, resource)) {
          bestScore = score
          best = resource
        }
      }
      if (!best) {
        availableVillagers.push(villager)
        continue
      }
      nodeLoad.set(best, (nodeLoad.get(best) || 0) + 1)
      actionCallback(villager, best)
      assigned++
    }
    return assigned
  }

  isLocationSafe(pos: AIEntityLike): boolean {
    const { ai } = this
    const dangerRadius = 15
    for (const b of ai.foundedEnemyBuildings) {
      if (instancesDistance(pos, b) < dangerRadius) return false
    }
    for (const u of ai.foundedEnemyUnits) {
      if (instancesDistance(pos, u) < dangerRadius) return false
    }
    return true
  }

  getFoodDropSites(loadingType: string): AIBuildingLike[] {
    return this.food.getFoodDropSites(loadingType)
  }

  getFoodSourceContext() {
    return this.food.getFoodSourceContext()
  }

  isViableLiveHunt(animal: AIEntityLike, hasKnownBerryFood: boolean, dropSites: AIBuildingLike[] = []): boolean {
    return this.food.isViableLiveHunt(animal, hasKnownBerryFood, dropSites)
  }

  getViableHuntAnimals(hasKnownBerryFood: boolean, dropSites: AIBuildingLike[] = []): AIEntityLike[] {
    return this.food.getViableHuntAnimals(hasKnownBerryFood, dropSites)
  }

  getAvailableStableForCapture(): AIBuildingLike[] {
    return getAvailableStableForCapture(this)
  }

  getAvailableHorseCaptureSlots(): number {
    return getAvailableHorseCaptureSlots(this)
  }

  getCapturableHorses() {
    return getCapturableHorses(this)
  }

  assignHorseCaptures(availableVillagers: AIEntityLike[]): number {
    return assignHorseCaptures(this, availableVillagers)
  }

  getNearestDropDistance(source: AIEntityLike, dropSites: AIBuildingLike[]): number {
    return this.food.getNearestDropDistance(source, dropSites)
  }

  getNearestWorkerDistance(source: AIEntityLike, workers: AIEntityLike[] = []): number {
    return this.food.getNearestWorkerDistance(source, workers)
  }

  getFoodSourceScore(
    type: AIFoodSourceType,
    source: AIEntityLike,
    dropSites: AIBuildingLike[],
    slot: number = 0,
    hunterCount: number = 1,
    workerPositions: AIEntityLike[] = []
  ): number {
    return this.food.getFoodSourceScore(type, source, dropSites, slot, hunterCount, workerPositions)
  }

  getFoodWorkerTargets(
    maxWorkers: number,
    sources: AIFoodSources,
    currentCounts: AIFoodWorkerCounts
  ): AIFoodWorkerCounts {
    return this.food.getFoodWorkerTargets(maxWorkers, sources, currentCounts)
  }

  releaseExcessFoodWorkers(workers: AIEntityLike[], target: number, availableVillagers: AIEntityLike[]): void {
    this.food.releaseExcessFoodWorkers(workers, target, availableVillagers)
  }

  assignHunters(
    availableVillagers: AIEntityLike[],
    villagersHunting: AIEntityLike[],
    maxTotalHunters: number,
    huntAnimals?: AIEntityLike[]
  ): number {
    return this.food.assignHunters(availableVillagers, villagersHunting, maxTotalHunters, huntAnimals)
  }

  discoverDeadAnimals(map: RuntimeMap): void {
    this.food.discoverDeadAnimals(map)
  }

  assignFoodSources(
    availableVillagers: AIEntityLike[],
    workerSnapshot: AIWorkerSnapshot,
    targets: AIWorkerTargets,
    emptyFarms: AIEntityLike[]
  ): number {
    return this.food.assignFoodSources(availableVillagers, workerSnapshot, targets, emptyFarms)
  }

  getBuildersNeeded(buildingType: string): number {
    return getBuildersNeeded(buildingType)
  }

  isValidBuildAssignment(villager: AIEntityLike): boolean {
    return isValidBuildAssignment(villager)
  }

  recoverInvalidBuilder(villager: AIEntityLike): boolean {
    return recoverInvalidBuilder(villager)
  }

  // Builders borrow from their current job — no global cap, per-building limit by type.
  // Returns the Set of villagers sent to build this step (to exclude from resource pool).
  assignBuilders(
    villagers: AIEntityLike[],
    notBuiltBuildings: AIBuildingLike[],
    debug: boolean = false
  ): Set<AIEntityLike> {
    return assignBuilders(this, villagers, notBuiltBuildings, debug)
  }

  handleVillagerActions(_options: AIVillagerActionOptions): number {
    return flushCollectiveVillageWork(this.ai as unknown as PlayerLike)
  }
}
