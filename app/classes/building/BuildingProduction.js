import { Assets } from 'pixi.js'
import { ACTION_TYPES, FAMILY_TYPES, LABEL_TYPES, MENU_INFO_IDS, PLAYER_TYPES, POPULATION_MAX } from '../../constants'
import {
  canAfford,
  changeSpriteColorDirectly,
  getActionCondition,
  getBuildingAsset,
  getFreeCellAroundPoint,
  getTexture,
  payCost,
  refundCost,
} from '../../lib'

function sendUnitToEntity(unit, target) {
  if (target.family === FAMILY_TYPES.resource) {
    const sendToFunc = `sendTo${target.category || target.type}`
    if (typeof unit[sendToFunc] === 'function') return unit[sendToFunc](target)
    return unit.sendTo(target)
  }
  if (target.family === FAMILY_TYPES.animal) {
    if (getActionCondition(unit, target, ACTION_TYPES.hunt)) return unit.sendToHunt(target)
    if (getActionCondition(unit, target, ACTION_TYPES.takemeat)) return unit.sendToTakeMeat(target)
    return unit.sendTo(target)
  }
  if (target.family === FAMILY_TYPES.building) {
    if (getActionCondition(unit, target, ACTION_TYPES.build)) return unit.sendToBuilding(target)
    if (getActionCondition(unit, target, ACTION_TYPES.farm)) return unit.sendToFarm(target)
    if (getActionCondition(unit, target, ACTION_TYPES.attack)) return unit.sendTo(target, ACTION_TYPES.attack)
  }
  if (target.family === FAMILY_TYPES.unit) {
    if (getActionCondition(unit, target, ACTION_TYPES.attack)) return unit.sendTo(target, ACTION_TYPES.attack)
  }
  unit.sendTo(target)
}
import { t } from '../../lib/lang'

export class BuildingProduction {
  constructor(building) {
    this.building = building
  }

  placeUnit(type, extra) {
    const building = this.building
    const {
      context: { map, menu },
    } = building
    let spawnCell
    const config = building.owner.config.units[type]
    if (config.category === 'Boat') {
      spawnCell = getFreeCellAroundPoint(
        building.i,
        building.j,
        building.size,
        map.grid,
        cell => cell.category === 'Water' && !cell.solid,
        items => map.randomItem(items)
      )
    } else {
      spawnCell = getFreeCellAroundPoint(
        building.i,
        building.j,
        building.size,
        map.grid,
        cell => cell.category !== 'Water' && !cell.solid,
        items => map.randomItem(items)
      )
    }
    if (!spawnCell || building.owner.population >= Math.min(POPULATION_MAX, building.owner.population_max)) return false
    building.owner.population++

    const unitExtra = extra || (building.owner.getUnitExtraOptions && building.owner.getUnitExtraOptions(type)) || {}
    const unit = building.owner.createUnit({ i: spawnCell.i, j: spawnCell.j, type, ...unitExtra })
    const rallyPoint = building.rallyPoint
    const rallyCell = rallyPoint && map.grid[rallyPoint.i]?.[rallyPoint.j]
    if (rallyCell) {
      const rallyTarget = rallyCell.has && !rallyCell.has.isDestroyed ? rallyCell.has : null
      rallyTarget ? sendUnitToEntity(unit, rallyTarget) : unit.sendTo(rallyCell)
    }

    if (
      building.owner.isPlayed &&
      building.owner.selectedBuilding &&
      building.owner.selectedBuilding.displayPopulation
    ) {
      menu.updateInfo(
        MENU_INFO_IDS.populationText,
        building.owner.population + '/' + Math.min(POPULATION_MAX, building.owner.population_max)
      )
    }
    return true
  }

