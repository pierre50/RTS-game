import { Player } from './player'

import {
  getValuePercentage,
  getPositionInGridAroundInstance,
  getClosestInstance,
  instancesDistance,
  canAfford,
  randomRange,
} from '../../lib'
import {
  WORK_TYPES,
  ACTION_TYPES,
  FAMILY_TYPES,
  PLAYER_TYPES,
  UNIT_TYPES,
  BUILDING_TYPES,
  RESOURCE_TYPES,
} from '../../constants'

const styleLogInfo1 = 'background: #00ff00; color: #ffff00'
const styleLogInfo2 = 'background: #222; color: #ff0000'

export class AI extends Player {
  constructor({ ...props }, context) {
    super({ ...props, isPlayed: false, type: PLAYER_TYPES.ai }, context)
    this.foundedTrees = new Set()
    this.foundedBerrybushs = new Set()
    this.foundedGolds = new Set()
    this.foundedStones = new Set()
    this.foundedEnemyBuildings = new Set()
    this.foundedEnemyUnits = new Set()
    this.interval = setInterval(() => this.step(), 4000)
    this.selectedUnits = []
    this.selectedUnit = null
    this.selectedBuilding = null
    this.selectedOther = null
    this.scout = null

    this.nextAge = {
      1: 'ToolAge',
      2: 'BronzeAge',
      3: 'IronAge',
    }
    this.maxVillagerPerAge = {
      0: 16,
      1: 24,
      2: 40,
      3: 50,
    }
    this.villageTargetPercentageByAge = {
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
    this.maxBuildingByAge = {
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
      },
      2: {
        StoragePit: 3,
        Granary: 3,
        Farm: 6,
        Barracks: 2,
        Market: 1,
      },
      3: {
        StoragePit: 4,
        Granary: 4,
        Farm: 10,
        Barracks: 2,
        Market: 1,
      },
    }
  }

  hasNotReachBuildingLimit(buildingType, buildings) {
    return (
      !this.maxBuildingByAge[this.age][buildingType] || buildings.length < this.maxBuildingByAge[this.age][buildingType]
    )
  }

  buildingsByTypes(types) {
    return this.buildings.filter(b => types.includes(b.type))
  }

  // Remove depleted resources and destroyed buildings from tracked Sets
  cleanupSets() {
    for (const r of this.foundedTrees) {
      if (r.quantity <= 0 || r.isDead) this.foundedTrees.delete(r)
    }
    for (const r of this.foundedBerrybushs) {
      if (r.quantity <= 0 || r.isDead) this.foundedBerrybushs.delete(r)
    }
    for (const r of this.foundedStones) {
      if (r.quantity <= 0 || r.isDead) this.foundedStones.delete(r)
    }
    for (const r of this.foundedGolds) {
      if (r.quantity <= 0 || r.isDead) this.foundedGolds.delete(r)
    }
    for (const b of this.foundedEnemyBuildings) {
      if (b.isDead || b.isDestroyed) this.foundedEnemyBuildings.delete(b)
    }
    for (const u of this.foundedEnemyUnits) {
      if (u.isDead || u.isDestroyed || u.hitPoints <= 0) this.foundedEnemyUnits.delete(u)
    }
  }

  getUnitExtraOptions(type) {
    const me = this
    return {
      handleSetDest: target => {
        const { map } = me.context
        if (type === UNIT_TYPES.villager && target.family === FAMILY_TYPES.resource) {
          const buildingType =
            target.type === RESOURCE_TYPES.berrybush ? BUILDING_TYPES.granary : BUILDING_TYPES.storagePit
          const buildings = me.buildingsByTypes([buildingType])
          if (
            canAfford(me, me.config.buildings[buildingType]) &&
            me.hasNotReachBuildingLimit(buildingType, buildings)
          ) {
            const closestBuilding = getClosestInstance(target, [
              ...buildings,
              ...me.buildingsByTypes([BUILDING_TYPES.townCenter]),
            ])
            if (!closestBuilding || instancesDistance(closestBuilding, target) > 5) {
              const pos = getPositionInGridAroundInstance(target, map.grid, [1, 5], 1)
              if (pos && me.buyBuilding(pos.i, pos.j, buildingType)) {
                console.log(`Building ${buildingType} at:`, pos)
              }
            }
          }
        }
      },
    }
  }

