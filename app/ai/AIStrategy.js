import { BUILDING_TYPES, UNIT_TYPES, WORK_TYPES } from '../constants'
import { canAfford, getPositionInGridAroundInstance, instancesDistance } from '../lib'
import { AIMilitary } from './AIMilitary'
import {
  AGE_UP_BUFFERS,
  AGE_UP_COSTS,
  AI_DIFFICULTIES,
  MAX_ARCHER_BY_AGE,
  MAX_BUILDING_BY_AGE,
  MAX_CAVALRY_BY_AGE,
  MAX_HOPLITE_BY_AGE,
  MAX_INFANTRY_BY_AGE,
  MAX_VILLAGER_PER_AGE,
  NEXT_AGE,
  TECH_PRIORITY_BY_BUILDING,
  VILLAGE_TARGET_PERCENTAGE_BY_AGE,
} from './config'
import { ARCHER_TECH_UPGRADES, INFANTRY_TECH_UPGRADES, getBestUnitFromTechs } from './unitGroups'

export class AIStrategy {
  constructor(ai, difficulty = 'medium') {
    this.ai = ai
    this.difficulty = difficulty
    this.difficultyConfig = AI_DIFFICULTIES[difficulty] || AI_DIFFICULTIES.medium
    this.nextAge = NEXT_AGE
    this.maxVillagerPerAge = MAX_VILLAGER_PER_AGE
    this.villageTargetPercentageByAge = VILLAGE_TARGET_PERCENTAGE_BY_AGE
    this.maxBuildingByAge = MAX_BUILDING_BY_AGE
    this.maxInfantryByAge = MAX_INFANTRY_BY_AGE
    this.maxArcherByAge = MAX_ARCHER_BY_AGE
    this.maxCavalryByAge = MAX_CAVALRY_BY_AGE
    this.maxHopliteByAge = MAX_HOPLITE_BY_AGE
    this.techPriorityByBuilding = TECH_PRIORITY_BY_BUILDING
    this.military = new AIMilitary(ai, this)
  }

  applyConfig(target) {
    target.difficultyConfig = this.difficultyConfig
    target.nextAge = this.nextAge
    target.maxVillagerPerAge = this.maxVillagerPerAge
    target.villageTargetPercentageByAge = this.villageTargetPercentageByAge
    target.maxBuildingByAge = this.maxBuildingByAge
    target.maxInfantryByAge = this.maxInfantryByAge
    target.maxArcherByAge = this.maxArcherByAge
    target.maxCavalryByAge = this.maxCavalryByAge
    target.maxHopliteByAge = this.maxHopliteByAge
    target.techPriorityByBuilding = this.techPriorityByBuilding
  }

  canResearchTech(techKey) {
    const { ai } = this
    const tech = ai.techs[techKey]
    if (!tech?.conditions) return true
    return tech.conditions.every(cond => {
      if (cond.key === 'age') {
        if (cond.op === '>=') return ai.age >= cond.value
        if (cond.op === '=') return ai.age === cond.value
      }
      if (cond.key === 'technologies') {
        if (cond.op === 'includes') return ai.technologies.includes(cond.value)
        if (cond.op === 'notincludes') return !ai.technologies.includes(cond.value)
      }
      return true
    })
  }

  getBestInfantryUnit() {
    return getBestUnitFromTechs(this.ai.technologies, INFANTRY_TECH_UPGRADES, 'Clubman')
  }

  getBestArcherUnit() {
    return getBestUnitFromTechs(this.ai.technologies, ARCHER_TECH_UPGRADES, 'Bowman')
  }

  updatePhase(villagersCount, militaryCount, militaryPower = 0) {
    const { ai, difficultyConfig } = this
    const attackPowerThreshold = this.military.getDesiredAttackPower()
    const fallbackPowerThreshold = attackPowerThreshold * 0.4
    if (ai.phase === 'economy' && villagersCount >= difficultyConfig.econToMilVillagers) {
      ai.phase = 'military_build'
      return 'military_build'
    }
    if (ai.phase === 'military_build' && villagersCount < Math.floor(difficultyConfig.econToMilVillagers * 0.6)) {
      ai.phase = 'economy'
      return 'economy'
    }
    if (
      ai.phase === 'military_build' &&
      militaryCount >= Math.max(2, Math.ceil(difficultyConfig.attackThreshold * 0.5)) &&
      militaryPower >= attackPowerThreshold
    ) {
      ai.phase = 'attack'
      return 'attack'
    }
    if (
      ai.phase === 'attack' &&
      (militaryCount < Math.ceil(difficultyConfig.attackThreshold * 0.4) || militaryPower < fallbackPowerThreshold)
    ) {
      ai.phase = 'military_build'
      return 'military_build'
    }
    return ai.phase
  }

