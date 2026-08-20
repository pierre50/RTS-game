import { ACTION_TYPES, BUILDING_TYPES, FAMILY_TYPES, UNIT_TYPES, WORK_TYPES } from '../constants'
import { getClosestInstance, getGaiaAnimals, instancesDistance, isWheatMature } from '../lib'
import { canStoreStableHorse, getStableHorseAmount, STABLE_HORSE_CAPACITY } from '../lib/stableHorses'
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

type FoodOpportunity = {
  type: AIFoodSourceType
  score: number
}
type GatheringResource = {
  workers: AIEntityLike[]
  set: Set<AIEntityLike>
  max: number
  cb: (villager: AIEntityLike, resource: AIEntityLike) => void
}
type FoodSourceContext = {
  meatDropSites: AIBuildingLike[]
  plantDropSites: AIBuildingLike[]
  viableBerryBushes: Set<AIEntityLike>
  hasKnownBerryFood: boolean
}

const MAX_BERRY_DROP_DIST = 14
const MAX_BERRY_HOME_DIST = 30
const MAX_HUNT_DROP_DIST_WHEN_BERRIES_KNOWN = 32

export class AIEconomy {
  ai: AIStrategyPlayerLike
  _exploredAll: boolean
  _unexploredScanIndex: number

  getBuildingAsRuntimeEntity(building: AIBuildingLike): BuildingEntity {
    return building as unknown as BuildingEntity
  }

  constructor(ai: AIStrategyPlayerLike) {
    this.ai = ai
    this._exploredAll = false
    this._unexploredScanIndex = 0
  }

  getStorageDropSites(extraBuildings: AIBuildingLike[] = []): AIBuildingLike[] {
    const { ai } = this
    return [...ai.buildingsByTypes([BUILDING_TYPES.townCenter, BUILDING_TYPES.granary]), ...extraBuildings].filter(
      building => building && building.isBuilt && !building.isDead && !building.isDestroyed
    )
  }

