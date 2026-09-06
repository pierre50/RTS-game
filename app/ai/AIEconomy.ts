import { ACTION_TYPES, UNIT_TYPES, WORK_TYPES } from '../constants'
import { getClosestInstance, instancesDistance, isWheatMature } from '../lib'
import { isVillagerSleepTime } from '../lib/units/villagerSchedule'
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

type GatheringResource = {
  workers: AIEntityLike[]
  set: Set<AIEntityLike>
  max: number
  cb: (villager: AIEntityLike, resource: AIEntityLike) => void
}

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

function getDemandBoost(demand: number, available: number): number {
  const shortage = Math.max(0, demand - available)
  if (shortage <= 0) return 0
  return Math.min(30, Math.max(10, Math.ceil(shortage / 50) * 5))
}

export class AIEconomy {
  ai: AIStrategyPlayerLike
  food: AIEconomyFoodManager
  _exploredAll: boolean
  _unexploredScanIndex: number

  getBuildingAsRuntimeEntity(building: AIBuildingLike): BuildingEntity {
    return building as unknown as BuildingEntity
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
    const base = ai.villageTargetPercentageByAge[ai.age]
    const demandWood = demand.wood || 0
    const demandFood = demand.food || 0
    const demandGold = demand.gold || 0
    const demandStone = demand.stone || 0

    const woodBoost = (resources.wood < 50 ? 15 : 0) + getDemandBoost(demandWood, resources.wood)
    const foodBoost = (resources.food < 50 ? 15 : 0) + getDemandBoost(demandFood, resources.food)
    const goldBoost = getDemandBoost(demandGold, resources.gold)
    const stoneBoost = getDemandBoost(demandStone, resources.stone)
    const shouldProspectGold = ai.foundedGolds.size > 0 || demandGold > 0
    const shouldProspectStone = ai.foundedStones.size > 0 || demandStone > 0

    const weights = {
      food: base.food + foodBoost,
      wood: base.wood + woodBoost,
      // Allow unmet demand to trigger prospecting for undiscovered ore nodes.
      gold: shouldProspectGold ? base.gold + goldBoost : 0,
      stone: shouldProspectStone ? base.stone + stoneBoost : 0,
    }

    const totalWeight = weights.food + weights.wood + weights.gold + weights.stone
    if (totalWeight === 0 || villagersCount === 0) {
      return {
        maxVillagersOnFood: villagersCount,
        maxVillagersOnWood: 0,
        maxVillagersOnGold: 0,
        maxVillagersOnStone: 0,
      }
    }

    // Floor-allocate non-food resources first; food absorbs the remainder so every villager has a slot
    const woodTarget = Math.floor((weights.wood / totalWeight) * villagersCount)
    const goldTarget = Math.floor((weights.gold / totalWeight) * villagersCount)
    const stoneTarget = Math.floor((weights.stone / totalWeight) * villagersCount)
    const foodTarget = villagersCount - woodTarget - goldTarget - stoneTarget

    return {
      maxVillagersOnFood: Math.max(0, foodTarget),
      maxVillagersOnWood: woodTarget,
      maxVillagersOnGold: goldTarget,
      maxVillagersOnStone: stoneTarget,
    }
  }

  hasUnexploredCells(): boolean {
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
      villager.stop?.()
      if (villager !== this.ai.scout && !availableVillagers.includes(villager)) {
        availableVillagers.push(villager)
      }
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
        if (score < bestScore) {
          bestScore = score
          best = resource
        }
      }
      if (!best) continue
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