  handleMilitaryActions(options) {
    return this.military.handleActions(options)
  }

  isTechnologyInProgress(technologyType, buildingList = []) {
    return buildingList.some(
      building => building && !building.isDead && !building.isDestroyed && building.technology?.type === technologyType
    )
  }

  getTrainingLoad(buildings = []) {
    return buildings.reduce((total, building) => {
      if (!building || building.isDead || building.isDestroyed) return total
      return total + building.queue.length + (building.loading !== null ? 1 : 0)
    }, 0)
  }

  getDesiredBarracksCount(snapshot = null) {
    const { ai, difficultyConfig } = this
    const barracks = snapshot?.barracks || ai.buildings.filter(building => building.type === BUILDING_TYPES.barracks)
    const archeryRanges =
      snapshot?.archeryRanges || ai.buildings.filter(building => building.type === BUILDING_TYPES.archeryRange)
    const stables = snapshot?.stables || ai.buildings.filter(building => building.type === BUILDING_TYPES.stable)
    const academies = snapshot?.academies || ai.buildings.filter(building => building.type === BUILDING_TYPES.academy)
    const builtBarracks = barracks.filter(building => building.isBuilt && !building.isDead && !building.isDestroyed)
    const totalMilitary =
      (snapshot?.infantry?.length || 0) +
      (snapshot?.archers?.length || 0) +
      (snapshot?.cavalry?.length || 0) +
      (snapshot?.hoplites?.length || 0)
    const militaryProductionBuildings =
      archeryRanges.filter(building => building.isBuilt && !building.isDead && !building.isDestroyed).length +
      stables.filter(building => building.isBuilt && !building.isDead && !building.isDestroyed).length +
      academies.filter(building => building.isBuilt && !building.isDead && !building.isDestroyed).length

    let desired = ai.phase !== 'economy' ? 1 : 0

    if (
      ai.age >= 2 &&
      ai.phase !== 'economy' &&
      (totalMilitary >= Math.max(8, difficultyConfig.attackThreshold * 2) ||
        this.getTrainingLoad(builtBarracks) >= Math.max(2, builtBarracks.length * 2))
    ) {
      desired = 2
    }

    if (
      ai.age >= 3 &&
      ai.phase === 'attack' &&
      totalMilitary >= Math.max(12, difficultyConfig.attackThreshold * 3) &&
      this.getTrainingLoad(builtBarracks) >= Math.max(3, builtBarracks.length * 2) &&
      militaryProductionBuildings >= 2
    ) {
      desired = 3
    }

    return desired
  }

  getEconomicDemand() {
    const { ai } = this
    const demand = { food: 0, wood: 0, gold: 0, stone: 0 }
    const nextAgeKey = ai.age + 1
    const nextAgeCost = AGE_UP_COSTS[nextAgeKey]
    if (nextAgeCost) {
      const maxVillagers = Math.floor(this.maxVillagerPerAge[ai.age] * ai.difficultyConfig.popCapMultiplier)
      const shouldReserveAgeUp = ai.population >= Math.floor(maxVillagers * 0.7)
      for (const [resource, amount] of Object.entries(nextAgeCost)) {
        demand[resource] += shouldReserveAgeUp ? amount : Math.max(0, amount - ai[resource])
      }
    }

    if (ai.population + 2 > ai.population_max) {
      demand.wood += ai.config.buildings[BUILDING_TYPES.house]?.cost?.wood || 0
    }
    const currentBarracks = ai.buildings.filter(
      building => building.type === BUILDING_TYPES.barracks && !building.isDead && !building.isDestroyed
    ).length
    const desiredBarracks = this.getDesiredBarracksCount()
    if (ai.phase !== 'economy' && currentBarracks < desiredBarracks) {
      demand.wood +=
        (ai.config.buildings[BUILDING_TYPES.barracks]?.cost?.wood || 0) * (desiredBarracks - currentBarracks)
    }
    if (!ai.buildings.some(building => building.type === BUILDING_TYPES.market)) {
      demand.wood += ai.config.buildings[BUILDING_TYPES.market]?.cost?.wood || 0
    }

    return demand
  }

