import { ACTION_TYPES, BUILDING_TYPES, UNIT_TYPES, WORK_TYPES } from '../constants'
import { getClosestInstance, getGaiaAnimals, isWheatMature } from '../lib'
import type { RuntimeMap } from '../types/map'
import type {
  AIBuildingLike,
  AIEntityLike,
  AIFoodSources,
  AIFoodSourceType,
  AIFoodWorkerCounts,
  AIStrategyPlayerLike,
  AIWorkerSnapshot,
  AIWorkerTargets,
} from './types'

type FoodOpportunity = {
  type: AIFoodSourceType
  score: number
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

export class AIEconomyFoodManager {
  ai: AIStrategyPlayerLike
  private isLocationSafe: (pos: AIEntityLike) => boolean
  private assignVillagersToResource: (
    availableVillagers: AIEntityLike[],
    villagersOnResource: AIEntityLike[],
    resourceList: Set<AIEntityLike>,
    maxVillagersForResource: number,
    actionCallback: (villager: AIEntityLike, resource: AIEntityLike) => void
  ) => number

  constructor(
    ai: AIStrategyPlayerLike,
    helpers: {
      isLocationSafe: (pos: AIEntityLike) => boolean
      assignVillagersToResource: AIEconomyFoodManager['assignVillagersToResource']
    }
  ) {
    this.ai = ai
    this.isLocationSafe = helpers.isLocationSafe
    this.assignVillagersToResource = helpers.assignVillagersToResource
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

  assignHunters(
    availableVillagers: AIEntityLike[],
    villagersHunting: AIEntityLike[],
    maxTotalHunters: number,
    huntAnimals?: AIEntityLike[]
  ): number {
    const safeAnimals = huntAnimals || this.getViableHuntAnimals(false)
    if (!safeAnimals.length) return 0

    const huntersByAnimal = new Map<AIEntityLike, number>()
    for (const v of villagersHunting) {
      if (v.dest && 'isDead' in v.dest && !v.dest.isDead) {
        huntersByAnimal.set(v.dest, (huntersByAnimal.get(v.dest) || 0) + 1)
      }
    }

    const largeHp = 20
    const hunterDamagePerThrow = 4

    let actions = 0
    let totalHunters = villagersHunting.length

    const large = safeAnimals
      .filter((a: AIEntityLike) => (a.totalHitPoints || 0) >= largeHp)
      .sort((a, b) => (huntersByAnimal.get(b) || 0) - (huntersByAnimal.get(a) || 0))

    for (const animal of large) {
      if (totalHunters >= maxTotalHunters || availableVillagers.length === 0) break
      const current = huntersByAnimal.get(animal) || 0
      const maxAssignable = Math.min(maxTotalHunters - totalHunters, availableVillagers.length)
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

    const small = safeAnimals.filter((a: AIEntityLike) => (a.totalHitPoints || 0) < largeHp)
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
}
