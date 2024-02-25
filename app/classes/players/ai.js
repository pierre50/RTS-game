import { Player } from './player'

import {
  getPlainCellsAroundPoint,
  getValuePercentage,
  getPositionInGridAroundInstance,
  getClosestInstance,
  instancesDistance,
  getCellsAroundPoint,
} from '../../lib'

export class AI extends Player {
  constructor({ i, j, age, civ, color, isPlayed = false }, context) {
    super({ i, j, age, civ, color, type: 'AI', isPlayed }, context)
    this.foundedTrees = []
    this.foundedBerrybushs = []
    this.foundedEnemyBuildings = []
    this.interval = setInterval(() => this.step(), 4000)
    this.selectedUnits = []
    this.selectedUnit = null
    this.selectedBuilding = null
    this.selectedOther = null
    this.distSpread = 1
    this.cellViewed = 0
  }

  step() {
    const {
      context: { map },
    } = this

    const maxVillagers = 20
    const maxVillagersOnConstruction = 4
    const maxClubmans = 10
    const howManyVillagerBeforeBuyingABarracks = 10
    const howManySoldiersBeforeAttack = 5
    const villagers = this.units.filter(unit => unit.type === 'Villager' && unit.hitPoints > 0)
    const clubmans = this.units.filter(unit => unit.type === 'Clubman' && unit.hitPoints > 0)
    const towncenters = this.buildings.filter(building => building.type === 'TownCenter')
    const storagepits = this.buildings.filter(building => building.type === 'StoragePit')
    const granarys = this.buildings.filter(building => building.type === 'Granary')
    const barracks = this.buildings.filter(building => building.type === 'Barracks')
    const notBuiltBuildings = this.buildings.filter(
      building => !building.isBuilt || (building.hitPoints > 0 && building.hitPoints < building.totalHitPoints)
    )
    const notBuiltHouses = notBuiltBuildings.filter(building => building.type === 'House')
    const builderVillagers = villagers.filter(villager => !villager.inactif && villager.work === 'builder')
    const villagersOnWood = villagers.filter(villager => !villager.inactif && villager.work === 'woodcutter')
    const villagersOnFood = villagers.filter(villager => !villager.inactif && villager.work === 'forager')
    const inactifVillagers = villagers.filter(villager => villager.inactif && villager.action !== 'attack')
    const inactifClubmans = clubmans.filter(
      clubman => clubman.inactif && clubman.action !== 'attack' && clubman.assault
    )
    const waitingClubmans = clubmans.filter(
      clubman => clubman.inactif && clubman.action !== 'attack' && !clubman.assault
    )
    const maxVillagersOnWood = getValuePercentage(villagers.length, 30)
    const maxVillagersOnFood = getValuePercentage(villagers.length, 70)

    // Player loosing
    if (this.buildings.length === 0 && this.units.length === 0) {
      this.die()
      return
    }

    if (this.cellViewed <= map.totalCells) {
      getCellsAroundPoint(this.i, this.j, this.views, this.distSpread, cell => {
        const globalCell = map.grid[cell.i][cell.j]
        cell.has = globalCell.has
        if (globalCell.has) {
          if (
            globalCell.has.type === 'Tree' &&
            globalCell.has.quantity > 0 &&
            this.foundedTrees.indexOf(globalCell.has) === -1
          ) {
            this.foundedTrees.push(globalCell.has)
          }
          if (
            globalCell.has.type === 'Berrybush' &&
            globalCell.has.quantity > 0 &&
            this.foundedBerrybushs.indexOf(globalCell.has) === -1
          ) {
            this.foundedBerrybushs.push(globalCell.has)
          }
          if (
            globalCell.has.name === 'building' &&
            globalCell.has.hitPoints > 0 &&
            globalCell.has.owner.id !== this.id &&
            this.foundedEnemyBuildings.indexOf(globalCell.has) === -1
          ) {
            this.foundedEnemyBuildings.push(globalCell.has)
          }
        }

        if (!cell.viewed) {
          this.cellViewed++
          cell.viewed = true
        }
      })

      this.distSpread++
    }

    /**
     * Units action
     */
    // Look for food
    if (villagersOnFood.length <= maxVillagersOnFood && (towncenters.length || granarys.length)) {
      if (this.foundedBerrybushs.length) {
        for (let i = 0; i < Math.min(maxVillagersOnFood, inactifVillagers.length); i++) {
          const bush = getClosestInstance(inactifVillagers[i], this.foundedBerrybushs)
          inactifVillagers[i].sendToBerrybush(bush)
          // Build a granary close to it, if to far
          const closestTownCenter = getClosestInstance(bush, towncenters)
          const closestGranary = getClosestInstance(bush, granarys)
          if (
            instancesDistance(closestTownCenter, bush) > 6 &&
            (!instancesDistance(closestGranary, bush) || instancesDistance(closestGranary, bush) > 15)
          ) {
            const bushNeighbours = getPlainCellsAroundPoint(
              bush.i,
              bush.j,
              map.grid,
              2,
              cell => cell.has && cell.has.type === 'Berrybush'
            )
            if (bushNeighbours.length > 3) {
              const pos = getPositionInGridAroundInstance(bush, map.grid, [0, 6], 2)
              if (pos) {
                this.buyBuilding(pos.i, pos.j, 'Granary')
              }
            }
          }
        }
      }
    }
    // Look for wood
    if (villagersOnWood.length <= maxVillagersOnWood && (towncenters.length || storagepits.length)) {
      if (this.foundedTrees.length) {
        for (let i = 0; i < Math.min(maxVillagersOnWood, inactifVillagers.length); i++) {
          const tree = getClosestInstance(inactifVillagers[i], this.foundedTrees)
          inactifVillagers[i].sendToTree(tree)
          // Build a storagepit close to it, if to far
          const closestTownCenter = getClosestInstance(tree, towncenters)
          const closestStoragepit = getClosestInstance(tree, storagepits)
          if (
            instancesDistance(closestTownCenter, tree) > 6 &&
            (!instancesDistance(closestStoragepit, tree) || instancesDistance(closestStoragepit, tree) > 15)
          ) {
            const treeNeighbours = getPlainCellsAroundPoint(
              tree.i,
              tree.j,
              map.grid,
              2,
              cell => cell.has && cell.has.type === 'Tree'
            )
            if (treeNeighbours.length > 5) {
              const pos = getPositionInGridAroundInstance(tree, map.grid, [0, 6], 2)
              if (pos) {
                this.buyBuilding(pos.i, pos.j, 'StoragePit')
              }
            }
          }
        }
      }
    }
    // Send to construction
    if (notBuiltBuildings.length > 0) {
      for (let i = 0; i < notBuiltBuildings.length; i++) {
        if (builderVillagers.length >= maxVillagersOnConstruction) {
          break
        }
        const noWorkers = villagers.filter(
          villager => (villager.action !== 'attack' && villager.work !== 'builder') || villager.inactif
        )
        const villager = getClosestInstance(notBuiltBuildings[i], noWorkers)
        if (villager) {
          villager.sendToBuilding(notBuiltBuildings[i])
        }
      }
    }
    // Send clubman to attack
    if (waitingClubmans.length >= howManySoldiersBeforeAttack) {
      if (!this.foundedEnemyBuildings.length) {
        const targetIndex = randomRange(0, this.otherPlayers().length - 1)
        const target = this.otherPlayers()[targetIndex]
        const i = target.i + randomRange(-5, 5)
        const j = target.j + randomRange(-5, 5)
        if (map.grid[i] && map.grid[i][j]) {
          const cell = map.grid[i][j]
          for (let i = 0; i < waitingClubmans.length; i++) {
            waitingClubmans[i].assault = true
            waitingClubmans[i].sendTo(cell, 'attack')
          }
        }
      } else {
        for (let i = 0; i < waitingClubmans.length; i++) {
          waitingClubmans[i].sendTo(this.foundedEnemyBuildings[0], 'attack')
        }
      }
    }
    if (inactifClubmans.length) {
      if (this.foundedEnemyBuildings.length) {
        for (let i = 0; i < inactifClubmans.length; i++) {
          inactifClubmans[i].sendTo(this.foundedEnemyBuildings[0], 'attack')
        }
      }
    }
    /**
     * Units buying
     */
    // Buy villager
    if (villagers.length < maxVillagers) {
      for (let i = 0; i < maxVillagers - villagers.length; i++) {
        if (towncenters[i]) {
          towncenters[i].buyUnit('Villager')
        }
      }
    }
    // Buy clubman
    if (clubmans.length < maxClubmans) {
      for (let i = 0; i < maxClubmans - clubmans.length; i++) {
        if (barracks[i]) {
          barracks[i].buyUnit('Clubman')
        }
      }
    }

    /**
     * Building buying
     */
    // Buy a house
    if (this.population + 3 > this.populationMax && !notBuiltHouses.length) {
      const pos = getPositionInGridAroundInstance(towncenters[0], map.grid, [3, 12], 2)
      if (pos) {
        this.buyBuilding(pos.i, pos.j, 'House')
      }
    }
    // Buy a barracks
    if (villagers.length > howManyVillagerBeforeBuyingABarracks && barracks.length === 0) {
      const pos = getPositionInGridAroundInstance(towncenters[0], map.grid, [4, 20], 3, false, cell => {
        let isMiddle = true
        for (let i = 0; i < this.otherPlayers().length; i++) {
          if (
            instancesDistance(cell, this.otherPlayers()[i]) > instancesDistance(towncenters[0], this.otherPlayers()[i])
          ) {
            isMiddle = false
          }
        }
        return isMiddle
      })
      if (pos) {
        this.buyBuilding(pos.i, pos.j, 'Barracks')
      }
    }
  }

  die() {
    const {
      context: { players },
    } = this
    clearInterval(this.interval)
    players.splice(players.indexOf(this), 1)
  }
}