  handleVillagerActions({
    villagers,
    map,
    farms,
    notBuiltBuildings,
    storagepits,
    towncenters,
    debug = false,
  }: AIVillagerActionOptions): number {
    if (isVillagerSleepTime(this.ai.context)) return 0

    const workerSnapshot = this.getWorkerSnapshot(villagers)
    const targets = this.getResourceTargets(villagers.length)
    const emptyFarms = farms.filter(farm => !farm.isUsedBy && isWheatMature(farm))

    if (debug)
      console.log(
        `Food: ${workerSnapshot.villagersOnFood.length}/${targets.maxVillagersOnFood}, Wood: ${workerSnapshot.villagersOnWood.length}/${targets.maxVillagersOnWood}, Stone: ${workerSnapshot.villagersOnStone.length}/${targets.maxVillagersOnStone}, Gold: ${workerSnapshot.villagersOnGold.length}/${targets.maxVillagersOnGold}`
      )

    this.updateRealScout()
    let actions = 0
    this.discoverDeadAnimals(map)

    const buildingVillagers = this.assignBuilders(villagers, notBuiltBuildings, debug)
    actions += buildingVillagers.size

    // Idle villagers not already sent to build
    const availableVillagers = workerSnapshot.inactifVillagers
      .filter((v: AIEntityLike) => !buildingVillagers.has(v))
      .sort((a: AIEntityLike, b: AIEntityLike) => (b.hitPoints || 0) - (a.hitPoints || 0))

    actions += this.assignHorseCaptures(availableVillagers)

    actions += this.assignFoodSources(availableVillagers, workerSnapshot, targets, emptyFarms)

    // Only mine gold/stone near a storage building — long trips kill efficiency
    const storageBuildings = [...(storagepits || []), ...(towncenters || [])].filter(b => b.isBuilt)
    const MAX_MINING_DIST = 22
    const nearStorage = (node: AIEntityLike) =>
      !storageBuildings.length ||
      storageBuildings.some(s => Math.abs(node.i - s.i) + Math.abs(node.j - s.j) <= MAX_MINING_DIST)

    const viableGolds = new Set([...this.ai.foundedGolds].filter(nearStorage))
    const viableStones = new Set([...this.ai.foundedStones].filter(nearStorage))

    // Assign wood/stone/gold in order of worst coverage ratio (most understaffed first)
    const gatheringResources = [
      {
        workers: workerSnapshot.villagersOnWood,
        set: this.ai.foundedTrees,
        max: targets.maxVillagersOnWood,
        cb: (v: AIEntityLike, r: AIEntityLike) => v.sendToTree?.(r),
      },
      {
        workers: workerSnapshot.villagersOnStone,
        set: viableStones,
        max: targets.maxVillagersOnStone,
        cb: (v: AIEntityLike, r: AIEntityLike) => v.sendToStone?.(r),
      },
      {
        workers: workerSnapshot.villagersOnGold,
        set: viableGolds,
        max: targets.maxVillagersOnGold,
        cb: (v: AIEntityLike, r: AIEntityLike) => v.sendToGold?.(r),
      },
    ] satisfies GatheringResource[]

    gatheringResources.sort((a, b) => {
      const ra = a.max > 0 ? a.workers.length / a.max : 1
      const rb = b.max > 0 ? b.workers.length / b.max : 1
      return ra - rb
    })

    for (const { workers, set, max, cb } of gatheringResources) {
      actions += this.assignVillagersToResource(availableVillagers, workers, set, max, cb)
    }

    // Demand-driven exploration: send idle villagers proportional to resource node deficit
    if (availableVillagers.length > 0 && this.hasUnexploredCells()) {
      const need = this.getExplorationNeed(targets)
      if (need > 0) {
        // Take from the end (lowest HP — least critical for defence)
        const count = Math.min(need, availableVillagers.length)
        const explorers = availableVillagers.splice(availableVillagers.length - count, count)
        for (const v of explorers) {
          if (this.sendVillagerExploring(v)) actions++
        }
      }
    }

    // Any remaining idle villager goes to wood (quota was already met, this is overflow)
    if (availableVillagers.length > 0 && this.ai.foundedTrees.size > 0) {
      for (const villager of [...availableVillagers]) {
        const tree = getClosestInstance(villager, this.ai.foundedTrees) || null
        if (tree) {
          villager.sendToTree?.(tree)
          actions++
        }
      }
    }

    return actions
  }
}
