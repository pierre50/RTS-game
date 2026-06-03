import { BUILDING_TYPES, UNIT_TYPES } from '../constants'
import { canAfford, getPositionInGridAroundInstance, instancesDistance } from '../lib'
import { AIMilitary } from './AIMilitary'

const DIFFICULTIES = {
  easy: {
    stepDelayBase: 6000,
    popCapMultiplier: 0.7,
    attackThreshold: 8,
    defenderRatio: 0.5,
    econToMilVillagers: 16,
    raidThreshold: 0,
    raidSize: 0,
  },
  medium: {
    stepDelayBase: 4000,
    popCapMultiplier: 1.0,
    attackThreshold: 5,
    defenderRatio: 0.3,
    econToMilVillagers: 12,
    raidThreshold: 0,
    raidSize: 0,
  },
  hard: {
    stepDelayBase: 2500,
    popCapMultiplier: 1.3,
    attackThreshold: 3,
    defenderRatio: 0.2,
    econToMilVillagers: 8,
    raidThreshold: 4,
    raidSize: 3,
  },
}

const NEXT_AGE = {
  1: 'ToolAge',
  2: 'BronzeAge',
  3: 'IronAge',
}

const MAX_VILLAGER_PER_AGE = {
  0: 16,
  1: 24,
  2: 40,
  3: 50,
}

const VILLAGE_TARGET_PERCENTAGE_BY_AGE = {
  0: {
    wood: 40,
    food: 60,
    gold: 0,
    stone: 0,
  },
  1: {
    wood: 45,
    food: 45,
    gold: 10,
    stone: 0,
  },
  2: {
    wood: 35,
    food: 35,
    gold: 20,
    stone: 10,
  },
  3: {
    wood: 30,
    food: 30,
    gold: 25,
    stone: 15,
  },
}

const MAX_BUILDING_BY_AGE = {
  0: {
    StoragePit: 1,
    Granary: 1,
    Barracks: 1,
    Market: 1,
  },
  1: {
    StoragePit: 2,
    Granary: 2,
    Farm: 4,
    Barracks: 1,
    Market: 1,
    ArcheryRange: 1,
    Stable: 1,
    WatchTower: 2,
  },
  2: {
    StoragePit: 3,
    Granary: 3,
    Farm: 6,
    Barracks: 2,
    Market: 1,
    ArcheryRange: 1,
    Stable: 1,
    Academy: 1,
    WatchTower: 3,
    SentryTower: 2,
  },
  3: {
    StoragePit: 4,
    Granary: 4,
    Farm: 10,
    Barracks: 2,
    Market: 1,
    ArcheryRange: 2,
    Stable: 1,
    Academy: 1,
    WatchTower: 3,
    SentryTower: 3,
  },
}

const TECH_PRIORITY_BY_BUILDING = {
  [BUILDING_TYPES.barracks]: ['BattleAxe', 'ShortSword', 'BroadSword', 'LongSword'],
  [BUILDING_TYPES.archeryRange]: ['ImprovedBow', 'CompositeBow'],
  [BUILDING_TYPES.storagePit]: [
    'Toolworking',
    'LeatherArmorInfantry',
    'Metalworking',
    'ScaleArmorInfantry',
    'Metallurgy',
    'ChainmailInfantry',
    'BronzeShield',
    'IronShield',
  ],
  [BUILDING_TYPES.market]: ['Woodworking', 'GoldMining', 'StoneMining', 'Domestication'],
  [BUILDING_TYPES.granary]: ['ResearchWatchTower', 'ResearchSentryTower'],
}

export class AIStrategy {
  constructor(ai, difficulty = 'medium') {
    this.ai = ai
    this.difficulty = difficulty
    this.difficultyConfig = DIFFICULTIES[difficulty] || DIFFICULTIES.medium
    this.nextAge = NEXT_AGE
    this.maxVillagerPerAge = MAX_VILLAGER_PER_AGE
    this.villageTargetPercentageByAge = VILLAGE_TARGET_PERCENTAGE_BY_AGE
    this.maxBuildingByAge = MAX_BUILDING_BY_AGE
    this.maxInfantryByAge = { 0: 8, 1: 8, 2: 10, 3: 12 }
    this.maxArcherByAge = { 0: 0, 1: 4, 2: 6, 3: 8 }
    this.maxCavalryByAge = { 0: 0, 1: 3, 2: 4, 3: 5 }
    this.maxHopliteByAge = { 0: 0, 1: 0, 2: 2, 3: 4 }
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
    const { technologies } = this.ai
    if (technologies.includes('LongSword')) return 'LongSwordsman'
    if (technologies.includes('BroadSword')) return 'BroadSwordsman'
    if (technologies.includes('ShortSword')) return 'ShortSwordsman'
    if (technologies.includes('BattleAxe')) return 'Axeman'
    return 'Clubman'
  }

  getBestArcherUnit() {
    const { technologies } = this.ai
    if (technologies.includes('CompositeBow')) return 'CompositeBowman'
    if (technologies.includes('ImprovedBow')) return 'ImprovedBowman'
    return 'Bowman'
  }

  updatePhase(villagersCount, militaryCount) {
    const { ai, difficultyConfig } = this
    if (ai.phase === 'economy' && villagersCount >= difficultyConfig.econToMilVillagers) {
      ai.phase = 'military_build'
      return 'military_build'
    }
    if (ai.phase === 'military_build' && villagersCount < Math.floor(difficultyConfig.econToMilVillagers * 0.6)) {
      ai.phase = 'economy'
      return 'economy'
    }
    if (ai.phase === 'military_build' && militaryCount >= difficultyConfig.attackThreshold) {
      ai.phase = 'attack'
      return 'attack'
    }
    if (ai.phase === 'attack' && militaryCount < Math.ceil(difficultyConfig.attackThreshold * 0.4)) {
      ai.phase = 'military_build'
      return 'military_build'
    }
    return ai.phase
  }

