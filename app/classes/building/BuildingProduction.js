import { Assets, Sprite } from 'pixi.js'
import { LABEL_TYPES, MENU_INFO_IDS, PLAYER_TYPES, POPULATION_MAX } from '../../constants'
import {
  canAfford,
  capitalizeFirstLetter,
  changeSpriteColorDirectly,
  getBuildingAsset,
  getFreeCellAroundPoint,
  getTexture,
  payCost,
  refundCost,
} from '../../lib'
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
        cell => cell.category === 'Water' && !cell.solid
      )
    } else {
      spawnCell = getFreeCellAroundPoint(
        building.i,
        building.j,
        building.size,
        map.grid,
        cell => cell.category !== 'Water' && !cell.solid
      )
    }
    if (!spawnCell) {
      return
    }
    building.owner.population++

    const unitExtra = extra || (building.owner.getUnitExtraOptions && building.owner.getUnitExtraOptions(type)) || {}
    building.owner.createUnit({ i: spawnCell.i, j: spawnCell.j, type, ...unitExtra })

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
        building.startInterval(() => {
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
            building.stopInterval()
            building.placeUnit(type, extra)
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
              menu.showMessage(t('needHouses'))
              hasShowedMessage = true
            }
            if (building.selected && building.owner.isPlayed) {
              building.updateInterfaceLoading()
            }
          }
        }, unit.trainingTime)
      }
      return success
    }
  }

  cancelTechnology() {
    const building = this.building
    const {
      context: { player, menu },
    } = building
    building.stopInterval()
    refundCost(player, building.technology.cost)
    building.technology = null
    building.loading = null
    if (building.owner.isPlayed) {
      menu.updateBottombar()
      menu.updateTopbar()
    }
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
    if (assets.images.color) {
      const spriteColor = Sprite.from(getTexture(assets.images.color, Assets))
      spriteColor.label = LABEL_TYPES.color
      changeSpriteColorDirectly(spriteColor, building.owner.color)
      building.addChild(spriteColor)
    } else {
      changeSpriteColorDirectly(building.sprite, building.owner.color)
    }
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
      building.startInterval(() => {
        const { config, type } = building.technology
        if (building.loading >= 100 || map.instantMode) {
          building.stopInterval()
          building.loading = null
          building.technology = null
          if (Array.isArray(building.owner[config.key])) {
            building.owner[config.key].push(config.value || type)
          } else {
            building.owner[config.key] = config.value || type
          }
          if (config.action) {
            switch (config.action.type) {
              case 'upgradeUnit':
                for (let i = 0; i < building.owner.units.length; i++) {
                  const unit = building.owner.units[i]
                  if (unit.type === config.action.source) {
                    unit.upgrade(config.action.target)
                  }
                }
                break
              case 'upgradeBuilding':
                for (let i = 0; i < building.owner.buildings.length; i++) {
                  const target = building.owner.buildings[i]
                  if (target.type === config.action.source) {
                    target.upgrade(config.action.target)
                  }
                }
                break
              case 'improve':
                building.owner.updateConfig(
                  config.action.operations.map(operation => ({ ...operation, value: Number(operation.value) }))
                )
                break
            }
          }
          const functionName = `on${capitalizeFirstLetter(config.key)}Change`
          typeof building.owner[functionName] === 'function' && building.owner[functionName](config.value)
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
      }, config.researchTime)
    }
    return success
  }
}
