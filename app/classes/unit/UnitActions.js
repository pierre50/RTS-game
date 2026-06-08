import { Assets } from 'pixi.js'
import {
  ACTION_TYPES,
  BUILDING_TYPES,
  FAMILY_TYPES,
  LOADING_FOOD_TYPES,
  LOADING_TYPES,
  MENU_INFO_IDS,
  SHEET_TYPES,
  SOUND_CUES,
  TYPE_ACTION,
  UNIT_TYPES,
} from '../../constants'
import {
  degreeToDirection,
  getInstanceDegree,
  onSpriteLoopAtFrame,
  playSoundCue,
  playerCanSeeInstance,
} from '../../lib'
import { Projectile } from '../projectile'

export class UnitActions {
  constructor(unit) {
    this.unit = unit
  }

  restorePreviousWork() {
    const unit = this.unit
    if (!unit.previousWork || unit.work === unit.previousWork) return
    unit.work = unit.previousWork
    unit.previousWork = null
  }

  clearInvalidPreviousTask() {
    const unit = this.unit
    if (!unit.previousDest) return false

    const type = unit.previousDest.category || unit.previousDest.type
    const action = TYPE_ACTION[type]
    if (!action || !unit.getActionCondition(unit.previousDest, action)) {
      unit.previousDest = null
      return true
    }
    return false
  }

  playSound(soundId) {
    const unit = this.unit
    if (!soundId || !unit.context.controls.instanceIsAudible(unit)) return
    playSoundCue(soundId)
  }

  getWorkSound(key, fallback = null) {
    return this.unit.sounds?.work?.[key] ?? fallback
  }

  goBackToPrevious() {
    const unit = this.unit
    const {
      context: { map },
    } = unit
    this.clearInvalidPreviousTask()
    if (!unit.previousDest) {
      this.restorePreviousWork()
      unit.stop()
      return
    }
    const dest = unit.previousDest
    const type = dest.category || dest.type
    unit.previousDest = null
    this.restorePreviousWork()
    if (dest.family === FAMILY_TYPES.animal) {
      if (unit.getActionCondition(dest, ACTION_TYPES.takemeat)) {
        unit.sendToTakeMeat(dest, true)
      } else {
        unit.sendToEvt(map.grid[dest.i][dest.j], ACTION_TYPES.hunt)
      }
    } else if (dest.family === FAMILY_TYPES.building) {
      if (unit.getActionCondition(dest, ACTION_TYPES.build)) {
        unit.sendToBuilding(dest)
      } else if (unit.getActionCondition(dest, ACTION_TYPES.farm)) {
        unit.sendToFarm(dest)
      } else {
        unit.sendTo(map.grid[dest.i][dest.j], ACTION_TYPES.build)
      }
    } else if (TYPE_ACTION[type]) {
      if (unit.getActionCondition(dest, TYPE_ACTION[type])) {
        const sendToFunc = `sendTo${type}`
        typeof unit[sendToFunc] === 'function' ? unit[sendToFunc](dest) : unit.stop()
      } else {
        unit.sendTo(map.grid[dest.i][dest.j], TYPE_ACTION[type])
      }
    } else {
      unit.sendTo(map.grid[dest.i][dest.j])
    }
  }

  startGathering(loadingType, soundId, { dieOnEmpty = false, checkOwner = false, updateTexture = false } = {}) {
    const unit = this.unit
    const { menu } = unit.context
    if (!unit.getActionCondition(unit.dest)) {
      unit.affectNewDest()
      return
    }
    unit.setTextures(SHEET_TYPES.action)
    unit.startInterval(
      () => {
        if (!unit.getActionCondition(unit.dest)) {
          if (dieOnEmpty && unit.dest.quantity <= 0) {
            unit.dest.die()
          }
          unit.affectNewDest()
          return
        }
        if (unit.loading === unit.loadingMax[unit.loadingType] || !unit.dest) {
          unit.sendToDelivery()
          return
        }
        unit.loading++
        unit.loadingType = loadingType
        unit.updateInterfaceLoading()
        this.playSound(soundId)
        if (updateTexture) unit.dest.updateTexture()
        unit.dest.quantity = Math.max(unit.dest.quantity - 1, 0)
        if (unit.dest.selected && (!checkOwner || unit.owner.isPlayed)) {
          menu.updateInfo(MENU_INFO_IDS.quantityText, unit.dest.quantity)
        }
        if (unit.dest.quantity <= 0) {
          if (dieOnEmpty) unit.dest.die()
          unit.affectNewDest()
        }
        if (unit.loading === 1) {
          if (unit.allAssets && unit.allAssets[unit.work]) {
            unit.walkingSheet = Assets.cache.get(unit.allAssets[unit.work].loadedSheet)
            unit.standingSheet = Assets.cache.get(unit.allAssets[unit.work].standingSheet)
          }
        }
      },
      (1 / unit.gatheringRate[unit.work]) * 1000,
      false
    )
  }

