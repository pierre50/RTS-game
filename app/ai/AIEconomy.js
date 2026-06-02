import { ACTION_TYPES, BUILDING_TYPES, WORK_TYPES } from '../constants'
import { getClosestInstance, getInstanceClosestFreeCellPath, getValuePercentage, instancesDistance } from '../lib'

export class AIEconomy {
  constructor(ai) {
    this.ai = ai
  }

  getWorkerSnapshot(villagers) {
    const villagersByWork = works => villagers.filter(v => !v.inactif && works.includes(v.work))
    const inactifVillagers = villagers.filter(v => v.inactif && v.action !== ACTION_TYPES.attack)

    const villagersForaging = villagersByWork([WORK_TYPES.forager])
    const villagersFarming = villagersByWork([WORK_TYPES.farmer])
    const villagersHunting = villagersByWork([WORK_TYPES.hunter])
    const villagersFishing = villagersByWork([WORK_TYPES.fisher])
    const villagersOnFood = [...villagersForaging, ...villagersFarming, ...villagersHunting, ...villagersFishing]
    const villagersOnWood = villagersByWork([WORK_TYPES.woodcutter])
    const villagersOnGold = villagersByWork([WORK_TYPES.goldminer])
    const villagersOnStone = villagersByWork([WORK_TYPES.stoneminer])
    const builderVillagers = villagersByWork([WORK_TYPES.builder])

    return {
      inactifVillagers,
      villagersForaging,
      villagersOnFood,
      villagersOnWood,
      villagersOnGold,
      villagersOnStone,
      builderVillagers,
    }
  }

  getResourceTargets(villagersCount) {
    const { ai } = this
    const woodBoost = ai.wood < 50 ? 15 : 0
    const foodBoost = ai.food < 50 ? 15 : 0
    return {
      maxVillagersOnFood: getValuePercentage(
        villagersCount,
        ai.villageTargetPercentageByAge[ai.age]['food'] + foodBoost
      ),
      maxVillagersOnWood: getValuePercentage(
        villagersCount,
        ai.villageTargetPercentageByAge[ai.age]['wood'] + woodBoost
      ),
      maxVillagersOnGold: getValuePercentage(villagersCount, ai.villageTargetPercentageByAge[ai.age]['gold']),
      maxVillagersOnStone: getValuePercentage(villagersCount, ai.villageTargetPercentageByAge[ai.age]['stone']),
    }
  }

  updateScout(inactifVillagers) {
    const { ai } = this
    if (!ai.scout || ai.scout.isDead || ai.scout.hitPoints <= 0) {
      ai.scout = inactifVillagers[inactifVillagers.length - 1] || null
    }
    if (ai.scout && ai.scout.inactif) {
      ai.scout.explore()
    }
  }

  assignVillagersToResource(
    availableVillagers,
    villagersOnResource,
    resourceList,
    maxVillagersForResource,
    actionCallback
  ) {
    for (let i = maxVillagersForResource; i < villagersOnResource.length; i++) {
      villagersOnResource[i].stop()
    }
    if (resourceList.size === 0) return 0
    const needed = Math.max(0, maxVillagersForResource - villagersOnResource.length)
    const toAssign = Math.min(needed, availableVillagers.length)
    for (let i = 0; i < toAssign; i++) {
      const villager = availableVillagers.shift()
      const resource = getClosestInstance(villager, resourceList)
      actionCallback(villager, resource)
    }
    return toAssign
  }

  isSafeToHunt(animal) {
    const { ai } = this
    if (animal.meleeAttack) return false
    const dangerRadius = 15
    for (const b of ai.foundedEnemyBuildings) {
      if (instancesDistance(animal, b) < dangerRadius) return false
    }
    for (const u of ai.foundedEnemyUnits) {
      if (instancesDistance(animal, u) < dangerRadius) return false
    }
    return true
  }

  discoverDeadAnimals(map) {
    const { ai } = this
    for (const animal of map.gaia.units) {
      if (animal.isDead && !animal.isDestroyed && animal.quantity > 0) {
        const viewerCell = ai.views?.[animal.i]?.[animal.j]
        if (viewerCell?.viewBy.size > 0) {
          ai.foundedDeadAnimals.add(animal)
        }
      }
    }
  }

