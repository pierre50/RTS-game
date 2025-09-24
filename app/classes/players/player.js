import { Assets } from 'pixi.js'
import {
  canAfford,
  drawInstanceBlinkingSelection,
  payCost,
  uuidv4,
  getHexColor,
  updateObject,
  getActionCondition,
  canUpdateMinimap,
  isValidCondition,
} from '../../lib'
import { sound } from '@pixi/sound'
import { Building } from '../building'
import { Unit } from '../unit'
import { ACTION_TYPES, FAMILY_TYPES, PLAYER_TYPES, POPULATION_MAX, UNIT_TYPES } from '../../constants'

export class Player {
  constructor(options, context) {
    this.family = FAMILY_TYPES.player
    this.context = context

    const { map } = context
    this.label = uuidv4()
    this.parent = map

    this.wood = map.devMode ? 10000 : 200
    this.food = map.devMode ? 10000 : 200
    this.stone = map.devMode ? 10000 : 150
    this.gold = map.devMode ? 10000 : 0
    this.corpses = []
    this.units = []
    this.buildings = []
    this.population = 0
    this.technologies = []
    this.cellViewed = 0
    this.age = 0
    Object.keys(options).forEach(prop => {
      this[prop] = options[prop]
    })

    this.population_max = this.population_max || map.devMode ? POPULATION_MAX : 0

    this.colorHex = getHexColor(this.color)
    this.config = { ...Assets.cache.get('config') }
    this.techs = { ...Assets.cache.get('technology') }
    this.hasBuilt = this.hasBuilt || map.devMode ? Object.keys(this.config.buildings).map(key => key) : []
    const cloneGrid = []
    for (let i = 0; i <= map.size; i++) {
      for (let j = 0; j <= map.size; j++) {
        if (cloneGrid[i] == null) {
          cloneGrid[i] = []
        }
        cloneGrid[i][j] = {
          i,
          j,
          viewBy: this.views?.[i][j].viewBy ?? [],
          onViewed: () => {
            const {
              context: { menu, map },
            } = this
            if (this.isPlayed && !map.revealEverything) {
              menu.updateTerrainMiniMap(i, j)
            }
          },
          viewed:
            this.views?.[i][j].viewed ??
            ((this.isPlayed && this.type === PLAYER_TYPES.human && map.revealTerrain) || false),
        }
      }
    }
    this.views = cloneGrid
  }

  spawnBuilding(options) {
    const building = this.createBuilding(options)
    if (this.isPlayed) {
      let hasSentVillager = false
      let hasSentOther = false

      for (let i = 0; i < this.selectedUnits.length; i++) {
        const unit = this.selectedUnits[i]
        if (unit.type === UNIT_TYPES.villager) {
          if (getActionCondition(unit, building, ACTION_TYPES.build)) {
            hasSentVillager = true
            unit.sendToBuilding(building)
          }
        } else {
          unit.sendTo(building)
          hasSentOther = true
        }
      }
      if (hasSentVillager) {
        drawInstanceBlinkingSelection(building)
      }
      if (hasSentOther) {
        const voice = randomItem(['5075', '5076', '5128', '5164'])
        sound.play(voice)
        return
      } else if (hasSentVillager) {
        const voice = this.config.units.Villager.sounds.build
        sound.play(voice)
        return
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
      if (player.type === PLAYER_TYPES.human) {
        if (player.selectedUnit && player.selectedUnit.owner.label === this.label) {
          menu.setBottombar(player.selectedUnit)
        } else if (player.selectedBuilding && player.selectedBuilding.owner.label === this.label) {
          menu.setBottombar(player.selectedBuilding)
        } else if (player.selectedOther && player.selectedOther.owner.label === this.label) {
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
    return others
  }

  updateConfig(operations) {
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
      }
    }
  }

  buyBuilding(i, j, type) {
    const {
      context: { menu, map },
    } = this
    const config = this.config.buildings[type]
    if (
      canAfford(this, config.cost) &&
      (!config.conditions || config.conditions.every(condition => isValidCondition(condition, this)))
    ) {
      this.spawnBuilding({ i, j, type, isBuilt: map.devMode })
      payCost(this, config.cost)
      this.isPlayed && menu.updateTopbar()
      return true
    }
    return false
  }

  createUnit(options) {
    const { context } = this
    let unit = context.map.addChild(new Unit({ ...options, owner: this }, context))
    canUpdateMinimap(unit, context.player) && context.menu.updatePlayerMiniMapEvt(this)
    return unit
  }

  createBuilding(options) {
    const { context } = this
    const building = context.map.addChild(new Building({ ...options, owner: this }, context))
    this.buildings.push(building)
    canUpdateMinimap(building, context.player) && context.menu.updatePlayerMiniMapEvt(this)
    return building
  }
}