  upgrade(type) {
    const unit = this.unit
    const data = unit.owner.config.units[type]
    unit.type = type
    unit.hitPoints = data.totalHitPoints - (unit.totalHitPoints - unit.hitPoints)
    for (const [key, value] of Object.entries(data)) {
      unit[key] = value
    }
    for (const [key, value] of Object.entries(unit.assets)) {
      unit[key] = Assets.cache.get(value)
    }
    if (unit.action && !unit.path.length) {
      unit.getAction(unit.action)
    } else {
      unit.setTextures(unit.currentSheet)
    }
  }

  getAction(name) {
    const unit = this.unit
    const {
      context: { menu, player, map },
    } = unit
    unit.sprite.onLoop = null
    unit.sprite.onFrameChange = null
    switch (name) {
      case ACTION_TYPES.delivery:
        if (!unit.getActionCondition(unit.dest, unit.action)) {
          unit.stop()
          return
        }
        unit.owner[LOADING_FOOD_TYPES.includes(unit.loadingType) ? 'food' : unit.loadingType] += unit.loading
        unit.owner.isPlayed && menu.updateTopbar()
        unit.loading = 0
        unit.updateInterfaceLoading()
        if (unit.allAssets && unit.allAssets[unit.work]) {
          unit.standingSheet = Assets.cache.get(unit.allAssets[unit.work].standingSheet)
          unit.walkingSheet = Assets.cache.get(unit.allAssets[unit.work].walkingSheet)
        }
        unit.setTextures(SHEET_TYPES.standing)
        if (unit.previousDest) {
          unit.goBackToPrevious()
        } else {
          unit.stop()
        }
        break
      case ACTION_TYPES.farm:
        if (!unit.getActionCondition(unit.dest)) {
          unit.affectNewDest()
          return
        }
        unit.dest.isUsedBy = unit
        unit.setTextures(SHEET_TYPES.action)
        unit.startInterval(
          () => {
            if (!unit.getActionCondition(unit.dest)) {
              if (unit.dest.quantity <= 0) {
                unit.dest.die()
              }
              unit.affectNewDest()
              return
            }
            unit.dest.isUsedBy = unit
            if (unit.loading === unit.loadingMax[unit.loadingType] || !unit.dest) {
              unit.sendToDelivery()
              unit.dest.isUsedBy = null
              return
            }
            unit.loading++
            unit.loadingType = LOADING_TYPES.wheat
            unit.updateInterfaceLoading()
            this.playSound(this.getWorkSound('gatherFood', SOUND_CUES.villager.gatherFood))
            unit.dest.quantity = Math.max(unit.dest.quantity - 1, 0)
            if (unit.dest.selected) {
              menu.updateInfo(MENU_INFO_IDS.quantityText, unit.dest.quantity)
            }
            if (unit.dest.quantity <= 0) {
              unit.dest.die()
              unit.affectNewDest()
            }
            if (unit.loading === 1) {
              if (unit.allAssets[unit.work]) {
                unit.walkingSheet = Assets.cache.get(unit.allAssets[unit.work].loadedSheet)
              }
              unit.standingSheet = null
            }
          },
          (1 / unit.gatheringRate[unit.work]) * 1000,
          false
        )
        break
      case ACTION_TYPES.chopwood:
        if (!unit.getActionCondition(unit.dest)) {
          unit.affectNewDest()
          return
        }
        unit.setTextures(SHEET_TYPES.action)
        unit.startInterval(
          () => {
            if (!unit.getActionCondition(unit.dest)) {
              if (unit.dest.quantity <= 0) {
                unit.dest.die()
              }
              unit.affectNewDest()
              return
            }
            if (unit.loading === unit.loadingMax[unit.loadingType] || !unit.dest) {
              unit.sendToDelivery()
              return
            }
            this.playSound(this.getWorkSound('chopWood', SOUND_CUES.villager.chopWood))
            if (unit.dest.hitPoints > 0) {
              unit.dest.hitPoints = Math.max(unit.dest.hitPoints - 1, 0)
              if (unit.dest.selected) {
                unit.dest.drawHealthBar()
                menu.updateInfo(
                  MENU_INFO_IDS.hitPoints,
                  unit.dest.hitPoints > 0 ? unit.dest.hitPoints + '/' + unit.dest.totalHitPoints : ''
                )
              }
              if (unit.dest.hitPoints <= 0) {
                unit.dest.hitPoints = 0
                unit.dest.setCuttedTreeTexture()
              }
            } else {
              unit.loading++
              unit.loadingType = LOADING_TYPES.wood
              unit.updateInterfaceLoading()
              unit.dest.quantity = Math.max(unit.dest.quantity - 1, 0)
              if (unit.dest.selected) {
                menu.updateInfo(MENU_INFO_IDS.quantityText, unit.dest.quantity)
              }
              if (unit.dest.quantity <= 0) {
                unit.dest.die()
                unit.affectNewDest()
              }
              if (unit.loading === 1) {
                if (unit.allAssets[unit.work]) {
                  unit.walkingSheet = Assets.cache.get(unit.allAssets[unit.work].loadedSheet)
                }
                unit.standingSheet = null
              }
            }
          },
          (1 / unit.gatheringRate[unit.work]) * 1000,
          false
        )
        break
      case ACTION_TYPES.forageberry:
        this.startGathering(LOADING_TYPES.berry, this.getWorkSound('forageBerry', SOUND_CUES.villager.forageBerry), {
          dieOnEmpty: true,
        })
        break
      case ACTION_TYPES.minestone:
        this.startGathering(LOADING_TYPES.stone, this.getWorkSound('mineStone', SOUND_CUES.villager.mineOre), {
          dieOnEmpty: true,
        })
        break
      case ACTION_TYPES.minegold:
        this.startGathering(LOADING_TYPES.gold, this.getWorkSound('mineGold', SOUND_CUES.villager.mineOre))
        break
      case ACTION_TYPES.build:
        if (!unit.getActionCondition(unit.dest)) {
          unit.affectNewDest()
          return
        }
        unit.setTextures(SHEET_TYPES.action)
        unit.startInterval(
          () => {
            if (!unit.getActionCondition(unit.dest)) {
              if (unit.dest.type === BUILDING_TYPES.farm && !unit.dest.isUsedBy) {
                unit.sendToFarm(unit.dest)
                return
              }
              unit.affectNewDest()
              return
            }
            if (unit.dest.hitPoints < unit.dest.totalHitPoints) {
              this.playSound(this.getWorkSound('build', SOUND_CUES.villager.buildLoop))
              unit.dest.hitPoints = Math.min(
                Math.round(unit.dest.hitPoints + unit.dest.totalHitPoints / unit.dest.constructionTime),
                unit.dest.totalHitPoints
              )
              if (unit.dest.selected) {
                unit.dest.drawHealthBar()
                if (unit.owner.isPlayed) {
                  menu.updateInfo(MENU_INFO_IDS.hitPoints, unit.dest.hitPoints + '/' + unit.dest.totalHitPoints)
                }
              }
              unit.dest.updateHitPoints(unit.action)
            } else {
              if (!unit.dest.isBuilt) {
                unit.dest.updateHitPoints(unit.action)
                unit.dest.isBuilt = true
                if (unit.dest.type === BUILDING_TYPES.farm && !unit.dest.isUsedBy) {
                  unit.sendToFarm(unit.dest)
                  return
                }
              }
              unit.affectNewDest()
            }
          },
          1000,
          false
        )
        break
      case ACTION_TYPES.attack:
        unit.unitCombat.handleAttackAction()
        break
      case ACTION_TYPES.heal:
        if (!unit.getActionCondition(unit.dest)) {
          unit.affectNewDest()
          return
        }
        unit.setTextures(SHEET_TYPES.action)
        unit.sprite.onLoop = () => {
          if (!unit.getActionCondition(unit.dest)) {
            unit.affectNewDest()
            return
          }
          if (unit.destHasMoved()) {
            unit.realDest.i = unit.dest.i
            unit.realDest.j = unit.dest.j
            unit.realDest.x = unit.dest.x
            unit.realDest.y = unit.dest.y
            const oldDeg = unit.degree
            unit.degree = getInstanceDegree(unit, unit.dest.x, unit.dest.y)
            if (degreeToDirection(oldDeg) !== degreeToDirection(unit.degree)) {
              unit.setTextures(SHEET_TYPES.action)
            }
          }
          if (!unit.isUnitAtDest(unit.action, unit.dest)) {
            unit.sendToEvt(unit.dest, ACTION_TYPES.heal, { forceRepath: true })
            return
          }
          if (unit.dest.hitPoints < unit.dest.totalHitPoints) {
            unit.dest.hitPoints = Math.min(unit.dest.hitPoints + unit.healing, unit.dest.totalHitPoints)
            if (unit.dest.selected && player.selectedUnit === unit.dest) {
              menu.updateInfo(MENU_INFO_IDS.hitPoints, unit.dest.hitPoints + '/' + unit.dest.totalHitPoints)
            }
          }
        }
        break
      case ACTION_TYPES.takemeat:
        this.startGathering(LOADING_TYPES.meat, this.getWorkSound('takeMeat', null), {
          checkOwner: true,
          updateTexture: true,
        })
        break
      case ACTION_TYPES.fishing:
        this.startGathering(LOADING_TYPES.fish, this.getWorkSound('fishing'), { checkOwner: true })
        if (unit.category !== 'Boat') {
          onSpriteLoopAtFrame(unit.sprite, 6, () => {
            this.playSound(this.getWorkSound('throwSpear', SOUND_CUES.villager.throwSpear))
          })
        }
        break
      case ACTION_TYPES.hunt:
        if (!unit.getActionCondition(unit.dest)) {
          unit.affectNewDest()
          return
        }
        if (unit.dest.isDead) {
          unit.previousDest ? unit.goBackToPrevious() : unit.sendToTakeMeat(unit.dest)
          return
        }
        unit.setTextures(SHEET_TYPES.action)
        unit.sprite.onLoop = () => {
          if (!unit.getActionCondition(unit.dest)) {
            if (unit.dest && unit.dest.hitPoints <= 0) {
              unit.dest.die()
              unit.previousDest ? unit.goBackToPrevious() : unit.sendToTakeMeat(unit.dest)
              return
            }
            unit.affectNewDest()
            return
          }
          if (!unit.isUnitAtDest(unit.action, unit.dest)) {
            if (unit.context.map.revealEverything || playerCanSeeInstance(unit.dest, unit.owner)) {
              unit.sendToEvt(unit.dest, ACTION_TYPES.hunt, { forceRepath: true })
            } else {
              unit.stop()
            }
            return
          }
          if (unit.destHasMoved()) {
            unit.realDest.i = unit.dest.i
            unit.realDest.j = unit.dest.j
            unit.realDest.x = unit.dest.x
            unit.realDest.y = unit.dest.y
            const oldDeg = unit.degree
            unit.degree = getInstanceDegree(unit, unit.dest.x, unit.dest.y)
            if (degreeToDirection(oldDeg) !== degreeToDirection(unit.degree)) {
              unit.setTextures(SHEET_TYPES.action)
            }
          }
        }
        onSpriteLoopAtFrame(unit.sprite, 6, () => {
          if (!unit.getActionCondition(unit.dest) || !unit.realDest) return
          const projectile = new Projectile(
            {
              owner: unit,
              target: unit.dest,
              type: 'Spear',
              destination: unit.realDest,
              damage: 4,
            },
            unit.context
          )
          map.addChild(projectile)
        })
        break
      default:
        unit.stop()
    }
  }
}