  assignFoodSources(availableVillagers, workerSnapshot, targets, emptyFarms) {
    const { ai } = this
    const { villagersForaging, villagersOnFood } = workerSnapshot
    const { maxVillagersOnFood } = targets
    let actions = 0
    let foodWorkersAssigned = villagersOnFood.length

    if (ai.foundedDeadAnimals.size > 0) {
      const toAssign = Math.min(Math.max(0, maxVillagersOnFood - foodWorkersAssigned), availableVillagers.length)
      for (let i = 0; i < toAssign; i++) {
        const animal = getClosestInstance(availableVillagers[0], ai.foundedDeadAnimals)
        if (!animal) break
        availableVillagers.shift().sendToTakeMeat(animal)
        foodWorkersAssigned++
        actions++
      }
    }

    const berriesAssigned = this.assignVillagersToResource(
      availableVillagers,
      villagersForaging,
      ai.foundedBerrybushs,
      maxVillagersOnFood,
      (villager, bush) => {
        villager.sendToBerrybush(bush)
      }
    )
    foodWorkersAssigned += berriesAssigned
    actions += berriesAssigned

    const safeAnimals = new Set([...ai.foundedAnimals].filter(a => this.isSafeToHunt(a)))
    if (safeAnimals.size > 0) {
      const maxHunters = Math.min(2, availableVillagers.length)
      for (let i = 0; i < maxHunters; i++) {
        if (foodWorkersAssigned >= maxVillagersOnFood) break
        const animal = getClosestInstance(availableVillagers[0], safeAnimals)
        if (!animal) break
        availableVillagers.shift().sendToHunt(animal)
        foodWorkersAssigned++
        actions++
      }
    }

    if (ai.foundedFish.size > 0) {
      const maxFishers = Math.min(3, availableVillagers.length)
      for (let i = 0; i < maxFishers; i++) {
        if (foodWorkersAssigned >= maxVillagersOnFood) break
        const fish = getClosestInstance(availableVillagers[0], ai.foundedFish)
        if (!fish) break
        availableVillagers.shift().sendToFish(fish)
        foodWorkersAssigned++
        actions++
      }
    }

    const foodShortfall = Math.max(0, maxVillagersOnFood - foodWorkersAssigned)
    for (let i = 0; i < emptyFarms.length && i < foodShortfall && availableVillagers.length > 0; i++) {
      const villager = availableVillagers.shift()
      villager.sendToFarm(emptyFarms[i])
      actions++
    }

    return actions
  }

  assignBuilders(availableVillagers, notBuiltBuildings, builderVillagers, maxVillagersOnConstruction, debug = false) {
    let actions = 0
    if (!notBuiltBuildings.length) return actions
    let currentBuilders = builderVillagers.length

    for (const building of notBuiltBuildings) {
      if (currentBuilders >= maxVillagersOnConstruction) break
      if (availableVillagers.length === 0) break
      const villager = [...availableVillagers]
        .sort(
          (a, b) =>
            Math.abs(a.i - building.i) +
            Math.abs(a.j - building.j) -
            (Math.abs(b.i - building.i) + Math.abs(b.j - building.j))
        )
        .find(candidate => getInstanceClosestFreeCellPath(candidate, building, candidate.context.map).length)
      if (villager) {
        if (debug) console.log('Villager sent to build:', building)
        villager.sendToBuilding(building)
        availableVillagers.splice(availableVillagers.indexOf(villager), 1)
        currentBuilders++
        actions++
      }
    }
    return actions
  }

  handleVillagerActions({ villagers, map, farms, notBuiltBuildings, maxVillagersOnConstruction, debug = false }) {
    const workerSnapshot = this.getWorkerSnapshot(villagers)
    const targets = this.getResourceTargets(villagers.length)
    const emptyFarms = farms.filter(({ isUsedBy }) => !isUsedBy)

    if (debug)
      console.log(
        `Food: ${workerSnapshot.villagersOnFood.length}/${targets.maxVillagersOnFood}, Wood: ${workerSnapshot.villagersOnWood.length}/${targets.maxVillagersOnWood}, Stone: ${workerSnapshot.villagersOnStone.length}/${targets.maxVillagersOnStone}, Gold: ${workerSnapshot.villagersOnGold.length}/${targets.maxVillagersOnGold}, Builders: ${workerSnapshot.builderVillagers.length}`
      )

    this.updateScout(workerSnapshot.inactifVillagers)
    const availableVillagers = workerSnapshot.inactifVillagers.filter(v => v !== this.ai.scout)
    let actions = 0

    this.discoverDeadAnimals(map)
    actions += this.assignBuilders(
      availableVillagers,
      notBuiltBuildings,
      workerSnapshot.builderVillagers,
      maxVillagersOnConstruction,
      debug
    )
    actions += this.assignFoodSources(availableVillagers, workerSnapshot, targets, emptyFarms)
    actions += this.assignVillagersToResource(
      availableVillagers,
      workerSnapshot.villagersOnWood,
      this.ai.foundedTrees,
      targets.maxVillagersOnWood,
      (villager, tree) => {
        villager.sendToTree(tree)
      }
    )
    actions += this.assignVillagersToResource(
      availableVillagers,
      workerSnapshot.villagersOnStone,
      this.ai.foundedStones,
      targets.maxVillagersOnStone,
      (villager, stone) => {
        villager.sendToStone(stone)
      }
    )
    actions += this.assignVillagersToResource(
      availableVillagers,
      workerSnapshot.villagersOnGold,
      this.ai.foundedGolds,
      targets.maxVillagersOnGold,
      (villager, gold) => {
        villager.sendToGold(gold)
      }
    )

    return actions
  }
}