  canSpendWithReserve(cost, reserve = {}) {
    const { ai } = this
    return Object.entries(cost || {}).every(([resource, amount]) => ai[resource] - amount >= (reserve[resource] || 0))
  }

  buyUnits(currentCount, maxCount, buildingList, unitType, extra, reserve = {}, debug = false) {
    const unitsNeeded = maxCount - currentCount
    let unitsBought = 0
    if (unitsNeeded <= 0) return 0
    const unitCost = this.ai.config.units[unitType]?.cost || {}
    for (const building of buildingList) {
      if (unitsBought >= unitsNeeded) break
      if (building && this.canSpendWithReserve(unitCost, reserve) && building.buyUnit(unitType, false, false, extra)) {
        unitsBought++
        if (debug) console.log(`Buying ${unitType} from ${building.type}, Total Bought: ${unitsBought}`)
      }
    }
    return unitsBought
  }

  handleProductionActions(snapshot, debug = false) {
    const {
      villagers,
      maxVillagers,
      towncenters,
      infantry,
      maxInfantry,
      barracks,
      infantryUnit,
      archers,
      maxArcher,
      archeryRanges,
      archerUnit,
      cavalry,
      maxCavalry,
      stables,
      hoplites,
      maxHoplite,
      academies,
    } = snapshot

    let actions = 0
    const reserve = this.getEconomicDemand()

    actions += this.buyUnits(
      villagers.length,
      maxVillagers,
      towncenters,
      UNIT_TYPES.villager,
      undefined,
      reserve,
      debug
    )
    actions += this.buyUnits(infantry.length, maxInfantry, barracks, infantryUnit, undefined, reserve, debug)
    actions += this.buyUnits(archers.length, maxArcher, archeryRanges, archerUnit, undefined, reserve, debug)
    actions += this.buyUnits(cavalry.length, maxCavalry, stables, 'Scout', undefined, reserve, debug)
    actions += this.buyUnits(hoplites.length, maxHoplite, academies, 'Hoplite', undefined, reserve, debug)
    return actions
  }

  getViableBerryBushCount() {
    const { ai } = this
    const dropSites = ai.buildings.filter(
      building =>
        [BUILDING_TYPES.townCenter, BUILDING_TYPES.granary].includes(building.type) &&
        building.isBuilt &&
        !building.isDead &&
        !building.isDestroyed
    )
    const homeAnchor = ai.getHomeAnchor()
    const MAX_BERRY_DROP_DIST = 14
    const MAX_BERRY_HOME_DIST = 30

    return [...ai.foundedBerrybushs].filter(bush => {
      if (!bush || bush.isDead || bush.quantity <= 0) return false
      if (dropSites.length > 0) {
        const nearDropSite = dropSites.some(
          site => Math.abs(bush.i - site.i) + Math.abs(bush.j - site.j) <= MAX_BERRY_DROP_DIST
        )
        if (!nearDropSite) return false
      }
      if (!homeAnchor) return true
      return Math.abs(bush.i - homeAnchor.i) + Math.abs(bush.j - homeAnchor.j) <= MAX_BERRY_HOME_DIST
    }).length
  }

