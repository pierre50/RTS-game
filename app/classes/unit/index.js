import { sound } from '@pixi/sound'
import { Assets, AnimatedSprite } from 'pixi.js'
import {
  ACCELERATOR,
  STEP_TIME,
  MAX_SELECT_UNITS,
  WORK_TYPES,
  ACTION_TYPES,
  FAMILY_TYPES,
  SHEET_TYPES,
  LABEL_TYPES,
  UNIT_TYPES,
} from '../../constants'
import {
  getInstanceZIndex,
  randomRange,
  changeSpriteColor,
  drawInstanceBlinkingSelection,
  instanceIsInPlayerSight,
  getActionCondition,
  randomItem,
  throttle,
  canUpdateMinimap,
  getWorkWithLoadingType,
  setUnitTexture,
  updateInstanceVisibility,
} from '../../lib'
import { Instance } from '../Instance'
import { UnitInterface } from '../../ui/UnitInterface'
import { UnitCommands } from './UnitCommands'
import { UnitLifecycle } from './UnitLifecycle'
import { UnitCombat } from './UnitCombat'
import { UnitActions } from './UnitActions'
import { UnitMovement } from './UnitMovement'

function getActionSheet(work, action, Assets, unit) {
  if (!work) {
    return
  }
  const actionSheet = action === ACTION_TYPES.takemeat ? SHEET_TYPES.harvest : SHEET_TYPES.action
  return Assets.cache.get(unit.allAssets[work][actionSheet])
}

