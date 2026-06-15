import { ACTION_TYPES, BUILDING_TYPES, FAMILY_TYPES, UNIT_TYPES, WORK_TYPES } from '../constants'
import { getClosestInstance, instancesDistance } from '../lib'

export class AIEconomy {
  constructor(ai) {
    this.ai = ai
    this._exploredAll = false
    this._unexploredScanIndex = 0
  }

  getStorageDropSites(extraBuildings = []) {
    const { ai } = this
    return [...ai.buildingsByTypes([BUILDING_TYPES.townCenter, BUILDING_TYPES.granary]), ...extraBuildings].filter(
      building => building && building.isBuilt && !building.isDead && !building.isDestroyed
    )
  }

  getViableBerryBushes(dropSites = []) {
    const { ai } = this
    const effectiveDropSites = dropSites.length > 0 ? dropSites : this.getStorageDropSites()
    const homeAnchor = ai.getHomeAnchor()
    const MAX_BERRY_DROP_DIST = 14
    const MAX_BERRY_HOME_DIST = 30

    return new Set(
      [...ai.foundedBerrybushs].filter(bush => {
        if (!bush || bush.isDead || bush.quantity <= 0 || !this.isLocationSafe(bush)) return false

        const nearDropSite =
          effectiveDropSites.length === 0 ||
          effectiveDropSites.some(site => Math.abs(bush.i - site.i) + Math.abs(bush.j - site.j) <= MAX_BERRY_DROP_DIST)
        if (!nearDropSite) return false

        if (!homeAnchor) return true
        return Math.abs(bush.i - homeAnchor.i) + Math.abs(bush.j - homeAnchor.j) <= MAX_BERRY_HOME_DIST
      })
    )
  }

  getWorkerSnapshot(villagers) {
    const byWork = works => villagers.filter(v => !v.inactif && works.includes(v.work))
    const inactifVillagers = villagers.filter(v => v.inactif && v.action !== ACTION_TYPES.attack)

    const villagersForaging = byWork([WORK_TYPES.forager])
    const villagersHunting = byWork([WORK_TYPES.hunter])
    const villagersFarming = byWork([WORK_TYPES.farmer])
    const villagersFishing = byWork([WORK_TYPES.fisher])
    const villagersOnFood = [...villagersForaging, ...villagersHunting, ...villagersFarming, ...villagersFishing]
    const villagersOnWood = byWork([WORK_TYPES.woodcutter])
    const villagersOnGold = byWork([WORK_TYPES.goldminer])
    const villagersOnStone = byWork([WORK_TYPES.stoneminer])

    return {
      inactifVillagers,
      villagersForaging,
      villagersHunting,
      villagersFarming,
      villagersFishing,
      villagersOnFood,
      villagersOnWood,
      villagersOnGold,
      villagersOnStone,
    }
  }