  step() {
    const { map, paused } = this.context
    if (paused) return

    const maxVillagers = this.maxVillagerPerAge[this.age]
    const maxVillagersOnConstruction = 4
    const maxClubmans = 10
    const howManyVillagerBeforeBuyingABarracks = 10
    const howManySoldiersBeforeAttack = 5

    console.log('%c ----Step started', styleLogInfo1)
    console.log(
      `%c Age: ${this.age}, Wood: ${this.wood}, Food: ${this.food}, Stone: ${this.stone}, Gold: ${this.gold}, Population: ${this.population}/${this.population_max}`,
      styleLogInfo2
    )

    const filterUnitsByType = (type, condition = unit => unit.hitPoints > 0) =>
      this.units.filter(unit => unit.type === type && condition(unit))

    const villagers = filterUnitsByType(UNIT_TYPES.villager)
    const clubmans = filterUnitsByType(UNIT_TYPES.clubman)

    console.log(
      `%c Villagers: ${villagers.length}/${maxVillagers}, Clubmans: ${clubmans.length}/${maxClubmans}`,
      styleLogInfo2
    )

    const towncenters = this.buildingsByTypes([BUILDING_TYPES.townCenter])
    const storagepits = this.buildingsByTypes([BUILDING_TYPES.storagePit])
    const houses = this.buildingsByTypes([BUILDING_TYPES.house])
    const granarys = this.buildingsByTypes([BUILDING_TYPES.granary])
    const barracks = this.buildingsByTypes([BUILDING_TYPES.barracks])
    const markets = this.buildingsByTypes([BUILDING_TYPES.market])
    const farms = this.buildingsByTypes([BUILDING_TYPES.farm])
    const emptyFarms = farms.filter(({ isUsedBy }) => !isUsedBy)

    console.log(
      `%c Towncenters: ${towncenters.length}, Houses: ${houses.length}, StoragePits: ${storagepits.length}, Granaries: ${granarys.length}, Barracks: ${barracks.length}, Markets: ${markets.length}`,
      styleLogInfo2
    )

    const notBuiltBuildings = this.buildings.filter(
      b => !b.isBuilt || (b.hitPoints > 0 && b.hitPoints < b.totalHitPoints)
    )
    const notBuiltHouses = notBuiltBuildings.filter(b => b.type === BUILDING_TYPES.house)

    const villagersByWork = works => villagers.filter(v => !v.inactif && works.includes(v.work))
    const inactifVillagers = villagers.filter(v => v.inactif && v.action !== ACTION_TYPES.attack)

    // Split food workers by type to avoid stopping farmers when berries run out
    const villagersForaging = villagersByWork([WORK_TYPES.forager])
    const villagersFarming = villagersByWork([WORK_TYPES.farmer])
    const villagersHunting = villagersByWork([WORK_TYPES.hunter])
    const villagersOnFood = [...villagersForaging, ...villagersFarming, ...villagersHunting]
    const villagersOnWood = villagersByWork([WORK_TYPES.woodcutter])
    const villagersOnGold = villagersByWork([WORK_TYPES.goldminer])
    const villagersOnStone = villagersByWork([WORK_TYPES.stoneminer])
    const builderVillagers = villagersByWork([WORK_TYPES.builder])

    const maxVillagersOnFood = getValuePercentage(villagers.length, this.villageTargetPercentageByAge[this.age]['food'])
    const maxVillagersOnWood = getValuePercentage(villagers.length, this.villageTargetPercentageByAge[this.age]['wood'])
    const maxVillagersOnGold = getValuePercentage(villagers.length, this.villageTargetPercentageByAge[this.age]['gold'])
    const maxVillagersOnStone = getValuePercentage(
      villagers.length,
      this.villageTargetPercentageByAge[this.age]['stone']
    )

    console.log(
      `%c Food: ${villagersOnFood.length}/${maxVillagersOnFood}, Wood: ${villagersOnWood.length}/${maxVillagersOnWood}, Stone: ${villagersOnStone.length}/${maxVillagersOnStone}, Gold: ${villagersOnGold.length}/${maxVillagersOnGold}, Builders: ${builderVillagers.length}`,
      styleLogInfo2
    )

    // Soldiers: those already on assault vs those waiting at base
    const inactifClubmans = clubmans.filter(c => c.inactif && c.action !== ACTION_TYPES.attack && c.assault)
    const waitingClubmans = clubmans.filter(c => c.inactif && c.action !== ACTION_TYPES.attack && !c.assault)

    console.log(
      `%c Inactif Clubmans: ${inactifClubmans.length}, Waiting Clubmans: ${waitingClubmans.length}`,
      styleLogInfo2
    )

    // Player losing condition
    if (!this.buildings.length && !this.units.length) {
      console.log('Player has no buildings and units. Dying...')
      this.die()
      return
    }

    // Remove depleted resources and destroyed enemies from tracked sets
    this.cleanupSets()

    // Scout logic: one villager explores the map incrementally.
    // Resources and enemies are discovered naturally through unit sight (updateAIKnowledge in grid.js).
    if (!this.scout || this.scout.isDead || this.scout.hitPoints <= 0) {
      this.scout = inactifVillagers[0] || null
    }
    if (this.scout && this.scout.inactif) {
      // explore() finds the nearest unviewed cell (radius 50) — short path, A* always succeeds
      this.scout.explore()
    }

    // Mutable pool of idle villagers — scout excluded so it doesn't get reassigned to gather
    let availableVillagers = inactifVillagers.filter(v => v !== this.scout)

    // Assign villagers from the available pool to a resource type.
    // Stops excess workers and fills shortfall from the available pool.
    const assignVillagersToResource = (villagersOnResource, resourceList, maxVillagers, actionCallback) => {
      // Stop workers above quota
      for (let i = maxVillagers; i < villagersOnResource.length; i++) {
        villagersOnResource[i].stop()
      }
      if (resourceList.size === 0) return
      const needed = Math.max(0, maxVillagers - villagersOnResource.length)
      const toAssign = Math.min(needed, availableVillagers.length)
      for (let i = 0; i < toAssign; i++) {
        const villager = availableVillagers.shift()
        const resource = getClosestInstance(villager, resourceList)
        actionCallback(villager, resource)
      }
    }

    // Food: berries first
    assignVillagersToResource(villagersForaging, this.foundedBerrybushs, maxVillagersOnFood, (villager, bush) => {
      villager.sendToBerrybush(bush)
    })

    // Wood
    assignVillagersToResource(villagersOnWood, this.foundedTrees, maxVillagersOnWood, (villager, tree) => {
      villager.sendToTree(tree)
    })

    // Food fallback: send to empty farms when berries aren't covering the quota
    const foodShortfall = Math.max(0, maxVillagersOnFood - villagersOnFood.length)
    for (let i = 0; i < emptyFarms.length && i < foodShortfall && availableVillagers.length > 0; i++) {
      const villager = availableVillagers.shift()
      villager.sendToFarm(emptyFarms[i])
    }

    // Stone
    assignVillagersToResource(villagersOnStone, this.foundedStones, maxVillagersOnStone, (villager, stone) => {
      villager.sendToStone(stone)
    })

    // Gold
    assignVillagersToResource(villagersOnGold, this.foundedGolds, maxVillagersOnGold, (villager, gold) => {
      villager.sendToGold(gold)
    })

    // Construction
    if (notBuiltBuildings.length) {
      for (const building of notBuiltBuildings) {
        if (builderVillagers.length >= maxVillagersOnConstruction) break
        if (availableVillagers.length === 0) break
        const villager = getClosestInstance(building, availableVillagers)
        if (villager) {
          console.log('Villager sent to build:', building)
          villager.sendToBuilding(building)
          availableVillagers = availableVillagers.filter(v => v !== villager)
        }
      }
    }

    // Attack helpers
    const sendToAttack = (soldiers, target) => {
      console.log('Sending soldiers to attack:', target)
      soldiers.forEach(c => {
        c.assault = true
        c.sendTo(target, ACTION_TYPES.attack)
      })
    }

    // Pick the best enemy target (prefer TC, then any building)
    const getBestEnemyTarget = () =>
      [...this.foundedEnemyBuildings].find(b => b.type === BUILDING_TYPES.townCenter) ||
      this.foundedEnemyBuildings.values().next().value

    // Defensive reaction: enemy units spotted → send idle soldiers to defend
    if (this.foundedEnemyUnits.size > 0 && waitingClubmans.length > 0) {
      const enemyUnit = [...this.foundedEnemyUnits].find(u => u.hitPoints > 0)
      if (enemyUnit) {
        console.log('Enemy units spotted! Defending...')
        sendToAttack(waitingClubmans, enemyUnit)
      }
    }

    // Attack wave: enough soldiers accumulated → launch assault
    if (waitingClubmans.length >= howManySoldiersBeforeAttack) {
      const target =
        getBestEnemyTarget() ||
        map.grid[randomRange(0, map.grid.length - 1)][randomRange(0, map.grid[0].length - 1)]
      console.log('Launching attack wave! Target:', target)
      sendToAttack(waitingClubmans, target)
    }

    // Soldiers that finished an assault → redirect to next enemy building
    if (inactifClubmans.length && this.foundedEnemyBuildings.size) {
      const target = getBestEnemyTarget()
      if (target) {
        console.log('Redirecting assault soldiers to:', target)
        sendToAttack(inactifClubmans, target)
      }
    }

    // Unit Purchasing
    const buyUnits = (currentCount, maxCount, buildingList, unitType, extra) => {
      const unitsNeeded = maxCount - currentCount
      let unitsBought = 0
      if (unitsNeeded <= 0) return
      for (const building of buildingList) {
        if (unitsBought >= unitsNeeded) break
        if (building && building.buyUnit(unitType, false, false, extra)) {
          unitsBought++
          console.log(`Buying ${unitType} from ${building.type}, Total Bought: ${unitsBought}`)
        }
      }
    }

    buyUnits(villagers.length, maxVillagers, towncenters, UNIT_TYPES.villager)
    buyUnits(clubmans.length, maxClubmans, barracks, UNIT_TYPES.clubman)

    // Building Purchasing
    const buyBuildingIfNeeded = (condition, buildingType, positionCallback) => {
      const list = {
        House: houses,
        Farm: farms,
        Barracks: barracks,
        Granary: granarys,
        StoragePit: storagepits,
        Market: markets,
      }
      const building = this.config.buildings[buildingType]
      if (
        condition &&
        canAfford(this, building.cost) &&
        this.hasNotReachBuildingLimit(buildingType, list[buildingType])
      ) {
        const pos = positionCallback()
        if (pos && this.buyBuilding(pos.i, pos.j, buildingType)) {
          console.log(`Buying building: ${buildingType} at position:`, pos)
        }
      }
    }

    // House
    buyBuildingIfNeeded(this.population + 2 > this.population_max && !notBuiltHouses.length, BUILDING_TYPES.house, () =>
      getPositionInGridAroundInstance(towncenters[0], map.grid, [6, 10], 0)
    )

    // Barracks
    buyBuildingIfNeeded(villagers.length > howManyVillagerBeforeBuyingABarracks, BUILDING_TYPES.barracks, () =>
      getPositionInGridAroundInstance(towncenters[0], map.grid, [6, 20], 1, false, cell =>
        this.otherPlayers().every(
          player => instancesDistance(cell, player) <= instancesDistance(towncenters[0], player)
        )
      )
    )

    // Market
    buyBuildingIfNeeded(markets.length === 0, BUILDING_TYPES.market, () =>
      getPositionInGridAroundInstance(towncenters[0], map.grid, [6, 20], 1, false, cell =>
        this.otherPlayers().every(
          player => instancesDistance(cell, player) <= instancesDistance(towncenters[0], player)
        )
      )
    )

    // Farm
    buyBuildingIfNeeded(true, BUILDING_TYPES.farm, () => {
      const buildings = [...granarys, ...towncenters]
      for (const building of buildings) {
        const position = getPositionInGridAroundInstance(
          building,
          map.grid,
          [2, 10],
          2,
          false,
          cell =>
            this.otherPlayers().every(player => instancesDistance(cell, player) <= instancesDistance(building, player)),
          false
        )
        if (position) return position
      }
      return null
    })

    // Tech / Age Up
    const buyTechnology = (buildingList, technologyType) => {
      for (const building of buildingList) {
        if (building && building.buyTechnology(technologyType)) {
          console.log(`Buying ${technologyType} from ${building.type}`)
        }
      }
    }
    if (this.nextAge[this.age + 1]) {
      buyTechnology(towncenters, this.nextAge[this.age + 1])
    }

    console.log('%c ----Step ended', styleLogInfo1)
  }

  die() {
    const {
      context: { players },
    } = this
    clearInterval(this.interval)
    players.splice(players.indexOf(this), 1)
  }
}