  getViableBerryBushes(dropSites: AIBuildingLike[] = []): Set<AIEntityLike> {
    const { ai } = this
    const effectiveDropSites = dropSites.length > 0 ? dropSites : this.getStorageDropSites()
    const homeAnchor = ai.getHomeAnchor()

    return new Set(
      [...ai.foundedBerrybushs].filter((bush: AIEntityLike) => {
        if (!bush || bush.isDead || (bush.quantity || 0) <= 0 || !this.isLocationSafe(bush)) return false

        const nearDropSite =
          effectiveDropSites.length === 0 ||
          effectiveDropSites.some(site => Math.abs(bush.i - site.i) + Math.abs(bush.j - site.j) <= MAX_BERRY_DROP_DIST)
        if (!nearDropSite) return false

        if (!homeAnchor) return true
        return Math.abs(bush.i - homeAnchor.i) + Math.abs(bush.j - homeAnchor.j) <= MAX_BERRY_HOME_DIST
      })
    )
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
    const base = ai.villageTargetPercentageByAge[ai.age]
    const demandWood = demand.wood || 0
    const demandFood = demand.food || 0
    const demandGold = demand.gold || 0
    const demandStone = demand.stone || 0

    const woodBoost = (ai.wood < 50 ? 15 : 0) + (demandWood > 0 ? 10 : 0)
    const foodBoost = (ai.food < 50 ? 15 : 0) + (demandFood > 0 ? 10 : 0)
    const shouldProspectGold = ai.foundedGolds.size > 0 || demandGold > 0
    const shouldProspectStone = ai.foundedStones.size > 0 || demandStone > 0

    const weights = {
      food: base.food + foodBoost,
      wood: base.wood + woodBoost,
      // Allow unmet demand to trigger prospecting for undiscovered ore nodes.
      gold: shouldProspectGold ? base.gold + (demandGold > 0 ? 10 : 0) : 0,
      stone: shouldProspectStone ? base.stone + (demandStone > 0 ? 10 : 0) : 0,
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
    const { ai } = this
    const types =
      loadingType === 'berry' || loadingType === 'wheat' || loadingType === 'meat'
        ? [BUILDING_TYPES.townCenter, BUILDING_TYPES.granary]
        : [BUILDING_TYPES.townCenter, BUILDING_TYPES.storagePit]
    return ai
      .buildingsByTypes(types)
      .filter((building: AIBuildingLike) => building && building.isBuilt && !building.isDead && !building.isDestroyed)
  }

  getFoodSourceContext(): FoodSourceContext {
    const berryDropSites = this.getStorageDropSites()
    const meatDropSites = this.getFoodDropSites('meat')
    const plantDropSites = this.getFoodDropSites('berry')
    const viableBerryBushes = this.getViableBerryBushes(berryDropSites)

    return {
      meatDropSites,
      plantDropSites,
      viableBerryBushes,
      hasKnownBerryFood: viableBerryBushes.size > 0,
    }
  }

  isViableLiveHunt(animal: AIEntityLike, hasKnownBerryFood: boolean, dropSites: AIBuildingLike[] = []): boolean {
    if (!animal || animal.isDead || !this.isLocationSafe(animal)) return false
    if (!hasKnownBerryFood) return true

    const anchors = dropSites.length > 0 ? dropSites : this.ai.getHomeAnchor() ? [this.ai.getHomeAnchor()!] : []
    if (!anchors.length) return true
    return anchors.some(
      anchor => Math.abs(animal.i - anchor.i) + Math.abs(animal.j - anchor.j) <= MAX_HUNT_DROP_DIST_WHEN_BERRIES_KNOWN
    )
  }

  getViableHuntAnimals(hasKnownBerryFood: boolean, dropSites: AIBuildingLike[] = []): AIEntityLike[] {
    return [...this.ai.foundedAnimals].filter((animal: AIEntityLike) =>
      animal.type !== 'Horse' && this.isViableLiveHunt(animal, hasKnownBerryFood, dropSites)
    )
  }

  getAvailableStableForCapture(): AIBuildingLike[] {
    return this.ai
      .buildingsByTypes([BUILDING_TYPES.stable])
      .filter(
        (building: AIBuildingLike) =>
          building.isBuilt &&
          !building.isDead &&
          !building.isDestroyed &&
          canStoreStableHorse(this.getBuildingAsRuntimeEntity(building))
      )
  }

  getAvailableHorseCaptureSlots(): number {
    return this.getAvailableStableForCapture().reduce(
      (sum, stable) =>
        sum + Math.max(0, STABLE_HORSE_CAPACITY - getStableHorseAmount(this.getBuildingAsRuntimeEntity(stable))),
      0
    )
  }

  getCapturableHorses() {
    return [...this.ai.foundedAnimals]
      .filter((animal: AIEntityLike) => animal.type === 'Horse' && !animal.isDead && !animal.isDestroyed)
      .filter((animal: AIEntityLike) => this.isLocationSafe(animal))
      .filter(animal => !(animal as { isLassoed?: boolean }).isLassoed)
  }

  assignHorseCaptures(availableVillagers: AIEntityLike[]): number {
    const stables = this.getAvailableStableForCapture()
    if (!stables.length || !availableVillagers.length) return 0

    const horses = this.getCapturableHorses()
    if (!horses.length) return 0

    const safeSlots = this.getAvailableHorseCaptureSlots()
    if (!safeSlots) return 0

    let actions = 0
    const reserved: Map<AIBuildingLike, number> = new Map()
    const reservedForHorse = new Set<AIEntityLike>()

    const findNearestStable = (horse: AIEntityLike) => {
      let selected: AIBuildingLike | null = null
      let best = Infinity
      for (const stable of stables) {
        const used = reserved.get(stable) || 0
        if (getStableHorseAmount(this.getBuildingAsRuntimeEntity(stable)) + used >= STABLE_HORSE_CAPACITY) continue
        const distance = Math.abs(stable.i - horse.i) + Math.abs(stable.j - horse.j)
        if (distance < best) {
          selected = stable
          best = distance
        }
      }
      return selected
    }

    for (let i = 0; i < safeSlots && availableVillagers.length; i++) {
      const villager = availableVillagers.shift()
      if (!villager) break
      const availableHorses = horses.filter(horse => !reservedForHorse.has(horse))
      if (!availableHorses.length) {
        availableVillagers.unshift(villager)
        break
      }
      const horse = getClosestInstance(villager, availableHorses)
      if (!horse) {
        availableVillagers.unshift(villager)
        break
      }
      const stable = findNearestStable(horse)
      if (!stable) {
        availableVillagers.unshift(villager)
        break
      }
      const captureResult = villager.sendToCaptureHorse?.(horse)
      if (captureResult === false || !villager.sendToCaptureHorse) {
        reservedForHorse.add(horse)
        availableVillagers.unshift(villager)
        continue
      }
      reserved.set(stable, (reserved.get(stable) || 0) + 1)
      reservedForHorse.add(horse)
      actions++
    }
    return actions
  }

  getNearestDropDistance(source: AIEntityLike, dropSites: AIBuildingLike[]): number {
    if (!source || !dropSites.length) return 0
    return Math.min(...dropSites.map(site => Math.abs(source.i - site.i) + Math.abs(source.j - site.j)))
  }

  getNearestWorkerDistance(source: AIEntityLike, workers: AIEntityLike[] = []): number {
    if (!source || !workers.length) return 0
    return Math.min(...workers.map(worker => Math.abs(source.i - worker.i) + Math.abs(source.j - worker.j)))
  }

  getFoodSourceScore(
    type: AIFoodSourceType,
    source: AIEntityLike,
    dropSites: AIBuildingLike[],
    slot: number = 0,
    hunterCount: number = 1,
    workerPositions: AIEntityLike[] = []
  ): number {
    const rates = (this.ai.config?.units?.[UNIT_TYPES.villager]?.gatheringRate || {}) as Record<
      string,
      number | undefined
    >
    const workByType: Record<AIFoodSourceType, string> = {
      berry: WORK_TYPES.forager,
      carcass: WORK_TYPES.hunter,
      farm: WORK_TYPES.farmer,
      hunt: WORK_TYPES.hunter,
    }
    const fallbackRates: Record<AIFoodSourceType, number> = {
      berry: 0.45,
      carcass: 0.4725,
      farm: 0.45,
      hunt: 0.4725,
    }
    const rate = Number(rates[workByType[type]] || fallbackRates[type])
    const quantity = Math.max(0, source.quantity ?? source.totalQuantity ?? 0)
    const quantityFactor = 0.55 + Math.min(quantity / 150, 1) * 0.45
    const distance = this.getNearestDropDistance(source, dropSites)
    const workerDistance = this.getNearestWorkerDistance(source, workerPositions)
    const travelPenalty = 1 + distance / (type === 'farm' ? 20 : 14)
    const workerTravelPenalty = 1 + workerDistance / (type === 'hunt' ? 12 : 18)
    const saturationPenalty = 1 + slot * (type === 'berry' || type === 'carcass' ? 0.25 : 0.12)
    const killPenalty = type === 'hunt' ? 1 + (source.hitPoints || 0) / Math.max(4 * hunterCount, 1) / 12 : 1
    const renewableBonus = type === 'farm' ? 1.08 : 1
    return (
      (rate * quantityFactor * renewableBonus) / (travelPenalty * workerTravelPenalty * saturationPenalty * killPenalty)
    )
  }

  getFoodWorkerTargets(
    maxWorkers: number,
    sources: AIFoodSources,
    currentCounts: AIFoodWorkerCounts
  ): AIFoodWorkerCounts {
    const opportunities: FoodOpportunity[] = []
    const retainedSlots: AIFoodWorkerCounts = { ...currentCounts }
    const addSlots = (
      type: AIFoodSourceType,
      source: AIEntityLike,
      count: number,
      dropSites: AIBuildingLike[],
      hunterCount: number = 1
    ) => {
      for (let slot = 0; slot < count; slot++) {
        const retentionBonus = retainedSlots[type] > 0 && type !== 'hunt' ? 1.08 : 1
        retainedSlots[type] = Math.max(0, (retainedSlots[type] || 0) - 1)
        opportunities.push({
          type,
          score:
            this.getFoodSourceScore(type, source, dropSites, slot, hunterCount, sources.workerPositions) *
            retentionBonus,
        })
      }
    }

    for (const carcass of sources.carcasses) {
      addSlots('carcass', carcass, Math.min(3, Math.max(1, Math.ceil((carcass.quantity || 0) / 75))), sources.meatDrops)
    }
    for (const bush of sources.berries) addSlots('berry', bush, 2, sources.plantDrops)
    for (const farm of sources.farms) addSlots('farm', farm, 1, sources.plantDrops)
    for (const animal of sources.animals) {
      const hunters =
        (animal.totalHitPoints || 0) >= 20 ? Math.min(4, Math.max(1, Math.ceil((animal.hitPoints || 0) / 4))) : 1
      addSlots('hunt', animal, hunters, sources.meatDrops, hunters)
    }

    opportunities.sort((a, b) => b.score - a.score)
    const targets: AIFoodWorkerCounts = { berry: 0, carcass: 0, farm: 0, hunt: 0 }
    for (const opportunity of opportunities.slice(0, maxWorkers)) targets[opportunity.type]++
    return targets
  }

  releaseExcessFoodWorkers(workers: AIEntityLike[], target: number, availableVillagers: AIEntityLike[]): void {
    let excess = Math.max(0, workers.length - target)
    if (!excess) return
    const releasable = workers
      .filter(villager => !villager.loading && villager.action !== ACTION_TYPES.delivery)
      .sort((a, b) => {
        const aDistance = a.dest ? Math.abs(a.i - a.dest.i) + Math.abs(a.j - a.dest.j) : 0
        const bDistance = b.dest ? Math.abs(b.i - b.dest.i) + Math.abs(b.j - b.dest.j) : 0
        return bDistance - aDistance
      })
    for (const villager of releasable) {
      if (excess <= 0) break
      villager.stop?.()
      if (!availableVillagers.includes(villager)) availableVillagers.push(villager)
      excess--
    }
  }

    // Group-aware hunting: large animals need several hunters on the same target.
    // Small animals get 1 hunter each. Returns count of new hunters assigned.
    assignHunters(
      availableVillagers: AIEntityLike[],
      villagersHunting: AIEntityLike[],
      maxTotalHunters: number,
      huntAnimals?: AIEntityLike[]
    ): number {
    const safeAnimals = huntAnimals || this.getViableHuntAnimals(false)
    if (!safeAnimals.length) return 0

    // Count hunters already chasing each animal
    const huntersByAnimal = new Map<AIEntityLike, number>()
    for (const v of villagersHunting) {
      if (v.dest && 'isDead' in v.dest && !v.dest.isDead) {
        huntersByAnimal.set(v.dest, (huntersByAnimal.get(v.dest) || 0) + 1)
      }
    }

    const LARGE_HP = 20 // threshold for group hunt
    const hunterDamagePerThrow = 4

    let actions = 0
    let totalHunters = villagersHunting.length // includes already-hunting villagers

    // Large animals: send a pack — enough hunters to kill before losing too many villagers
    // Prefer animals already being hunted (finish them first) to not waste effort
    const large = safeAnimals
      .filter((a: AIEntityLike) => (a.totalHitPoints || 0) >= LARGE_HP)
      .sort((a, b) => (huntersByAnimal.get(b) || 0) - (huntersByAnimal.get(a) || 0))

    for (const animal of large) {
      if (totalHunters >= maxTotalHunters || availableVillagers.length === 0) break
      const current = huntersByAnimal.get(animal) || 0
      const maxAssignable = Math.min(maxTotalHunters - totalHunters, availableVillagers.length)

      // How many hunters needed to kill this animal within ~3 attack rounds
      const needed = Math.max(0, Math.ceil((animal.hitPoints || 0) / hunterDamagePerThrow) - current)
      if (needed === 0) continue
      const toSend = Math.min(needed, maxAssignable)
      for (let i = 0; i < toSend; i++) {
        availableVillagers.shift()?.sendToHunt?.(animal)
        huntersByAnimal.set(animal, (huntersByAnimal.get(animal) || 0) + 1)
        totalHunters++
        actions++
      }
    }

    // Small animals: 1 hunter per animal, first-come first-served
    const small = safeAnimals.filter((a: AIEntityLike) => (a.totalHitPoints || 0) < LARGE_HP)
    for (const animal of small) {
      if (totalHunters >= maxTotalHunters || availableVillagers.length === 0) break
      if ((huntersByAnimal.get(animal) || 0) > 0) continue
      availableVillagers.shift()?.sendToHunt?.(animal)
      totalHunters++
      actions++
    }

    return actions
  }

  discoverDeadAnimals(map: RuntimeMap): void {
    const { ai } = this
    for (const animal of getGaiaAnimals(map.gaia)) {
      if (animal.isDead && !animal.isDestroyed && (animal.quantity || 0) > 0) {
        if (ai.views?.isVisible(animal.i, animal.j)) ai.foundedDeadAnimals.add(animal)
      }
    }
  }

  assignFoodSources(
    availableVillagers: AIEntityLike[],
    workerSnapshot: AIWorkerSnapshot,
    targets: AIWorkerTargets,
    emptyFarms: AIEntityLike[]
  ): number {
    const { ai } = this
    const { villagersForaging = [], villagersHunting = [], villagersFarming = [] } = workerSnapshot
    const { maxVillagersOnFood } = targets
    let actions = 0
    const foodContext = this.getFoodSourceContext()
    const carcassHunters = villagersHunting.filter(
      (villager: AIEntityLike) =>
        villager.action === ACTION_TYPES.takemeat || (villager.dest as AIEntityLike | undefined)?.isDead
    )
    const liveHunters = villagersHunting.filter(
      (villager: AIEntityLike) =>
        villager.action === ACTION_TYPES.hunt && villager.dest && !(villager.dest as AIEntityLike).isDead
    )
    const farmCandidates = new Set([
      ...emptyFarms.filter(farm => !farm.isDead && (farm.quantity || 0) > 0 && isWheatMature(farm)),
      ...villagersFarming
        .map((villager: AIEntityLike) => villager.dest)
        .filter(
          (farm): farm is AIEntityLike =>
            !!farm && 'isDead' in farm && !farm.isDead && (Number(farm.quantity) || 0) > 0 && isWheatMature(farm)
        ),
    ])
    const sources = {
      animals: this.getViableHuntAnimals(foodContext.hasKnownBerryFood, foodContext.meatDropSites),
      berries: [...foodContext.viableBerryBushes],
      carcasses: [...ai.foundedDeadAnimals].filter(
        (animal: AIEntityLike) => !animal.isDestroyed && (animal.quantity || 0) > 0 && this.isLocationSafe(animal)
      ),
      farms: [...farmCandidates],
      meatDrops: foodContext.meatDropSites,
      plantDrops: foodContext.plantDropSites,
      workerPositions: [...availableVillagers, ...villagersForaging, ...villagersHunting, ...villagersFarming],
    }
    const sourceTargets = this.getFoodWorkerTargets(maxVillagersOnFood, sources, {
      berry: villagersForaging.length,
      carcass: carcassHunters.length,
      farm: villagersFarming.length,
      hunt: liveHunters.length,
    })

    this.releaseExcessFoodWorkers(villagersForaging, sourceTargets.berry, availableVillagers)
    this.releaseExcessFoodWorkers(carcassHunters, sourceTargets.carcass, availableVillagers)
    this.releaseExcessFoodWorkers(liveHunters, sourceTargets.hunt, availableVillagers)
    this.releaseExcessFoodWorkers(villagersFarming, sourceTargets.farm, availableVillagers)

    const activeForagers = villagersForaging.filter((villager: AIEntityLike) => !villager.inactif)
    const activeCarcassHunters = carcassHunters.filter((villager: AIEntityLike) => !villager.inactif)
    const activeLiveHunters = liveHunters.filter((villager: AIEntityLike) => !villager.inactif)
    const activeFarmers = villagersFarming.filter((villager: AIEntityLike) => !villager.inactif)

    if (sources.carcasses.length > 0) {
      const toAssign = Math.min(
        Math.max(0, sourceTargets.carcass - activeCarcassHunters.length),
        availableVillagers.length
      )
      for (let i = 0; i < toAssign; i++) {
        const animal = getClosestInstance(availableVillagers[0], sources.carcasses) || null
        if (!animal) break
        availableVillagers.shift()?.sendToTakeMeat?.(animal)
        actions++
      }
    }

    actions += this.assignVillagersToResource(
      availableVillagers,
      activeForagers,
      foodContext.viableBerryBushes,
      sourceTargets.berry,
      (villager, bush) => villager.sendToBerrybush?.(bush)
    )

    actions += this.assignHunters(availableVillagers, activeLiveHunters, sourceTargets.hunt, sources.animals)

    const availableFarms = emptyFarms
      .filter(farm => !farm.isDead && (farm.quantity || 0) > 0 && !farm.isUsedBy && isWheatMature(farm))
      .sort((a, b) => {
        const worker = availableVillagers[0]
        if (!worker) return 0
        return (
          Math.abs(worker.i - a.i) + Math.abs(worker.j - a.j) - (Math.abs(worker.i - b.i) + Math.abs(worker.j - b.j))
        )
      })
    const farmsToAssign = Math.min(
      Math.max(0, sourceTargets.farm - activeFarmers.length),
      availableFarms.length,
      availableVillagers.length
    )
    for (let i = 0; i < farmsToAssign; i++) {
      availableVillagers.shift()?.sendToFarm?.(availableFarms[i])
      actions++
    }

    return actions
  }

  getBuildersNeeded(buildingType: string): number {
    switch (buildingType) {
      case BUILDING_TYPES.barracks:
      case BUILDING_TYPES.archeryRange:
      case BUILDING_TYPES.stable:
      case BUILDING_TYPES.townCenter:
        return 2
      default:
        return 1
    }
  }

  isValidBuildAssignment(villager: AIEntityLike): boolean {
    return (
      villager &&
      !villager.isDead &&
      villager.action === ACTION_TYPES.build &&
      villager.work === WORK_TYPES.builder &&
      (villager.dest as AIEntityLike | undefined)?.family === FAMILY_TYPES.building &&
      (villager.getActionCondition?.(villager.dest as AIEntityLike, ACTION_TYPES.build) ?? false)
    )
  }

  recoverInvalidBuilder(villager: AIEntityLike): boolean {
    if (!villager || villager.isDead || this.isValidBuildAssignment(villager)) return false
    if (villager.work !== WORK_TYPES.builder && villager.action !== ACTION_TYPES.build) return false

    if (villager.previousDest || villager.previousWork) {
      villager.goBackToPrevious?.()
    } else {
      villager.stop?.()
      villager.work = null
    }
    return true
  }

  // Builders borrow from their current job — no global cap, per-building limit by type.
  // Returns the Set of villagers sent to build this step (to exclude from resource pool).
  assignBuilders(
    villagers: AIEntityLike[],
    notBuiltBuildings: AIBuildingLike[],
    debug: boolean = false
  ): Set<AIEntityLike> {
    const assigned = new Set<AIEntityLike>()
    if (!notBuiltBuildings.length) return assigned

    // Count who is already actively building each site
    const buildingLoad = new Map<string, number>()
    for (const v of villagers) {
      if (this.isValidBuildAssignment(v)) {
        const label = v.dest && 'label' in v.dest && typeof v.dest.label === 'string' ? v.dest.label : null
        if (label) {
          buildingLoad.set(label, (buildingLoad.get(label) || 0) + 1)
        }
        assigned.add(v)
      } else {
        this.recoverInvalidBuilder(v)
      }
    }

    // Buildings with fewest builders get priority
    const prioritized = [...notBuiltBuildings].sort(
      (a, b) => (buildingLoad.get(a.label || '') || 0) - (buildingLoad.get(b.label || '') || 0)
    )

    for (const building of prioritized) {
      if (this.ai.isBuildingThreatened?.(building)) continue
      const needed = this.getBuildersNeeded(building.type) - (buildingLoad.get(building.label || '') || 0)
      if (needed <= 0) continue

      // Prefer idle villagers (−30 distance bonus); fall back to active gatherers if needed
      const candidates = villagers
        .filter(v => !assigned.has(v) && v !== this.ai.scout && (v.hitPoints || 0) > (v.totalHitPoints || 0) * 0.3)
        .sort((a, b) => {
          const da = Math.abs(a.i - building.i) + Math.abs(a.j - building.j) + (a.inactif ? -30 : 0)
          const db = Math.abs(b.i - building.i) + Math.abs(b.j - building.j) + (b.inactif ? -30 : 0)
          return da - db
        })

      for (let i = 0; i < Math.min(needed, candidates.length); i++) {
        const v = candidates[i]
        v.sendToBuilding?.(building)
        assigned.add(v)
        if (building.label) buildingLoad.set(building.label, (buildingLoad.get(building.label) || 0) + 1)
        if (debug) console.log('Villager sent to build:', building.type)
      }
    }

    return assigned
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