  shouldBuyFarm(snapshot) {
    const { ai } = this
    const { villagers, farms } = snapshot
    const builtFarms = farms.filter(farm => farm.isBuilt && !farm.isDead)
    const emptyBuiltFarms = builtFarms.filter(farm => !farm.isUsedBy)
    const occupiedBuiltFarms = builtFarms.length - emptyBuiltFarms.length
    const pendingFarms = farms.filter(farm => !farm.isBuilt && !farm.isDead).length
    const villagersOnFood = villagers.filter(
      villager =>
        !villager.isDead &&
        !villager.inactif &&
        [WORK_TYPES.forager, WORK_TYPES.hunter, WORK_TYPES.farmer, WORK_TYPES.fisher].includes(villager.work)
    ).length

    if (villagers.length < 8) return false
    if (pendingFarms > 0) return false
    if (emptyBuiltFarms.length >= Math.max(1, Math.ceil(villagers.length / 14))) return false

    const aliveAnimals = [...ai.foundedAnimals].filter(animal => !animal.isDead).length
    const deadAnimals = [...ai.foundedDeadAnimals].filter(animal => !animal.isDestroyed && animal.quantity > 0).length
    const naturalFoodCapacity =
      this.getViableBerryBushCount() * 2 + aliveAnimals * 2 + deadAnimals + Math.min(ai.foundedFish.size, 3) * 2
    const naturalFoodUnderPressure =
      villagersOnFood > naturalFoodCapacity || naturalFoodCapacity < Math.max(4, Math.ceil(villagers.length * 0.35))
    const foodDemand = this.getEconomicDemand().food > 0 || ai.food < 80
    const farmsNearlySaturated = builtFarms.length > 0 && occupiedBuiltFarms >= builtFarms.length - 1

    return naturalFoodUnderPressure && (foodDemand || farmsNearlySaturated)
  }

  buyBuildingIfNeeded(condition, buildingType, buildingsByType, positionCallback, debug = false) {
    const { ai } = this
    const building = ai.config.buildings[buildingType]
    if (
      condition &&
      canAfford(ai, building.cost) &&
      ai.hasNotReachBuildingLimit(buildingType, buildingsByType[buildingType])
    ) {
      const pos = positionCallback()
      if (pos && ai.buyBuilding(pos.i, pos.j, buildingType)) {
        if (debug) console.log(`Buying building: ${buildingType} at position:`, pos)
        return true
      }
    }
    return false
  }

  handleBuildingActions(snapshot, debug = false) {
    const { ai } = this
    const {
      map,
      otherPlayers,
      towncenters,
      houses,
      farms,
      barracks,
      granarys,
      storagepits,
      markets,
      governmentCenters,
      archeryRanges,
      stables,
      academies,
      watchTowers,
      sentryTowers,
      notBuiltHouses,
    } = snapshot

    const anchor = towncenters[0] || ai.getHomeAnchor()
    if (!anchor) return 0

    const buildingsByType = {
      [BUILDING_TYPES.townCenter]: towncenters,
      [BUILDING_TYPES.house]: houses,
      [BUILDING_TYPES.farm]: farms,
      [BUILDING_TYPES.barracks]: barracks,
      [BUILDING_TYPES.granary]: granarys,
      [BUILDING_TYPES.storagePit]: storagepits,
      [BUILDING_TYPES.market]: markets,
      [BUILDING_TYPES.governmentCenter]: governmentCenters,
      [BUILDING_TYPES.archeryRange]: archeryRanges,
      [BUILDING_TYPES.stable]: stables,
      [BUILDING_TYPES.academy]: academies,
      [BUILDING_TYPES.watchTower]: watchTowers,
      [BUILDING_TYPES.sentryTower]: sentryTowers,
    }

    const isEnemyFacing = origin => cell =>
      otherPlayers.every(player => instancesDistance(cell, player) <= instancesDistance(origin, player))
    const buy = (condition, buildingType, positionCallback) =>
      this.buyBuildingIfNeeded(condition, buildingType, buildingsByType, positionCallback, debug)

    let actions = 0
    const desiredBarracks = this.getDesiredBarracksCount(snapshot)

    if (
      buy(ai.population + 2 > ai.population_max && !notBuiltHouses.length, BUILDING_TYPES.house, () =>
        getPositionInGridAroundInstance(anchor, map.grid, [6, 10], 0)
      )
    )
      actions++

    if (
      buy(ai.phase !== 'economy' && barracks.length < desiredBarracks, BUILDING_TYPES.barracks, () =>
        getPositionInGridAroundInstance(anchor, map.grid, [6, 20], 1, false, isEnemyFacing(anchor))
      )
    )
      actions++

    if (
      buy(markets.length === 0, BUILDING_TYPES.market, () =>
        getPositionInGridAroundInstance(anchor, map.grid, [6, 20], 1, false, isEnemyFacing(anchor))
      )
    )
      actions++

    if (
      buy(ai.age >= 2 && markets.some(m => m.isBuilt), BUILDING_TYPES.governmentCenter, () =>
        getPositionInGridAroundInstance(anchor, map.grid, [8, 22], 1, false, isEnemyFacing(anchor))
      )
    )
      actions++

    if (
      buy(
        ai.age >= 2 &&
          towncenters.length < 2 &&
          governmentCenters.some(gc => gc.isBuilt) &&
          ai.population_max >= 24 &&
          ai.population >= 16,
        BUILDING_TYPES.townCenter,
        () => getPositionInGridAroundInstance(anchor, map.grid, [14, 30], 2, false, isEnemyFacing(anchor))
      )
    )
      actions++

    if (
      buy(barracks.length > 0, BUILDING_TYPES.archeryRange, () =>
        getPositionInGridAroundInstance(anchor, map.grid, [6, 20], 1, false, isEnemyFacing(anchor))
      )
    )
      actions++

    if (
      buy(barracks.length > 0, BUILDING_TYPES.stable, () =>
        getPositionInGridAroundInstance(anchor, map.grid, [6, 20], 1, false, isEnemyFacing(anchor))
      )
    )
      actions++

    if (
      buy(
        stables.some(s => s.isBuilt),
        BUILDING_TYPES.academy,
        () => getPositionInGridAroundInstance(anchor, map.grid, [6, 20], 1, false, isEnemyFacing(anchor))
      )
    )
      actions++

    if (
      buy(this.shouldBuyFarm(snapshot), BUILDING_TYPES.farm, () => {
        const buildings = [...granarys, ...towncenters]
        for (const building of buildings) {
          const position = getPositionInGridAroundInstance(
            building,
            map.grid,
            [2, 10],
            2,
            false,
            isEnemyFacing(building),
            false
          )
          if (position) return position
        }
        return null
      })
    )
      actions++

    if (
      buy(ai.technologies.includes('ResearchWatchTower'), BUILDING_TYPES.watchTower, () =>
        getPositionInGridAroundInstance(anchor, map.grid, [6, 15], 2, false, isEnemyFacing(anchor))
      )
    )
      actions++

    if (
      buy(ai.technologies.includes('ResearchSentryTower'), BUILDING_TYPES.sentryTower, () =>
        getPositionInGridAroundInstance(anchor, map.grid, [6, 15], 2, false, isEnemyFacing(anchor))
      )
    )
      actions++

    return actions
  }