export class Unit extends Instance {
  constructor(options, context) {
    super(context)
    this.selectionFactor = 0.5

    const {
      context: { map, menu },
    } = this
    this.family = FAMILY_TYPES.unit
    this.unitInterface = new UnitInterface(this)
    this.unitCommands = new UnitCommands(this)
    this.unitLifecycle = new UnitLifecycle(this)
    this.unitCombat = new UnitCombat(this)
    this.unitActions = new UnitActions(this)
    this.unitMovement = new UnitMovement(this)

    this.dest = null
    this.realDest = null
    this.previousDest = null
    this.path = []
    this.degree = randomRange(1, 360)
    this.currentFrame = randomRange(0, 4)
    this.action = null
    this.loading = 0
    this.loadingType = null
    this.currentSheet = SHEET_TYPES.standing
    this.inactif = true
    this.x = null
    this.y = null
    this.z = null

    Object.assign(this, options)
    Object.assign(this, this.owner.config.units[this.type])
    this.size = 1
    this.visible = false
    this.visibleCells = new Set()
    this.x = this.x ?? map.grid[this.i][this.j].x
    this.y = this.y ?? map.grid[this.i][this.j].y
    this.z = this.z ?? map.grid[this.i][this.j].z
    this.zIndex = getInstanceZIndex(this)
    this.quantity = this.quantity ?? this.totalQuantity
    this.hitPoints = this.hitPoints ?? this.totalHitPoints

    this.currentCell = map.grid[this.i][this.j]
    if (this.currentSheet === SHEET_TYPES.corpse) {
      this.owner.corpses.push(this)
      map.grid[this.i][this.j].corpses.add(this)
    } else if (!this.isDead) {
      this.currentCell.place(this)
      this.currentCell.solid = true
      this.owner.units.push(this)
      map.addToInstanceBucket(this)
    }
    switch (this.type) {
      case UNIT_TYPES.villager:
        this.work = this.work || null
        break
      case 'Priest':
        this.work = WORK_TYPES.healer
        break
      default:
        this.work = WORK_TYPES.attacker
    }

    if (this.assets) {
      for (const [key, value] of Object.entries(this.assets)) {
        this[key] = Assets.cache.get(value)
      }
    } else if (this.allAssets) {
      for (const [key, value] of Object.entries(this.allAssets.default)) {
        this[key] = Assets.cache.get(value)
      }
    }

    if (this.owner.isPlayed && map.ready && this.context.controls.instanceInCamera(this)) {
      sound.play((this.sounds && this.sounds.create) || 5144)
    }

    this.interface = {
      info: element => {
        const data = this.owner.config.units[this.type]
        this.setDefaultInterface(element, data)
        if (this.showLoading && this.owner.isPlayed) {
          element.appendChild(this.getLoadingElement())
        }
      },
      menu:
        this.showBuildings && this.owner.isPlayed
          ? [
              {
                icon: 'assets/interface/50721/002_50721.png',
                children: Object.keys(this.owner.config.buildings).map(key => menu.getBuildingButton(key)),
              },
            ]
          : [],
    }

    this.allowMove = false
    this.eventMode = 'static'
    this.actionSheet = this.actionSheet || getActionSheet(this.work, this.action, Assets, this)
    this.sprite = new AnimatedSprite(this[SHEET_TYPES.standing].animations['south'])
    this.sprite.label = LABEL_TYPES.sprite
    this.sprite.allowMove = false
    this.sprite.eventMode = 'auto'
    this.sprite.allowClick = false
    this.sprite.roundPixels = true
    this.sprite.loop = this.loop ?? true
    if (this.isDead) {
      this.currentSheet === SHEET_TYPES.corpse ? this.decompose() : this.death()
    } else if (this.loading > 0) {
      this.walkingSheet = Assets.cache.get(this.allAssets[getWorkWithLoadingType(this.loadingType)].loadedSheet)
      this.standingSheet = Assets.cache.get(this.allAssets[getWorkWithLoadingType(this.loadingType)].standingSheet)
    }
    this.setTextures(this.currentSheet)

    this.sprite.currentFrame = Math.min(this.currentFrame, this.sprite.textures.length - 1)
    this.sprite.updateAnchor = true
    this.addChild(this.sprite)

    this.sendTo = throttle(this.sendToEvt, this.owner.isPlayed ? 100 : 1000, true)

    this.on('pointerdown', evt => {
      const {
        context: { controls, player },
      } = this
      if (controls.mouseBuilding || controls.mouseRectangle || !controls.isMouseInApp(evt)) {
        return
      }
      if (controls.clicked) {
        if (this.owner.isPlayed) {
          controls.getCellOnCamera(cell => {
            if (
              player.selectedUnits.length < MAX_SELECT_UNITS &&
              cell.has &&
              cell.has.owner &&
              cell.has.owner.label === this.owner.label &&
              cell.has.type === this.type
            ) {
              cell.has.select()
              player.selectedUnits.push(cell.has)
            }
          })
        }
        controls.doubleClicked = true
      }
      controls.clicked = false
    })
    this.on('pointerup', evt => {
      const {
        context: { controls, player, menu },
      } = this
      if (controls.doubleClicked || controls.mouseBuilding || controls.mouseRectangle || !controls.isMouseInApp(evt)) {
        return
      }

      controls.mouse.prevent = true
      controls.clicked = true
      controls.double = setTimeout(() => {
        controls.clicked = false
        controls.doubleClicked = false
      }, 600)

      if (this.owner.isPlayed) {
        let hasSentHealer = false
        if (player.selectedUnits.length) {
          for (let i = 0; i < player.selectedUnits.length; i++) {
            const playerUnit = player.selectedUnits[i]
            if (playerUnit.work === WORK_TYPES.healer && this.getActionCondition(playerUnit, ACTION_TYPES.heal)) {
              hasSentHealer = true
              playerUnit.sendTo(this, ACTION_TYPES.heal)
            }
          }
        }
        if (hasSentHealer) {
          drawInstanceBlinkingSelection(this)
        } else if (player.selectedUnit !== this) {
          this.owner.unselectAll()
          this.select()
          menu.setBottombar(this)
          player.selectedUnit = this
          player.selectedUnits = [this]
        }
      } else {
        let hasSentAttacker = false
        if (player.selectedUnits.length) {
          for (let i = 0; i < player.selectedUnits.length; i++) {
            const playerUnit = player.selectedUnits[i]
            if (this.getActionCondition(playerUnit, ACTION_TYPES.attack))
              if (playerUnit.type === UNIT_TYPES.villager) {
                hasSentAttacker = true
                playerUnit.sendToAttack(this)
              } else if (playerUnit.work === WORK_TYPES.attacker) {
                hasSentAttacker = true
                playerUnit.sendTo(this, ACTION_TYPES.attack)
              }
          }
        }
        if (hasSentAttacker) {
          drawInstanceBlinkingSelection(this)
        } else if ((player.selectedOther !== this && instanceIsInPlayerSight(this, player)) || map.revealEverything) {
          player.unselectAll()
          this.select()
          menu.setBottombar(this)
          player.selectedOther = this
        }
      }
    })

    changeSpriteColor(this.sprite, this.owner.color)


    this.visibilityTimeout = setTimeout(() => {
      if (!this.isDestroyed) updateInstanceVisibility(this)
    })
  }

  select() {
    if (this.selected) return
    super.select()
    const { context: { menu, player } } = this
    canUpdateMinimap(this, player) && menu.updatePlayerMiniMapEvt(this.owner)
  }

  unselect() {
    if (!this.selected) return
    super.unselect()
    const { context: { menu, player } } = this
    canUpdateMinimap(this, player) && menu.updatePlayerMiniMapEvt(this.owner)
  }

  hasPath() {
    return this.path.length > 0
  }

  setDest(dest) {
    if (!dest || dest.isDestroyed) {
      this.stop()
      return
    }
    this.handleSetDest && this.handleSetDest(dest, this)
    this.dest = dest
    this.realDest = {
      i: dest.i,
      j: dest.j,
      x: dest.x,
      y: dest.y,
      label: dest.label,
    }
  }