  buyUnit(type, alreadyPaid = false, force = false, extra) {
    const building = this.building
    const {
      context: { menu, map },
    } = building
    let success = false
    const unit = building.owner.config.units[type]
    if (building.isBuilt && !building.isDead && (canAfford(building.owner, unit.cost) || alreadyPaid)) {
      if (!alreadyPaid) {
        if (building.owner.type === PLAYER_TYPES.ai) {
          if (!building.queue.length && building.loading === null) {
            payCost(building.owner, unit.cost)
            building.queue.push(type)
            success = true
          }
        } else {
          payCost(building.owner, unit.cost)
          building.queue.push(type)
          if (building.selected && building.owner.isPlayed) {
            menu.updateButtonContent(type, building.queue.filter(q => q === type).length)
          }
          building.owner.isPlayed && menu.updateTopbar()
          success = true
        }
      }
      if ((building.loading === null && building.queue[0]) || force) {
        let hasShowedMessage = false
        building.loading = force ? building.loading : 0
        if (building.selected && building.owner.isPlayed) {
          building.updateInterfaceLoading()
        }
        building.startInterval(
          () => {
            if (building.queue[0] !== type) {
              building.stopInterval()
              building.loading = null
              if (building.queue.length) {
                building.buyUnit(building.queue[0], true)
              }
              hasShowedMessage = false
              if (building.selected && building.owner.isPlayed) {
                const still = building.queue.filter(q => q === type).length
                menu.updateButtonContent(type, still || '')
                if (still === 0) menu.toggleButtonCancel(type, false)
                building.updateInterfaceLoading()
              }
            } else if (building.loading >= 100 || map.instantMode) {
              if (!building.placeUnit(type, extra)) return
              building.stopInterval()
              building.loading = null
              building.queue.shift()
              if (building.queue.length) {
                building.buyUnit(building.queue[0], true)
              }
              hasShowedMessage = false
              if (building.selected && building.owner.isPlayed) {
                const still = building.queue.filter(q => q === type).length
                menu.updateButtonContent(type, still || '')
                if (still === 0) menu.toggleButtonCancel(type, false)
                building.updateInterfaceLoading()
              }
            } else if (building.loading < 100) {
              if (building.owner.population < Math.min(POPULATION_MAX, building.owner.population_max)) {
                building.loading += 1
              } else if (building.owner.isPlayed && !hasShowedMessage) {
                menu.showMessage(t('needHouses'), 'warning')
                hasShowedMessage = true
              }
              if (building.selected && building.owner.isPlayed) {
                building.updateInterfaceLoading()
              }
            }
          },
          unit.trainingTime,
          'building.production'
        )
      }
      return success
    }
  }

  cancelUnits(type) {
    const building = this.building
    const unit = building.owner.config.units[type]
    if (!unit) return false

    const cancelled = building.queue.filter(queuedType => queuedType === type).length
    if (!cancelled) return false

    for (let index = 0; index < cancelled; index++) {
      refundCost(building.owner, unit.cost)
    }
    building.queue = building.queue.filter(queuedType => queuedType !== type)

    if (building.owner.isPlayed) {
      const { menu } = building.context
      menu.updateTopbar()
      menu.updateButtonContent(type, '')
      menu.toggleButtonCancel(type, false)
    }
    return true
  }

  cancelTechnology() {
    const building = this.building
    const { menu } = building.context
    if (!building.technology) return false

    building.stopInterval()
    refundCost(building.owner, building.technology.config.cost)
    building.technology = null
    building.loading = null
    if (building.owner.isPlayed) {
      menu.updateBottombar()
      menu.updateTopbar()
    }
    return true
  }

  upgrade(type) {
    const building = this.building
    const data = building.owner.config.buildings[type]
    building.type = type
    building.hitPoints = data.totalHitPoints - (building.totalHitPoints - building.hitPoints)
    for (const [key, value] of Object.entries(data)) {
      building[key] = value
    }
    const assets = getBuildingAsset(building.type, building.owner, Assets)
    building.sprite.texture = getTexture(assets.images.final, Assets)
    building.sprite.anchor.set(building.sprite.texture.defaultAnchor.x, building.sprite.texture.defaultAnchor.y)
    const color = building.getChildByLabel(LABEL_TYPES.color)
    color?.destroy()
    delete building.sprite._baseColorTextureKey
    changeSpriteColorDirectly(building.sprite, building.owner.color)
  }

  buyTechnology(type, alreadyPaid, force) {
    const building = this.building
    const {
      context: { menu, map },
    } = building
    let success = false
    const config = building.owner.techs[type]
    if (
      !building.queue.length &&
      building.isBuilt &&
      (force || building.loading === null) &&
      !building.isDead &&
      (alreadyPaid || canAfford(building.owner, config.cost))
    ) {
      !alreadyPaid && payCost(building.owner, config.cost)
      success = true
      if (building.owner.isPlayed) {
        menu.updateTopbar()
      }
      building.loading = force ? building.loading : 0

      building.technology = { config, type }
      if (building.selected && building.owner.selectedBuilding === building) {
        menu.setBottombar(building)
      }
      building.startInterval(
        () => {
          const { config, type } = building.technology
          if (building.loading >= 100 || map.instantMode) {
            building.stopInterval()
            building.loading = null
            building.technology = null
            building.owner.unlockTechnology(type)
            if (building.owner.isPlayed) {
              menu.updateBottombar()
              menu.updateTopbar()
            }
          } else if (building.loading < 100) {
            building.loading += 1
            if (building.owner.isPlayed && building.owner.selectedBuilding === building) {
              building.updateInterfaceLoading()
            }
          }
        },
        config.researchTime,
        'building.research'
      )
    }
    return success
  }
}