  handleMilitaryActions(options) {
    return this.military.handleActions(options)
  }

  getEconomicDemand() {
    const { ai } = this
    const demand = { food: 0, wood: 0, gold: 0, stone: 0 }
    const nextAgeKey = ai.age + 1
    const ageUpCosts = { 1: { food: 500 }, 2: { food: 800 }, 3: { food: 1000, gold: 800 } }
    const nextAgeCost = ageUpCosts[nextAgeKey]
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
    if (ai.phase !== 'economy' && !ai.buildings.some(building => building.type === BUILDING_TYPES.barracks)) {
      demand.wood += ai.config.buildings[BUILDING_TYPES.barracks]?.cost?.wood || 0
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

    actions += this.buyUnits(villagers.length, maxVillagers, towncenters, UNIT_TYPES.villager, undefined, reserve, debug)
    actions += this.buyUnits(infantry.length, maxInfantry, barracks, infantryUnit, undefined, reserve, debug)
    actions += this.buyUnits(archers.length, maxArcher, archeryRanges, archerUnit, undefined, reserve, debug)
    actions += this.buyUnits(cavalry.length, maxCavalry, stables, 'Scout', undefined, reserve, debug)
    actions += this.buyUnits(hoplites.length, maxHoplite, academies, 'Hoplite', undefined, reserve, debug)
    return actions
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
      archeryRanges,
      stables,
      academies,
      watchTowers,
      sentryTowers,
      notBuiltHouses,
    } = snapshot

    const buildingsByType = {
      [BUILDING_TYPES.house]: houses,
      [BUILDING_TYPES.farm]: farms,
      [BUILDING_TYPES.barracks]: barracks,
      [BUILDING_TYPES.granary]: granarys,
      [BUILDING_TYPES.storagePit]: storagepits,
      [BUILDING_TYPES.market]: markets,
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

    if (
      buy(ai.population + 2 > ai.population_max && !notBuiltHouses.length, BUILDING_TYPES.house, () =>
        getPositionInGridAroundInstance(towncenters[0], map.grid, [6, 10], 0)
      )
    )
      actions++

    if (
      buy(ai.phase !== 'economy', BUILDING_TYPES.barracks, () =>
        getPositionInGridAroundInstance(towncenters[0], map.grid, [6, 20], 1, false, isEnemyFacing(towncenters[0]))
      )
    )
      actions++

    if (
      buy(markets.length === 0, BUILDING_TYPES.market, () =>
        getPositionInGridAroundInstance(towncenters[0], map.grid, [6, 20], 1, false, isEnemyFacing(towncenters[0]))
      )
    )
      actions++

    if (
      buy(barracks.length > 0, BUILDING_TYPES.archeryRange, () =>
        getPositionInGridAroundInstance(towncenters[0], map.grid, [6, 20], 1, false, isEnemyFacing(towncenters[0]))
      )
    )
      actions++

    if (
      buy(barracks.length > 0, BUILDING_TYPES.stable, () =>
        getPositionInGridAroundInstance(towncenters[0], map.grid, [6, 20], 1, false, isEnemyFacing(towncenters[0]))
      )
    )
      actions++

    if (
      buy(
        stables.some(s => s.isBuilt),
        BUILDING_TYPES.academy,
        () =>
          getPositionInGridAroundInstance(towncenters[0], map.grid, [6, 20], 1, false, isEnemyFacing(towncenters[0]))
      )
    )
      actions++

    if (
      buy(true, BUILDING_TYPES.farm, () => {
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
        getPositionInGridAroundInstance(towncenters[0], map.grid, [6, 15], 2, false, isEnemyFacing(towncenters[0]))
      )
    )
      actions++

    if (
      buy(ai.technologies.includes('ResearchSentryTower'), BUILDING_TYPES.sentryTower, () =>
        getPositionInGridAroundInstance(towncenters[0], map.grid, [6, 15], 2, false, isEnemyFacing(towncenters[0]))
      )
    )
      actions++

    return actions
  }

  buyTechnology(buildingList, technologyType, debug = false) {
    let bought = 0
    for (const building of buildingList) {
      if (building && building.buyTechnology(technologyType)) {
        if (debug) console.log(`Buying ${technologyType} from ${building.type}`)
        bought++
      }
    }
    return bought
  }

  handleTechnologyActions(snapshot, debug = false) {
    const { ai } = this
    const { maxVillagers, towncenters, barracks, archeryRanges, storagepits, markets, granarys } = snapshot
    let actions = 0

    const ageUpCosts = { 1: { food: 500 }, 2: { food: 800 }, 3: { food: 1000, gold: 800 } }
    const ageUpBuffers = { 1: { food: 200 }, 2: { food: 200 }, 3: { food: 200, gold: 200 } }
    const nextAgeKey = ai.age + 1
    if (ai.nextAge[nextAgeKey]) {
      const cost = ageUpCosts[nextAgeKey] || {}
      const buffer = ageUpBuffers[nextAgeKey] || {}
      const popReady = ai.population >= Math.floor(maxVillagers * 0.8)
      const resReady = Object.entries(cost).every(([res, amount]) => ai[res] >= amount + (buffer[res] || 0))
      if (popReady && resReady) {
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
