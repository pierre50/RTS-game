import { Assets } from 'pixi.js'
import { canAfford, drawInstanceBlinkingSelection, payCost, uuidv4, getHexColor, updateObject } from '../../lib'
import { sound } from '@pixi/sound'
import { Building } from '../building'
import { Unit } from '../unit'

export class Player {
  constructor({ i, j, age, civ, color, type, isPlayed = false }, context) {
    this.name = 'player'
    this.context = context

    const { map } = context
    this.id = uuidv4()
    this.parent = map
    this.i = i
    this.j = j
    this.civ = civ
    this.age = age
    this.wood = 10000 //200
    this.food = 10000 //200
    this.stone = 10000 //150
    this.gold = 10000 //0
    this.type = type
    this.units = []
    this.buildings = []
    this.population = 0
    this.populationMax = 1000 - 4 //5
    this.color = color
    this.colorHex = getHexColor(color)
    this.isPlayed = isPlayed
    this.config = { ...Assets.cache.get('config') }
    this.hasBuilt = Object.keys(this.config.buildings).map(key => key) //[]
    this.technologies = []

    const cloneGrid = []
    for (let i = 0; i <= map.size; i++) {
      for (let j = 0; j <= map.size; j++) {
        if (cloneGrid[i] == null) {
          cloneGrid[i] = []
        }
        cloneGrid[i][j] = {
          i,
          j,
          has: null,
          viewBy: [],
          onViewed: () => {
            const {
              context: { menu, map },
            } = this
            if (this.isPlayed && !map.revealEverything) {
              menu.updateTerrainMiniMap(i, j)
            }
          },
          viewed: false,
        }
      }
    }
    this.views = cloneGrid
  }

  spawnBuilding(...args) {
    const building = this.createBuilding(...args)
    if (this.isPlayed) {
      let hasSentVillager = false

      for (let u = 0; u < this.selectedUnits.length; u++) {
        const unit = this.selectedUnits[u]
        if (unit.type === 'Villager') {
          hasSentVillager = true
          drawInstanceBlinkingSelection(building)
          unit.sendToBuilding(building)
        }
      }

      if (hasSentVillager) {
        sound.play('5118')
      }
    }

    return building
  }

  onAgeChange() {
    const {
      context: { players, menu },
    } = this
    if (this.isPlayed) {
      sound.play('5169')
    }
    for (let i = 0; i < this.buildings.length; i++) {
      const building = this.buildings[i]
      if (building.isBuilt && !building.isDead) {
        building.finalTexture()
      }
    }
    for (let i = 0; i < players.length; i++) {
      const player = players[i]
      if (player.type === 'Human') {
        if (player.selectedUnit && player.selectedUnit.owner === this) {
          menu.setBottombar(player.selectedUnit)
        } else if (player.selectedBuilding && player.selectedBuilding.owner === this) {
          menu.setBottombar(player.selectedBuilding)
        } else if (player.selectedOther && player.selectedOther.owner === this) {
          menu.setBottombar(player.selectedOther)
        }
      }
    }
  }

  otherPlayers() {
    const {
      context: { players },
    } = this
    const others = [...players]
    others.splice(players.indexOf(this), 1)
    return otrs
  }

  updateConfig(operations) {
    const {
      context: { menu },
    } = this
    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i]
      const types = Array.isArray(operation.type) ? operation.type : [operation.type]
      for (let j = 0; j < types.length; j++) {
        const type = types[j]
        if (Object.keys(this.config.buildings).includes(type)) {
          this.config.buildings[type] && updateObject(this.config.buildings[type], operation)
        } else if (Object.keys(this.config.units).includes(type)) {
          this.config.units[type] && updateObject(this.config.units[type], operation)
        }
        if (this.isPlayed && (this.selectedBuilding || this.selectedUnit)) {
          menu.setBottombar(this.selectedBuilding || this.selectedUnit)
        }
        /*for (let u = 0; u < this.units.length; u++) {
          const unit = this.units[u]
          unit.type === type && updateObject(unit, operation)
        }
        for (let u = 0; u < this.buildings.length; u++) {
          const building = this.buildings[u]
          building.type === type && updateObject(building, operation)
        }*/
      }
    }
  }

  buyBuilding(i, j, type) {
    const {
      context: { menu },
    } = this
    const config = this.config.buildings[type]
    if (canAfford(this, config.cost)) {
      this.spawnBuilding(i, j, type)
      payCost(this, config.cost)
      if (this.isPlayed) {
        menu.updateTopbar()
      }
      return true
    }
    return false
  }

  createUnit(i, j, type) {
    const { context } = this
    let unit = new Unit({ i, j, type, owner: this }, context)
    this.units.push(unit)
    context.menu.updatePlayerMiniMap(this)
    return unit
  }

  createBuilding(i, j, type, isBuilt = false) {
    const { context } = this
    const building = new Building({ i, j, owner: this, type, isBuilt }, context)
    this.buildings.push(building)
    context.menu.updatePlayerMiniMap(this)
    return building
  }
}