  buyTechnology(buildingList, technologyType, debug = false) {
    for (const building of buildingList) {
      if (building && building.buyTechnology(technologyType)) {
        if (debug) console.log(`Buying ${technologyType} from ${building.type}`)
        return 1
      }
    }
    return 0
  }

  handleTechnologyActions(snapshot, debug = false) {
    const { ai } = this
    const { maxVillagers, towncenters, barracks, archeryRanges, storagepits, markets, granarys } = snapshot
    let actions = 0

    const nextAgeKey = ai.age + 1
    if (ai.nextAge[nextAgeKey]) {
      const cost = AGE_UP_COSTS[nextAgeKey] || {}
      const buffer = AGE_UP_BUFFERS[nextAgeKey] || {}
      const popReady = ai.population >= Math.floor(maxVillagers * 0.8)
      const resReady = Object.entries(cost).every(([res, amount]) => ai[res] >= amount + (buffer[res] || 0))
      if (popReady && resReady && !this.isTechnologyInProgress(ai.nextAge[nextAgeKey], towncenters)) {
        actions += this.buyTechnology(towncenters, ai.nextAge[nextAgeKey], debug)
      }
    }

    const buildingListByType = {
      [BUILDING_TYPES.barracks]: barracks,
      [BUILDING_TYPES.archeryRange]: archeryRanges,
      [BUILDING_TYPES.storagePit]: storagepits,
      [BUILDING_TYPES.market]: markets,
      [BUILDING_TYPES.granary]: granarys,
    }
    for (const [buildingType, techList] of Object.entries(ai.techPriorityByBuilding)) {
      const buildings = buildingListByType[buildingType]
      if (!buildings?.length) continue
      for (const tech of techList) {
        if (ai.technologies.includes(tech)) continue
        if (!this.canResearchTech(tech)) continue
        if (this.isTechnologyInProgress(tech, buildings)) continue
        const bought = this.buyTechnology(buildings, tech, debug)
        if (bought) {
          actions += bought
          break
        }
      }
    }

    return actions
  }
}
