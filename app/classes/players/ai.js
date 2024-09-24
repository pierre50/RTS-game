import { Player } from './player'

import {
  getPlainCellsAroundPoint,
  getValuePercentage,
  getPositionInGridAroundInstance,
  getClosestInstance,
  instancesDistance,
  getCellsAroundPoint,
} from '../../lib'

const styleLogInfo1 = 'background: #00ff00; color: #ffff00'
const styleLogInfo2 = 'background: #222; color: #ff0000'

export class AI extends Player {
  constructor({ ...props }, context) {
    super({ ...props, isPlayed: false, type: 'AI' }, context)
    this.foundedTrees = []
    this.foundedBerrybushs = []
    this.foundedGolds = []
    this.foundedStones = []
    this.foundedEnemyBuildings = []
    this.interval = setInterval(() => this.step(), 4000)
    this.selectedUnits = []
    this.selectedUnit = null
    this.selectedBuilding = null
    this.selectedOther = null
    this.distSpread = 1
    this.cellViewed = 0

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
      },
      1: {
        StoragePit: 2,
        Granary: 2,
        Farm: 4,
      },
      2: {
        StoragePit: 3,
        Granary: 3,
        Farm: 6,
      },
      3: {
        StoragePit: 4,
        Granary: 4,
        Farm: 10,
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

  getUnitExtraOptions(type) {
    const me = this
    return {
      handleSetDest: target => {
        const { map } = me.context
        if (type === 'Villager' && target.family === 'resource') {
          const buildingType = target.type === 'Berrybush' ? 'Granary' : 'StoragePit'
          const buildings = me.buildingsByTypes([buildingType])
          if (me.hasNotReachBuildingLimit(buildingType, buildings)) {
            const closestBuilding = getClosestInstance(target, [...buildings, ...me.buildingsByTypes(['TownCenter'])])
            if (!closestBuilding || instancesDistance(closestBuilding, target) > 5) {
              const pos = getPositionInGridAroundInstance(target, map.grid, [1, 5], 1)
              if (pos && me.buyBuilding(pos.i, pos.j, buildingType)) {
                console.log(`Building ${buildingType} at: ${pos}`)
              }
            }
          }
        }
      },
    }
  }

  step() {
    const { map, paused } = this.context
    if (paused) {
      return
    }

    const maxVillagers = this.maxVillagerPerAge[this.age]
    const maxVillagersOnConstruction = 4
    const maxClubmans = 0 //10
    const howManyVillagerBeforeBuyingABarracks = 10
    const howManySoldiersBeforeAttack = 5

    console.log('%c ----Step started', styleLogInfo1)

    console.log(
      `%c Age: ${this.age}, Wood: ${this.wood}, Food: ${this.food}, Stone: ${this.stone}, Gold: ${this.gold}, Population: ${this.population}/${this.populationMax}`,
      styleLogInfo2
    )

    const filterUnitsByType = (type, condition = unit => unit.hitPoints > 0) =>
      this.units.filter(unit => unit.type === type && condition(unit))

    const villagers = filterUnitsByType('Villager')
    const clubmans = filterUnitsByType('Clubman')

    console.log(
      `%c Villagers: ${villagers.length}/${maxVillagers}, Clubmans: ${clubmans.length}/${maxClubmans}`,
      styleLogInfo2
    )

    const towncenters = this.buildingsByTypes(['TownCenter'])
    const storagepits = this.buildingsByTypes(['StoragePit'])
    const houses = this.buildingsByTypes(['House'])
    const granarys = this.buildingsByTypes(['Granary'])
    const barracks = this.buildingsByTypes(['Barracks'])
    const markets = this.buildingsByTypes(['Market'])
    const farms = this.buildingsByTypes(['Farm'])
    const emptyFarms = farms.filter(({ isUsedBy }) => !isUsedBy)

    console.log(
      `%c Towncenters: ${towncenters.length}, Houses: ${houses.length}, StoragePits: ${storagepits.length}, Granaries: ${granarys.length}, Barracks: ${barracks.length}, Markets: ${markets}`,
      styleLogInfo2
    )

    const notBuiltBuildings = this.buildings.filter(
      b => !b.isBuilt || (b.hitPoints > 0 && b.hitPoints < b.totalHitPoints)
    )
    const notBuiltHouses = notBuiltBuildings.filter(b => b.type === 'House')

    const villagersByWork = works => villagers.filter(v => !v.inactif && works.includes(v.work))
    const inactifVillagers = villagers.filter(v => v.inactif && v.action !== 'attack')

    const villagersOnWood = villagersByWork(['woodcutter'])
    const villagersOnFood = villagersByWork(['forager', 'farmer', 'hunter'])
    const villagersOnGold = villagersByWork(['goldminer'])
    const villagersOnStone = villagersByWork(['stoneminer'])
    const builderVillagers = villagersByWork(['builder'])

    const maxVillagersOnWood = getValuePercentage(villagers.length, this.villageTargetPercentageByAge[this.age]['wood'])
    const maxVillagersOnFood = getValuePercentage(villagers.length, this.villageTargetPercentageByAge[this.age]['food'])
    const maxVillagersOnGold = getValuePercentage(villagers.length, this.villageTargetPercentageByAge[this.age]['gold'])
    const maxVillagersOnStone = getValuePercentage(
      villagers.length,
      this.villageTargetPercentageByAge[this.age]['stone']
    )

    console.log(
      `%c Villagers on Wood: ${villagersOnWood.length}/${maxVillagersOnWood}, Villagers on Food: ${villagersOnFood.length}/${maxVillagersOnFood}, Villagers on Stone: ${villagersOnStone.length}/${maxVillagersOnStone}, Villagers on Gold: ${villagersOnGold.length}/${maxVillagersOnGold}, Builder Villagers: ${builderVillagers.length}`,
      styleLogInfo2
    )

    const inactifClubmans = clubmans.filter(c => c.inactif && c.action !== 'attack' && c.assault)
    const waitingClubmans = clubmans.filter(c => c.inactif && c.action !== 'attack' && !c.assault)

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

    // Cell Viewing Logic
    if (this.cellViewed <= map.totalCells) {
      getCellsAroundPoint(this.i, this.j, this.views, this.distSpread, cell => {
        const globalCell = map.grid[cell.i][cell.j]
        cell.has = globalCell.has
        if (globalCell.has) {
          const { has } = globalCell
          if (has.quantity > 0) {
            if (has.type === 'Tree' && !this.foundedTrees.includes(has)) {
              this.foundedTrees.push(has)
            }
            if (has.type === 'Berrybush' && !this.foundedBerrybushs.includes(has)) {
              this.foundedBerrybushs.push(has)
            }
            if (has.type === 'Stone' && !this.foundedStones.includes(has)) {
              this.foundedStones.push(has)
            }
            if (has.type === 'Gold' && !this.foundedGolds.includes(has)) {
              this.foundedGolds.push(has)
            }
          }
          if (has.family === 'building' && has.owner.name !== this.name && !this.foundedEnemyBuildings.includes(has)) {
            this.foundedEnemyBuildings.push(has)
          }
        }
        if (!cell.viewed) {
          this.cellViewed++
          cell.viewed = true
        }
      })
      this.distSpread++
    }

    // Utility function to assign villagers to resources
    const assignVillagersToResource = (villagers, resourceList, maxVillagers, actionCallback) => {
      if (resourceList.length) {
        if (villagers.length < maxVillagers) {
          for (let i = 0; i < Math.min(maxVillagers, inactifVillagers.length); i++) {
            const resource = getClosestInstance(inactifVillagers[i], resourceList)
            actionCallback(inactifVillagers[i], resource)
          }
        } else {
          for (let i = 0; i < villagers.length - maxVillagers; i++) {
            villagers[i].stop()
          }
        }
      } else {
        for (let i = 0; i < villagers.length; i++) {
          villagers[i].stop()
        }
      }
    }

    // Food Gathering Logic
    assignVillagersToResource(villagersOnFood, this.foundedBerrybushs, maxVillagersOnFood, (villager, bush) => {
      villager.sendToBerrybush(bush)
    })

    // Wood Gathering Logic
    assignVillagersToResource(villagersOnWood, this.foundedTrees, maxVillagersOnWood, (villager, tree) => {
      villager.sendToTree(tree)
    })

    // Stone Gathering Logic
    assignVillagersToResource(villagersOnStone, this.foundedStones, maxVillagersOnStone, (villager, stone) => {
      villager.sendToStone(stone)
    })

    // Gold Gathering Logic
    assignVillagersToResource(villagersOnGold, this.foundedGolds, maxVillagersOnGold, (villager, gold) => {
      villager.sendToGold(gold)
    })

    for (let i = 0; i < emptyFarms.length; i++) {
      const villager = getClosestInstance(emptyFarms[i], inactifVillagers)
      villager && villager.sendToFarm(emptyFarms[i])
    }

    // Construction Logic
    if (notBuiltBuildings.length) {
      for (const building of notBuiltBuildings) {
        if (builderVillagers.length >= maxVillagersOnConstruction) break
        const availableVillagers = villagers.filter(v => v.work !== 'builder' || v.inactif)
        const villager = getClosestInstance(building, availableVillagers)
        if (villager) {
          console.log('Villager sent to build:', building)
          villager.sendToBuilding(building)
        }
      }
    }

    // Attack Logic
    const sendToAttack = (clubmans, target) => {
      console.log('Sending clubmans to attack:', target)
      clubmans.forEach(clubman => clubman.sendTo(target, 'attack'))
    }

    if (waitingClubmans.length >= howManySoldiersBeforeAttack) {
      const target =
        this.foundedEnemyBuildings[0] ||
        map.grid[randomRange(0, map.grid.length - 1)][randomRange(0, map.grid[0].length - 1)]
      console.log('Clubman attack target:', target)
      sendToAttack(waitingClubmans, target)
    }

    if (inactifClubmans.length && this.foundedEnemyBuildings.length) {
      console.log('Inactif clubmans attacking founded enemy building...')
      sendToAttack(inactifClubmans, this.foundedEnemyBuildings[0])
    }

    // Unit Purchasing Logic
    const buyUnits = (currentCount, maxCount, buildingList, unitType, extra) => {
      // Calculate how many more units can be bought
      const unitsNeeded = maxCount - currentCount
      let unitsBought = 0

      if (unitsNeeded <= 0) {
        return
      }
      // Iterate over the buildings until we reach the needed count
      for (const building of buildingList) {
        if (unitsBought >= unitsNeeded) break // Stop if we've bought enough units

        if (building && building.buyUnit(unitType, false, false, extra)) {
          unitsBought++
          console.log(`Buying ${unitType} from ${building.type}, Total Bought: ${unitsBought}`)
        }
      }
    }

    buyUnits(villagers.length, maxVillagers, towncenters, 'Villager')
    buyUnits(clubmans.length, maxClubmans, barracks, 'Clubman')

    // Building Purchasing Logic
    const buyBuildingIfNeeded = (condition, buildingType, positionCallback) => {
      if (condition) {
        const pos = positionCallback()
        if (pos && this.buyBuilding(pos.i, pos.j, buildingType)) {
          console.log(`Buying building: ${buildingType} at position:`, pos)
        }
      }
    }

    // Buy House
    buyBuildingIfNeeded(this.population + 2 > this.populationMax && !notBuiltHouses.length, 'House', () =>
      getPositionInGridAroundInstance(towncenters[0], map.grid, [6, 10], 0)
    )

    // Buy Barracks
    buyBuildingIfNeeded(
      villagers.length > howManyVillagerBeforeBuyingABarracks && barracks.length === 0,
      'Barracks',
      () =>
        getPositionInGridAroundInstance(towncenters[0], map.grid, [6, 20], 1, false, cell =>
          this.otherPlayers().every(
            player => instancesDistance(cell, player) <= instancesDistance(towncenters[0], player)
          )
        )
    )

    // Buy Markets
    buyBuildingIfNeeded(markets.length === 0, 'Market', () =>
      getPositionInGridAroundInstance(towncenters[0], map.grid, [6, 20], 1, false, cell =>
        this.otherPlayers().every(
          player => instancesDistance(cell, player) <= instancesDistance(towncenters[0], player)
        )
      )
    )

    // Buy Farm
    buyBuildingIfNeeded(this.hasNotReachBuildingLimit('Farm', farms), 'Farm', () => {
      const buildings = [...granarys, ...towncenters] // Combine both granarys and towncenters

      for (const building of buildings) {
        // Try to find a valid position around each building
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

        if (position) {
          return position // If a valid position is found, return and break the loop
        }
      }

      return null // If no valid position is found after looping through all buildings
    })

    // Unit Purchasing Logic
    const buyTechnology = (buildingList, technologyType) => {
      // Iterate over the buildings until we reach the needed count
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
