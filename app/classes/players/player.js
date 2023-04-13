import { Assets } from 'pixi.js'
import * as buildings from '../buildings'
import * as units from '../units'
import { canAfford, drawInstanceBlinkingSelection, payCost, uuidv4, getHexColor } from '../../lib'

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
    this.populationMax = 1000 //5
    this.color = color
    this.colorHex = getHexColor(color)
    this.isPlayed = isPlayed
    this.hasBuilt = Object.keys(buildings) //[]
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
              context: { menu },
            } = this
            if (this.isPlayed) {
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
      for (let u = 0; u < this.selectedUnits.length; u++) {
        const unit = this.selectedUnits[u]
        if (unit.type === 'Villager') {
          drawInstanceBlinkingSelection(building)
          unit.sendToBuilding(building)
        }
      }
    }

    return building
  }

  onAgeChange() {
    const {
      context: { players, menu },
    } = this
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
    const others = [...this.parent.players]
    others.splice(this.parent.players.indexOf(this), 1)
    return others
  }

  buyBuilding(i, j, type) {
    const {
      context: { menu },
    } = this
    const config = Assets.cache.get('config').buildings[type]
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
    const unit = new units[type]({ i, j, owner: this }, context)
    this.units.push(unit)
    context.menu.updatePlayerMiniMap(this)
    return unit
  }

  createBuilding(i, j, type, isBuilt = false) {
    const { context } = this
    const building = new buildings[type]({ i, j, owner: this, isBuilt }, context)
    this.buildings.push(building)
    context.menu.updatePlayerMiniMap(this)
    return building
  }
}