  getResourceTargets(villagersCount) {
    const { ai } = this
    const demand = ai.strategy.getEconomicDemand()
    const base = ai.villageTargetPercentageByAge[ai.age]

    const woodBoost = (ai.wood < 50 ? 15 : 0) + (demand.wood > 0 ? 10 : 0)
    const foodBoost = (ai.food < 50 ? 15 : 0) + (demand.food > 0 ? 10 : 0)
    const shouldProspectGold = ai.foundedGolds.size > 0 || demand.gold > 0
    const shouldProspectStone = ai.foundedStones.size > 0 || demand.stone > 0

    const weights = {
      food: base.food + foodBoost,
      wood: base.wood + woodBoost,
      // Allow unmet demand to trigger prospecting for undiscovered ore nodes.
      gold: shouldProspectGold ? base.gold + (demand.gold > 0 ? 10 : 0) : 0,
      stone: shouldProspectStone ? base.stone + (demand.stone > 0 ? 10 : 0) : 0,
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

  hasUnexploredCells() {
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
  updateRealScout() {
    const { ai } = this
    ai.scout = ai.units.find(u => u.type === UNIT_TYPES.scout && !u.isDead && u.hitPoints > 0) || null
    if (ai.scout && ai.scout.inactif && this.hasUnexploredCells()) ai.scout.explore()
  }

  // How many villagers should explore based on the gap between known resource nodes and actual need.
  // 1 explorer per 4 units of worker-deficit, capped at 3.
  getExplorationNeed(targets) {
    const { ai } = this
    const aliveAnimals = [...ai.foundedAnimals].filter(a => !a.isDead).length

    const deficit =
      Math.max(0, targets.maxVillagersOnWood - ai.foundedTrees.size * 2) +
      Math.max(
        0,
        targets.maxVillagersOnFood * 0.6 - (ai.foundedBerrybushs.size * 2 + aliveAnimals * 3 + ai.foundedFish.size * 2)
      ) +
      Math.max(0, targets.maxVillagersOnGold - ai.foundedGolds.size * 3) +
      Math.max(0, targets.maxVillagersOnStone - ai.foundedStones.size * 3)

    return Math.min(3, Math.ceil(deficit / 4))
  }

  sendVillagerExploring(villager) {
    villager.work = null
    villager.previousWork = null
    villager.previousDest = null
    return villager.explore()
  }

  assignVillagersToResource(
    availableVillagers,
    villagersOnResource,
    resourceList,
    maxVillagersForResource,
    actionCallback
  ) {
    for (let i = maxVillagersForResource; i < villagersOnResource.length; i++) {
      const villager = villagersOnResource[i]
      villager.stop()
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
    const nodeLoad = new Map()
    for (let i = 0; i < activeVillagers; i++) {
      const v = villagersOnResource[i]
      if (v.dest) nodeLoad.set(v.dest, (nodeLoad.get(v.dest) || 0) + 1)
    }

    let assigned = 0
    for (let i = 0; i < toAssign; i++) {
      const villager = availableVillagers.shift()
      let best = null,
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

  isLocationSafe(pos) {
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

  getFoodDropSites(loadingType) {
    const { ai } = this
    const types =
      loadingType === 'berry' || loadingType === 'wheat'
        ? [BUILDING_TYPES.townCenter, BUILDING_TYPES.granary]
        : [BUILDING_TYPES.townCenter, BUILDING_TYPES.storagePit]
    return ai
      .buildingsByTypes(types)
      .filter(building => building && building.isBuilt && !building.isDead && !building.isDestroyed)
  }

  getNearestDropDistance(source, dropSites) {
    if (!source || !dropSites.length) return 0
    return Math.min(...dropSites.map(site => Math.abs(source.i - site.i) + Math.abs(source.j - site.j)))
  }

  getFoodSourceScore(type, source, dropSites, slot = 0, hunterCount = 1) {
    const rates = this.ai.config?.units?.[UNIT_TYPES.villager]?.gatheringRate || {}
    const workByType = {
      berry: WORK_TYPES.forager,
      carcass: WORK_TYPES.hunter,
      fish: WORK_TYPES.fisher,
      farm: WORK_TYPES.farmer,
      hunt: WORK_TYPES.hunter,
    }
    const fallbackRates = { berry: 0.45, carcass: 0.4725, fish: 0.6, farm: 0.45, hunt: 0.4725 }
    const rate = rates[workByType[type]] || fallbackRates[type]
    const quantity = Math.max(0, source.quantity ?? source.totalQuantity ?? 0)
    const quantityFactor = 0.55 + Math.min(quantity / 150, 1) * 0.45
    const distance = this.getNearestDropDistance(source, dropSites)
    const travelPenalty = 1 + distance / (type === 'farm' ? 20 : 14)
    const saturationPenalty = 1 + slot * (type === 'berry' || type === 'carcass' ? 0.25 : 0.12)
    const killPenalty = type === 'hunt' ? 1 + (source.hitPoints || 0) / Math.max(4 * hunterCount, 1) / 12 : 1
    const renewableBonus = type === 'farm' ? 1.08 : 1
    return (rate * quantityFactor * renewableBonus) / (travelPenalty * saturationPenalty * killPenalty)
  }

  getFoodWorkerTargets(maxWorkers, sources, currentCounts) {
    const opportunities = []
    const retainedSlots = { ...currentCounts }
    const addSlots = (type, source, count, dropSites, hunterCount = 1) => {
      for (let slot = 0; slot < count; slot++) {
        const retentionBonus = retainedSlots[type] > 0 ? 1.08 : 1
        retainedSlots[type] = Math.max(0, (retainedSlots[type] || 0) - 1)
        opportunities.push({
          type,
          score: this.getFoodSourceScore(type, source, dropSites, slot, hunterCount) * retentionBonus,
        })
      }
    }

    for (const carcass of sources.carcasses) {
      addSlots('carcass', carcass, Math.min(3, Math.max(1, Math.ceil(carcass.quantity / 75))), sources.meatDrops)
    }
    for (const bush of sources.berries) addSlots('berry', bush, 2, sources.plantDrops)
    for (const farm of sources.farms) addSlots('farm', farm, 1, sources.plantDrops)
    for (const fish of sources.fish) addSlots('fish', fish, 1, sources.meatDrops)
    for (const animal of sources.animals) {
      if (animal.type === 'Elephant') continue
      const hunters = animal.totalHitPoints >= 20 ? Math.min(4, Math.max(1, Math.ceil(animal.hitPoints / 4))) : 1
      addSlots('hunt', animal, hunters, sources.meatDrops, hunters)
    }

    opportunities.sort((a, b) => b.score - a.score)
    const targets = { berry: 0, carcass: 0, farm: 0, fish: 0, hunt: 0 }
    for (const opportunity of opportunities.slice(0, maxWorkers)) targets[opportunity.type]++
    return targets
  }

  releaseExcessFoodWorkers(workers, target, availableVillagers) {
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
      villager.stop()
      if (!availableVillagers.includes(villager)) availableVillagers.push(villager)
      excess--
    }
  }

  // Group-aware hunting for non-elephant prey: large animals need several hunters on the same target.
  // Small animals get 1 hunter each. Returns count of new hunters assigned.
  assignHunters(availableVillagers, villagersHunting, maxTotalHunters) {
    const { ai } = this
    const safeAnimals = [...ai.foundedAnimals].filter(a => !a.isDead && this.isLocationSafe(a))
    if (!safeAnimals.length) return 0

    // Count hunters already chasing each animal
    const huntersByAnimal = new Map()
    for (const v of villagersHunting) {
      if (v.dest && !v.dest.isDead) {
        huntersByAnimal.set(v.dest, (huntersByAnimal.get(v.dest) || 0) + 1)
      }
    }

    const LARGE_HP = 20 // threshold for group hunt
    const DAMAGE_PER_HUNTER = 4 // spear damage per throw

    let actions = 0
    let totalHunters = villagersHunting.length // includes already-hunting villagers

    // Large animals: send a pack — enough hunters to kill before losing too many villagers
    // Prefer animals already being hunted (finish them first) to not waste effort
    const large = safeAnimals
      .filter(a => a.totalHitPoints >= LARGE_HP && a.type !== 'Elephant')
      .sort((a, b) => (huntersByAnimal.get(b) || 0) - (huntersByAnimal.get(a) || 0))

    for (const animal of large) {
      if (totalHunters >= maxTotalHunters || availableVillagers.length === 0) break
      const current = huntersByAnimal.get(animal) || 0
      const maxAssignable = Math.min(maxTotalHunters - totalHunters, availableVillagers.length)

      // How many hunters needed to kill this animal within ~3 attack rounds
      const needed = Math.max(0, Math.ceil(animal.hitPoints / DAMAGE_PER_HUNTER) - current)
      if (needed === 0) continue
      const toSend = Math.min(needed, maxAssignable)
      for (let i = 0; i < toSend; i++) {
        availableVillagers.shift().sendToHunt(animal)
        huntersByAnimal.set(animal, (huntersByAnimal.get(animal) || 0) + 1)
        totalHunters++
        actions++
      }
    }

    // Small animals: 1 hunter per animal, first-come first-served
    const small = safeAnimals.filter(a => a.totalHitPoints < LARGE_HP)
    for (const animal of small) {
      if (totalHunters >= maxTotalHunters || availableVillagers.length === 0) break
      if ((huntersByAnimal.get(animal) || 0) > 0) continue
      availableVillagers.shift().sendToHunt(animal)
      totalHunters++
      actions++
    }

    return actions
  }

  discoverDeadAnimals(map) {
    const { ai } = this
    for (const animal of map.gaia.units) {
      if (animal.isDead && !animal.isDestroyed && animal.quantity > 0) {
        if (ai.views.isVisible(animal.i, animal.j)) ai.foundedDeadAnimals.add(animal)
      }
    }
  }

  assignFoodSources(availableVillagers, workerSnapshot, targets, emptyFarms) {
    const { ai } = this
    const {
      villagersForaging = [],
      villagersHunting = [],
      villagersFarming = [],
      villagersFishing = [],
    } = workerSnapshot
    const { maxVillagersOnFood } = targets
    let actions = 0
    const berryDropSites = this.getStorageDropSites()
    const viableBerryBushes = this.getViableBerryBushes(berryDropSites)
    const carcassHunters = villagersHunting.filter(
      villager => villager.action === ACTION_TYPES.takemeat || villager.dest?.isDead
    )
    const liveHunters = villagersHunting.filter(
      villager => villager.action === ACTION_TYPES.hunt && villager.dest && !villager.dest.isDead
    )
    const farmCandidates = new Set([
      ...emptyFarms.filter(farm => farm.isBuilt && !farm.isDead && farm.quantity > 0),
      ...villagersFarming.map(villager => villager.dest).filter(farm => farm && !farm.isDead && farm.quantity > 0),
    ])
    const sources = {
      animals: [...ai.foundedAnimals].filter(animal => !animal.isDead && this.isLocationSafe(animal)),
      berries: [...viableBerryBushes],
      carcasses: [...ai.foundedDeadAnimals].filter(
        animal => !animal.isDestroyed && animal.quantity > 0 && this.isLocationSafe(animal)
      ),
      farms: [...farmCandidates],
      fish: [...ai.foundedFish].filter(node => node.quantity > 0 && this.isLocationSafe(node)),
      meatDrops: this.getFoodDropSites('meat'),
      plantDrops: this.getFoodDropSites('berry'),
    }
    const sourceTargets = this.getFoodWorkerTargets(maxVillagersOnFood, sources, {
      berry: villagersForaging.length,
      carcass: carcassHunters.length,
      farm: villagersFarming.length,
      fish: villagersFishing.length,
      hunt: liveHunters.length,
    })

    this.releaseExcessFoodWorkers(villagersForaging, sourceTargets.berry, availableVillagers)
    this.releaseExcessFoodWorkers(carcassHunters, sourceTargets.carcass, availableVillagers)
    this.releaseExcessFoodWorkers(liveHunters, sourceTargets.hunt, availableVillagers)
    this.releaseExcessFoodWorkers(villagersFishing, sourceTargets.fish, availableVillagers)
    this.releaseExcessFoodWorkers(villagersFarming, sourceTargets.farm, availableVillagers)

    const activeForagers = villagersForaging.filter(villager => !villager.inactif)
    const activeCarcassHunters = carcassHunters.filter(villager => !villager.inactif)
    const activeLiveHunters = liveHunters.filter(villager => !villager.inactif)
    const activeFishers = villagersFishing.filter(villager => !villager.inactif)
    const activeFarmers = villagersFarming.filter(villager => !villager.inactif)

    if (sources.carcasses.length > 0) {
      const toAssign = Math.min(
        Math.max(0, sourceTargets.carcass - activeCarcassHunters.length),
        availableVillagers.length
      )
      for (let i = 0; i < toAssign; i++) {
        const animal = getClosestInstance(availableVillagers[0], sources.carcasses)
        if (!animal) break
        availableVillagers.shift().sendToTakeMeat(animal)
        actions++
      }
    }

    actions += this.assignVillagersToResource(
      availableVillagers,
      activeForagers,
      viableBerryBushes,
      sourceTargets.berry,
      (villager, bush) => villager.sendToBerrybush(bush)
    )

    actions += this.assignHunters(availableVillagers, activeLiveHunters, sourceTargets.hunt)

    if (sources.fish.length > 0) {
      const toAssign = Math.min(Math.max(0, sourceTargets.fish - activeFishers.length), availableVillagers.length)
      for (let i = 0; i < toAssign; i++) {
        const fish = getClosestInstance(availableVillagers[0], sources.fish)
        if (!fish) break
        availableVillagers.shift().sendToFish(fish)
        actions++
      }
    }

    const availableFarms = emptyFarms
      .filter(farm => farm.isBuilt && !farm.isDead && farm.quantity > 0 && !farm.isUsedBy)
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
      availableVillagers.shift().sendToFarm(availableFarms[i])
      actions++
    }

    return actions
  }

  getBuildersNeeded(buildingType) {
    switch (buildingType) {
      case BUILDING_TYPES.barracks:
      case BUILDING_TYPES.archeryRange:
      case BUILDING_TYPES.stable:
      case BUILDING_TYPES.academy:
      case BUILDING_TYPES.townCenter:
        return 2
      default:
        return 1
    }
  }

  isValidBuildAssignment(villager) {
    return (
      villager &&
      !villager.isDead &&
      villager.action === ACTION_TYPES.build &&
      villager.work === WORK_TYPES.builder &&
      villager.dest?.family === FAMILY_TYPES.building &&
      villager.getActionCondition(villager.dest, ACTION_TYPES.build)
    )
  }

  recoverInvalidBuilder(villager) {
    if (!villager || villager.isDead || this.isValidBuildAssignment(villager)) return false
    if (villager.work !== WORK_TYPES.builder && villager.action !== ACTION_TYPES.build) return false

    if (villager.previousDest || villager.previousWork) {
      villager.goBackToPrevious()
    } else {
      villager.stop()
      villager.work = null
    }
    return true
  }

  // Builders borrow from their current job — no global cap, per-building limit by type.
  // Returns the Set of villagers sent to build this step (to exclude from resource pool).
  assignBuilders(villagers, notBuiltBuildings, debug = false) {
    const assigned = new Set()
    if (!notBuiltBuildings.length) return assigned

    // Count who is already actively building each site
    const buildingLoad = new Map()
    for (const v of villagers) {
      if (this.isValidBuildAssignment(v)) {
        buildingLoad.set(v.dest.label, (buildingLoad.get(v.dest.label) || 0) + 1)
        assigned.add(v)
      } else {
        this.recoverInvalidBuilder(v)
      }
    }

    // Buildings with fewest builders get priority
    const prioritized = [...notBuiltBuildings].sort(
      (a, b) => (buildingLoad.get(a.label) || 0) - (buildingLoad.get(b.label) || 0)
    )

    for (const building of prioritized) {
      if (this.ai.isBuildingThreatened(building)) continue
      const needed = this.getBuildersNeeded(building.type) - (buildingLoad.get(building.label) || 0)
      if (needed <= 0) continue

      // Prefer idle villagers (−30 distance bonus); fall back to active gatherers if needed
      const candidates = villagers
        .filter(v => !assigned.has(v) && v !== this.ai.scout && v.hitPoints > v.totalHitPoints * 0.3)
        .sort((a, b) => {
          const da = Math.abs(a.i - building.i) + Math.abs(a.j - building.j) + (a.inactif ? -30 : 0)
          const db = Math.abs(b.i - building.i) + Math.abs(b.j - building.j) + (b.inactif ? -30 : 0)
          return da - db
        })

      for (let i = 0; i < Math.min(needed, candidates.length); i++) {
        const v = candidates[i]
        v.sendToBuilding(building)
        assigned.add(v)
        buildingLoad.set(building.label, (buildingLoad.get(building.label) || 0) + 1)
        if (debug) console.log('Villager sent to build:', building.type)
      }
    }

    return assigned
  }

  handleVillagerActions({ villagers, map, farms, notBuiltBuildings, storagepits, towncenters, debug = false }) {
    const workerSnapshot = this.getWorkerSnapshot(villagers)
    const targets = this.getResourceTargets(villagers.length)
    const emptyFarms = farms.filter(({ isUsedBy }) => !isUsedBy)

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
      .filter(v => !buildingVillagers.has(v))
      .sort((a, b) => b.hitPoints - a.hitPoints)

    actions += this.assignFoodSources(availableVillagers, workerSnapshot, targets, emptyFarms)

    // Only mine gold/stone near a storage building — long trips kill efficiency
    const storageBuildings = [...(storagepits || []), ...(towncenters || [])].filter(b => b.isBuilt)
    const MAX_MINING_DIST = 22
    const nearStorage = node =>
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
        cb: (v, r) => v.sendToTree(r),
      },
      {
        workers: workerSnapshot.villagersOnStone,
        set: viableStones,
        max: targets.maxVillagersOnStone,
        cb: (v, r) => v.sendToStone(r),
      },
      {
        workers: workerSnapshot.villagersOnGold,
        set: viableGolds,
        max: targets.maxVillagersOnGold,
        cb: (v, r) => v.sendToGold(r),
      },
    ].sort((a, b) => {
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
        const tree = getClosestInstance(villager, this.ai.foundedTrees)
        if (tree) {
          villager.sendToTree(tree)
          actions++
        }
      }
    }

    return actions
  }
}