  setPath(path) {
    if (!path.length) {
      this.stop()
      return
    }
    this.setTextures(SHEET_TYPES.walking)
    this.inactif = false
    this.path = path
    this.startInterval(() => this.step(), STEP_TIME)
  }

  handleChangeDest() {
    if (this.dest && this.dest.isUsedBy === this) {
      this.dest.isUsedBy = null
    }
  }

  sendToEvt(dest, action) {
    return this.unitMovement.sendToEvt(dest, action)
  }


  goBackToPrevious() {
    return this.unitActions.goBackToPrevious()
  }

  startGathering(loadingType, soundId, opts) {
    return this.unitActions.startGathering(loadingType, soundId, opts)
  }

  getAction(name) {
    return this.unitActions.getAction(name)
  }

  detect(instance) {
    return this.unitCombat.detect(instance)
  }

  handleAffectNewDestHunter() {
    return this.unitCombat.handleAffectNewDestHunter()
  }

  upgrade(type) {
    return this.unitActions.upgrade(type)
  }

  affectNewDest() {
    return this.unitMovement.affectNewDest()
  }

  isUnitAtDest(action, dest) {
    return this.unitMovement.isUnitAtDest(action, dest)
  }

  destHasMoved() {
    return this.unitMovement.destHasMoved()
  }

  moveToPath() {
    return this.unitMovement.moveToPath()
  }

  isAttacked(instance) {
    if (!instance || this.dest === instance || this.isDead) {
      return
    }
    if (this.handleIsAttacked?.(instance, this)) return
    const currentDest = this.dest
    if (this.type === UNIT_TYPES.villager) {
      if (instance.family === FAMILY_TYPES.animal) {
        this.sendToHunt(instance)
      } else {
        this.sendToAttack(instance)
      }
    } else {
      this.sendTo(instance, ACTION_TYPES.attack)
    }
    this.previousDest = currentDest
  }

  stop() {
    if (this.currentCell.has?.label !== this.label && this.currentCell.solid) {
      this.sendTo(this.currentCell)
      return
    }
    this.handleChangeDest()
    this.inactif = true
    this.action = null
    this.dest = null
    this.realDest = null
    this.currentCell.place(this)
    this.currentCell.solid = true
    this.path = []
    this.stopInterval()
    this.setTextures(SHEET_TYPES.standing)
  }

  startInterval(callback, time, immediate = true) {
    if (this.isDead) {
      return
    }
    this.stopInterval()
    if (immediate) callback()
    this.interval = this.context.scheduler.add(callback, time)
  }



  explore() {
    return this.unitMovement.explore()
  }

  runaway(instance) {
    return this.unitMovement.runaway(instance)
  }

  decompose() {
    return this.unitLifecycle.decompose()
  }

  death() {
    return this.unitLifecycle.death()
  }

  die() {
    return this.unitLifecycle.die()
  }

  clear() {
    return this.unitLifecycle.clear()
  }


  updateInterfaceLoading() {
    this.unitInterface.updateLoading()
  }

  getLoadingElement() {
    return this.unitInterface.getLoadingElement()
  }

  commonSendTo(target, work, action, keepPrevious, immediate = false) {
    return this.unitCommands.commonSendTo(target, work, action, keepPrevious, immediate)
  }

  // Navigate to arrivalCell but set target as the attack dest.
  // Avoids the N×M A* calls getInstanceClosestFreeCellPath makes when multiple
  // units are sent to the same solid target — each unit gets exactly one A* call.
  sendToWithCell(target, arrivalCell, action) {
    return this.unitCommands.sendToWithCell(target, arrivalCell, action)
  }

  sendToDelivery() {
    return this.unitCommands.sendToDelivery()
  }

  sendToFish(target) {
    return this.unitCommands.sendToFish(target)
  }

  sendToAttack(target) {
    return this.unitCommands.sendToAttack(target)
  }

  sendToTakeMeat(target, immediate = false) {
    return this.unitCommands.sendToTakeMeat(target, immediate)
  }

  sendToHunt(target) {
    return this.unitCommands.sendToHunt(target)
  }

  sendToBuilding(target) {
    return this.unitCommands.sendToBuilding(target)
  }

  sendToFarm(target) {
    return this.unitCommands.sendToFarm(target)
  }

  sendToTree(target) {
    return this.unitCommands.sendToTree(target)
  }

  sendToBerrybush(target) {
    return this.unitCommands.sendToBerrybush(target)
  }

  sendToStone(target) {
    return this.unitCommands.sendToStone(target)
  }

  sendToGold(target) {
    return this.unitCommands.sendToGold(target)
  }

  setDefaultInterface(element, data) {
    this.unitInterface.setDefaultInterface(element, data)
  }
}
