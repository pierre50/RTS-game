import { ACTION_TYPES, BUILDING_TYPES, FAMILY_TYPES, UNIT_TYPES, WORK_TYPES } from '../constants'
import { getClosestInstance, instancesDistance } from '../lib'

export class AIEconomy {
  constructor(ai) {
    this.ai = ai
    this._exploredAll = false
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

    const weights = {
      food: base.food + foodBoost,
      wood: base.wood + woodBoost,
      // Don't allocate slots to resources that aren't on this map
      gold: ai.foundedGolds.size > 0 ? base.gold + (demand.gold > 0 ? 10 : 0) : 0,
      stone: ai.foundedStones.size > 0 ? base.stone + (demand.stone > 0 ? 10 : 0) : 0,
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
    for (let i = 0; i < views.length; i++) {
      const row = views[i]
      if (!row) continue
      for (let j = 0; j < row.length; j++) {
        if (row[j] && !row[j].viewed) return true
      }
    }
    this._exploredAll = true
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

  // Group-aware hunting: large animals (elephants, etc.) need several hunters on the same target.
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

    const LARGE_HP = 20 // threshold for group hunt (elephant = 45 HP)
    const MIN_ELEPHANT_HUNTERS = 5
    const DAMAGE_PER_HUNTER = 4 // spear damage per throw

    let actions = 0
    let totalHunters = villagersHunting.length // includes already-hunting villagers

    // Large animals: send a pack — enough hunters to kill before losing too many villagers
    // Prefer animals already being hunted (finish them first) to not waste effort
    const large = safeAnimals
      .filter(a => a.totalHitPoints >= LARGE_HP)
      .sort((a, b) => (huntersByAnimal.get(b) || 0) - (huntersByAnimal.get(a) || 0))

    for (const animal of large) {
      if (totalHunters >= maxTotalHunters || availableVillagers.length === 0) break
      const current = huntersByAnimal.get(animal) || 0
      const isElephant = animal.type === 'Elephant'
      const maxAssignable = Math.min(maxTotalHunters - totalHunters, availableVillagers.length)

      // Don't start or reinforce an elephant hunt unless we can field a full group of 5 at once.
      if (isElephant && current < MIN_ELEPHANT_HUNTERS && current + maxAssignable < MIN_ELEPHANT_HUNTERS) continue

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
        const viewerCell = ai.views?.[animal.i]?.[animal.j]
        if (viewerCell?.viewBy.size > 0) ai.foundedDeadAnimals.add(animal)
      }
    }
  }

  assignFoodSources(availableVillagers, workerSnapshot, targets, emptyFarms) {
    const { ai } = this
    const { villagersForaging, villagersHunting, villagersOnFood } = workerSnapshot
    const { maxVillagersOnFood } = targets
    let actions = 0
    let foodWorkersAssigned = villagersOnFood.length

    // Reserve farm slots only once berries are already being gathered — prevents starving berries in early game
    const farmReserve =
      emptyFarms.length > 0 && villagersForaging.length > 0
        ? Math.min(emptyFarms.length, Math.ceil(maxVillagersOnFood * 0.3))
        : 0
    const naturalFoodCap = maxVillagersOnFood - farmReserve

    // 1. Dead animals — free food already on the ground, highest priority
    if (ai.foundedDeadAnimals.size > 0) {
      const toAssign = Math.min(Math.max(0, naturalFoodCap - foodWorkersAssigned), availableVillagers.length)
      for (let i = 0; i < toAssign; i++) {
        const animal = getClosestInstance(availableVillagers[0], ai.foundedDeadAnimals)
        if (!animal) break
        availableVillagers.shift().sendToTakeMeat(animal)
        foodWorkersAssigned++
        actions++
      }
    }

    // 2. Berries — stable and efficient
    const berriesAssigned = this.assignVillagersToResource(
      availableVillagers,
      villagersForaging,
      ai.foundedBerrybushs,
      naturalFoodCap,
      (villager, bush) => villager.sendToBerrybush(bush)
    )
    foodWorkersAssigned += berriesAssigned
    actions += berriesAssigned

    // 3. Group hunting — large animals get multiple hunters; small animals get one each
    //    maxTotalHunters = existing hunters + remaining food slots (capped at 6)
    const maxTotalHunters = Math.min(6, naturalFoodCap - (foodWorkersAssigned - villagersHunting.length))
    const huntActions = this.assignHunters(availableVillagers, villagersHunting, maxTotalHunters)
    foodWorkersAssigned += huntActions
    actions += huntActions

    // 4. Fishing
    if (ai.foundedFish.size > 0) {
      const maxFishers = Math.min(3, availableVillagers.length)
      for (let i = 0; i < maxFishers; i++) {
        if (foodWorkersAssigned >= naturalFoodCap) break
        const fish = getClosestInstance(availableVillagers[0], ai.foundedFish)
        if (!fish) break
        availableVillagers.shift().sendToFish(fish)
        foodWorkersAssigned++
        actions++
      }
    }

    // 5. Farms — renewable, fills remaining food quota
    const foodShortfall = Math.max(0, maxVillagersOnFood - foodWorkersAssigned)
    for (let i = 0; i < emptyFarms.length && i < foodShortfall && availableVillagers.length > 0; i++) {
      availableVillagers.shift().sendToFarm(emptyFarms[i])
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

  // Builders borrow from their current job — no global cap, per-building limit by type.
  // Returns the Set of villagers sent to build this step (to exclude from resource pool).
  assignBuilders(villagers, notBuiltBuildings, debug = false) {
    const assigned = new Set()
    if (!notBuiltBuildings.length) return assigned

    // Count who is already actively building each site
    const buildingLoad = new Map()
    for (const v of villagers) {
      if (!v.inactif && v.work === WORK_TYPES.builder && v.dest?.label) {
        buildingLoad.set(v.dest.label, (buildingLoad.get(v.dest.label) || 0) + 1)
        assigned.add(v)
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
          v.explore()
          actions++
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
