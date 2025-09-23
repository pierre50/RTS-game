import { sound } from '@pixi/sound'
import { Container, Assets, AnimatedSprite, Graphics } from 'pixi.js'
import {
  ACCELERATOR,
  STEP_TIME,
  CORPSE_TIME,
  LOADING_FOOD_TYPES,
  MAX_SELECT_UNITS,
  TYPE_ACTION,
  POPULATION_MAX,
  WORK_FOOD_TYPES,
  COLOR_WHITE,
} from '../constants'
import {
  getInstanceZIndex,
  randomRange,
  renderCellOnInstanceSight,
  getIconPath,
  getInstancePath,
  instancesDistance,
  moveTowardPoint,
  clearCellOnInstanceSight,
  getInstanceClosestFreeCellPath,
  instanceContactInstance,
  getInstanceDegree,
  changeSpriteColor,
  findInstancesInSight,
  getClosestInstanceWithPath,
  getCellsAroundPoint,
  drawInstanceBlinkingSelection,
  instanceIsInPlayerSight,
  degreeToDirection,
  onSpriteLoopAtFrame,
  getActionCondition,
  randomItem,
  getHitPointsWithDamage,
  getClosestInstance,
  throttle,
  getFreeCellAroundPoint,
  uuidv4,
  canUpdateMinimap,
  getWorkWithLoadingType,
  setUnitTexture,
} from '../lib'
import { Projectile } from './projectile'

function getActionSheet(work, action, Assets, unit) {
  if (!work) {
    return
  }
  const actionSheet = action === 'takemeat' ? 'harvestSheet' : 'actionSheet'
  return Assets.cache.get(unit.allAssets[work][actionSheet])
}

export class Unit extends Container {
  constructor(options, context) {
    super()

    this.context = context

    const {
      context: { map, menu },
    } = this
    this.name = uuidv4()
    this.family = 'unit'

    this.dest = null
    this.realDest = null
    this.previousDest = null
    this.path = []
    this.selected = false
    this.degree = randomRange(1, 360)
    this.currentFrame = randomRange(0, 4)
    this.action = null
    this.loading = 0
    this.loadingType = null
    this.currentSheet = 'standingSheet'
    this.inactif = true
    this.isDead = false
    this.isDestroyed = false
    this.x = null
    this.y = null
    this.z = null

    Object.keys(options).forEach(prop => {
      this[prop] = options[prop]
    })
    Object.keys(this.owner.config.units[this.type]).forEach(prop => {
      this[prop] = this.owner.config.units[this.type][prop]
    })
    this.size = 1
    this.visible = false
    this.x = this.x ?? map.grid[this.i][this.j].x
    this.y = this.y ?? map.grid[this.i][this.j].y
    this.z = this.z ?? map.grid[this.i][this.j].z
    this.zIndex = getInstanceZIndex(this)
    this.quantity = this.quantity ?? this.totalQuantity
    this.hitPoints = this.hitPoints ?? this.totalHitPoints

    this.currentCell = map.grid[this.i][this.j]
    if (this.currentSheet === 'corpseSheet') {
      this.owner.corpses.push(this)
      map.grid[this.i][this.j].corpses.push(this)
    } else if (!this.isDead) {
      this.currentCell.has = this
      this.currentCell.solid = true
      this.owner.units.push(this)
    }
    switch (this.type) {
      case 'Villager':
        this.work = this.work || null
        break
      case 'Priest':
        this.work = 'healer'
        break
      default:
        this.work = 'attacker'
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

    if (this.owner.isPlayed && map.ready) {
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
    this.sprite = new AnimatedSprite(this['standingSheet'].animations['south'])
    this.sprite.label = 'sprite'
    this.sprite.allowMove = false
    this.sprite.eventMode = 'auto'
    this.sprite.allowClick = false
    this.sprite.roundPixels = true
    this.sprite.loop = this.loop ?? true
    if (this.isDead) {
      this.currentSheet === 'corpseSheet' ? this.decompose() : this.death()
    } else if (this.loading > 0) {
      this.walkingSheet = Assets.cache.get(this.allAssets[getWorkWithLoadingType(this.loadingType)].loadedSheet)
      this.standingSheet = Assets.cache.get(this.allAssets[getWorkWithLoadingType(this.loadingType)].standingSheet)
    }
    this.setTextures(this.currentSheet)

    this.sprite.currentFrame = Math.min(this.currentFrame, this.sprite.textures.length - 1)
    this.sprite.updateAnchor = true
    this.addChild(this.sprite)

    this.sendTo = this.owner.isPlayed ? throttle(this.sendToEvt, 100, true) : this.sendToEvt

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
              cell.has.owner.name === this.owner.name &&
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
            if (playerUnit.work === 'healer' && this.getActionCondition(playerUnit, 'heal')) {
              hasSentHealer = true
              playerUnit.sendTo(this, 'heal')
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
            if (this.getActionCondition(playerUnit, 'attack'))
              if (playerUnit.type === 'Villager') {
                hasSentAttacker = true
                playerUnit.sendToAttack(this)
              } else if (playerUnit.work === 'attacker') {
                hasSentAttacker = true
                playerUnit.sendTo(this, 'attack')
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

    this.interval = null

    renderCellOnInstanceSight(this)
  }

  pause() {
    this.sprite?.stop()
  }

  resume() {
    this.sprite?.play()
  }

  select() {
    if (this.selected) return

    const {
      context: { menu, player },
    } = this

    this.selected = true

    const selection = new Graphics()
    selection.label = 'selection'
    selection.zIndex = 3

    // Diamond shape
    const path = [-32 * 0.5, 0, 0, -16 * 0.5, 32 * 0.5, 0, 0, 16 * 0.5]
    selection.poly(path)
    selection.stroke(COLOR_WHITE)

    this.addChildAt(selection, 0)

    if (canUpdateMinimap(this, player)) {
      menu.updatePlayerMiniMapEvt(this.owner)
    }
  }

  unselect() {
    if (!this.selected) {
      return
    }
    const {
      context: { menu, player },
    } = this

    this.selected = false
    const selection = this.getChildByLabel('selection')
    if (selection) {
      this.removeChild(selection)
    }
    canUpdateMinimap(this, player) && menu.updatePlayerMiniMapEvt(this.owner)
  }

  hasPath() {
    return this.path.length > 0
  }

  setDest(dest) {
    if (!dest) {
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
      name: dest.name,
    }
  }

  setPath(path) {
    if (!path.length) {
      this.stop()
      return
    }
    this.setTextures('walkingSheet')
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
    const {
      context: { map },
    } = this
    this.handleChangeDest()
    this.stopInterval()
    let path = []
    // No instance we cancel the destination
    if (!dest || this.isDead) {
      return
    }
    // Unit is already beside our target
    if (
      this.isUnitAtDest(action, dest) &&
      (!map.grid[this.i][this.j].solid ||
        (map.grid[this.i][this.j].solid && map.grid[this.i][this.j].has?.name === this.name))
    ) {
      this.setDest(dest)
      this.action = action
      this.degree = getInstanceDegree(this, dest.x, dest.y)
      this.getAction(action)
      return
    }
    // Set unit path
    if (map.grid[dest.i] && map.grid[dest.i][dest.j]) {
      const allowWaterCellCategory = this.category === 'Boat'
      if (map.grid[dest.i][dest.j].solid) {
        path = getInstanceClosestFreeCellPath(this, dest, map)
        if (!path.length && this.work) {
          this.action = action
          this.affectNewDest()
          return
        }
      } else if (!allowWaterCellCategory && dest.category === 'Water') {
        const cell = getFreeCellAroundPoint(
          dest.i,
          dest.j,
          1,
          map.grid,
          cell => cell.category !== 'Water' && !cell.solid
        )
        this.sendToEvt(cell)
        return
      }
    }
    if (!path.length) {
      path = getInstancePath(this, dest.i, dest.j, map)
    }
    // Unit found a path, set the action and play walking animation
    if (path.length) {
      this.setDest(dest)
      this.action = action
      this.setPath(path)
    } else {
      this.stop()
    }
  }

  getActionCondition(target, action = this.action, props) {
    return getActionCondition(this, target, action, props)
  }

  goBackToPrevious() {
    const {
      context: { map },
    } = this

    if (!this.previousDest) {
      this.stop()
      return
    }
    const dest = this.previousDest
    const type = dest.category || dest.type
    this.previousDest = null
    if (dest.family === 'animal') {
      if (this.getActionCondition(dest, 'takemeat')) {
        this.sendToTakeMeat(dest)
      } else {
        this.sendTo(map.grid[dest.i][dest.j], 'hunt')
      }
    } else if (dest.family === 'building') {
      if (this.getActionCondition(dest, 'build')) {
        this.sendToBuilding(dest)
      } else if (this.getActionCondition(dest, 'farm')) {
        this.sendToFarm(dest)
      } else {
        this.sendTo(map.grid[dest.i][dest.j], 'build')
      }
    } else if (TYPE_ACTION[type]) {
      if (this.getActionCondition(dest, TYPE_ACTION[type])) {
        const sendToFunc = `sendTo${type}`
        typeof this[sendToFunc] === 'function' ? this[sendToFunc](dest) : this.stop()
      } else {
        this.sendTo(map.grid[dest.i][dest.j], TYPE_ACTION[type])
      }
    } else {
      this.sendTo(map.grid[dest.i][dest.j])
    }
  }

  getAction(name) {
    const {
      context: { menu, player, map },
    } = this
    this.sprite.onLoop = null
    this.sprite.onFrameChange = null
    switch (name) {
      case 'delivery':
        if (!this.getActionCondition(this.dest, this.action)) {
          this.stop()
          return
        }
        this.owner[LOADING_FOOD_TYPES.includes(this.loadingType) ? 'food' : this.loadingType] += this.loading
        this.owner.isPlayed && menu.updateTopbar()
        this.loading = 0
        this.updateInterfaceLoading()
        if (this.allAssets && this.allAssets[this.work]) {
          this.standingSheet = Assets.cache.get(this.allAssets[this.work].standingSheet)
          this.walkingSheet = Assets.cache.get(this.allAssets[this.work].walkingSheet)
        }

        if (this.previousDest) {
          this.goBackToPrevious()
        } else {
          this.stop()
        }
        break
      case 'farm':
        if (!this.getActionCondition(this.dest)) {
          this.affectNewDest()
          return
        }
        this.dest.isUsedBy = this
        this.setTextures('actionSheet')
        this.startInterval(
          () => {
            if (!this.getActionCondition(this.dest)) {
              if (this.dest.quantity <= 0) {
                this.dest.die()
              }
              this.affectNewDest()
              return
            }
            this.dest.isUsedBy = this
            // Villager is full we send him delivery first
            if (this.loading === this.loadingMax[this.loadingType] || !this.dest) {
              this.sendToDelivery()
              this.dest.isUsedBy = null
              return
            }
            // Villager farm the farm
            this.loading++
            this.loadingType = 'wheat'
            this.updateInterfaceLoading()

            this.visible && sound.play('5178')
            this.dest.quantity = Math.max(this.dest.quantity - 1, 0)
            if (this.dest.selected) {
              menu.updateInfo('quantity-text', this.dest.quantity)
            }
            // Destroy farm if it out of quantity
            if (this.dest.quantity <= 0) {
              this.dest.die()
              this.affectNewDest()
            }
            // Set the walking with berrybush animation
            if (this.loading > 0) {
              if (this.allAssets[this.work]) {
                this.walkingSheet = Assets.cache.get(this.allAssets[this.work].loadedSheet)
              }
              this.standingSheet = null
            }
          },
          (1 / this.gatheringRate[this.work]) * 1000,
          false
        )
        break
      case 'chopwood':
        if (!this.getActionCondition(this.dest)) {
          this.affectNewDest()
          return
        }
        this.setTextures('actionSheet')
        this.startInterval(
          () => {
            if (!this.getActionCondition(this.dest)) {
              if (this.dest.quantity <= 0) {
                this.dest.die()
              }
              this.affectNewDest()
              return
            }
            // Villager is full we send him delivery first
            if (this.loading === this.loadingMax[this.loadingType] || !this.dest) {
              this.sendToDelivery()
              return
            }

            this.visible && sound.play('5048')

            // Tree destination is still alive we cut him until it's dead
            if (this.dest.hitPoints > 0) {
              this.dest.hitPoints = Math.max(this.dest.hitPoints - 1, 0)

              if (this.dest.selected) {
                menu.updateInfo(
                  'hitPoints',
                  this.dest.hitPoints > 0 ? this.dest.hitPoints + '/' + this.dest.totalHitPoints : ''
                )
              }
              if (this.dest.hitPoints <= 0) {
                // Set cutted tree texture
                this.dest.hitPoints = 0
                this.dest.setCuttedTreeTexture()
              }
            } else {
              // Villager cut the stump
              this.loading++
              this.loadingType = 'wood'
              this.updateInterfaceLoading()

              this.dest.quantity = Math.max(this.dest.quantity - 1, 0)
              if (this.dest.selected) {
                menu.updateInfo('quantity-text', this.dest.quantity)
              }
              // Destroy tree if stump out of quantity
              if (this.dest.quantity <= 0) {
                this.dest.die()
                this.affectNewDest()
              }
              // Set the walking with wood animation
              if (this.loading > 0) {
                if (this.allAssets[this.work]) {
                  this.walkingSheet = Assets.cache.get(this.allAssets[this.work].loadedSheet)
                }
                this.standingSheet = null
              }
            }
          },
          (1 / this.gatheringRate[this.work]) * 1000,
          false
        )
        break
      case 'forageberry':
        if (!this.getActionCondition(this.dest)) {
          this.affectNewDest()
          return
        }
        this.setTextures('actionSheet')
        this.startInterval(
          () => {
            if (!this.getActionCondition(this.dest)) {
              if (this.dest.quantity <= 0) {
                this.dest.die()
              }
              this.affectNewDest()
              return
            }
            // Villager is full we send him delivery first
            if (this.loading === this.loadingMax[this.loadingType] || !this.dest) {
              this.sendToDelivery()
              return
            }
            // Villager forage the berrybush
            this.loading++
            this.loadingType = 'berry'
            this.updateInterfaceLoading()

            this.visible && sound.play('5085')

            this.dest.quantity = Math.max(this.dest.quantity - 1, 0)
            if (this.dest.selected) {
              menu.updateInfo('quantity-text', this.dest.quantity)
            }
            // Destroy berrybush if it out of quantity
            if (this.dest.quantity <= 0) {
              this.dest.die()
              this.affectNewDest()
            }
            // Set the walking with berrybush animation
            if (this.loading > 0) {
              if (this.allAssets[this.work]) {
                this.walkingSheet = Assets.cache.get(this.allAssets[this.work].loadedSheet)
              }
              this.standingSheet = null
            }
          },
          (1 / this.gatheringRate[this.work]) * 1000,
          false
        )
        break
      case 'minestone':
        if (!this.getActionCondition(this.dest)) {
          this.affectNewDest()
          return
        }
        this.setTextures('actionSheet')
        this.startInterval(
          () => {
            if (!this.getActionCondition(this.dest)) {
              if (this.dest.quantity <= 0) {
                this.dest.die()
              }
              this.affectNewDest()
              return
            }
            // Villager is full we send him delivery first
            if (this.loading === this.loadingMax[this.loadingType] || !this.dest) {
              this.sendToDelivery()
              return
            }
            // Villager mine the stone
            this.loading++
            this.loadingType = 'stone'
            this.updateInterfaceLoading()

            this.visible && sound.play('5159')

            this.dest.quantity = Math.max(this.dest.quantity - 1, 0)
            if (this.dest.selected) {
              menu.updateInfo('quantity-text', this.dest.quantity)
            }
            // Destroy stone if it out of quantity
            if (this.dest.quantity <= 0) {
              this.dest.die()
              this.affectNewDest()
            }
            // Set the walking with stone animation
            if (this.loading > 0) {
              if (this.allAssets[this.work]) {
                this.walkingSheet = Assets.cache.get(this.allAssets[this.work].loadedSheet)
              }
              this.standingSheet = null
            }
          },
          (1 / this.gatheringRate[this.work]) * 1000,
          false
        )
        break
      case 'minegold':
        if (!this.getActionCondition(this.dest)) {
          this.affectNewDest()
          return
        }
        this.setTextures('actionSheet')
        this.startInterval(
          () => {
            if (!this.getActionCondition(this.dest)) {
              this.affectNewDest()
              return
            }
            // Villager is full we send him delivery first
            if (this.loading === this.loadingMax[this.loadingType] || !this.dest) {
              this.sendToDelivery()
              return
            }
            // Villager mine the gold
            this.loading++
            this.loadingType = 'gold'
            this.updateInterfaceLoading()

            this.visible && sound.play('5159')
            this.dest.quantity = Math.max(this.dest.quantity - 1, 0)
            if (this.dest.selected) {
              menu.updateInfo('quantity-text', this.dest.quantity)
            }
            // Destroy gold if it out of quantity
            if (this.dest.quantity <= 0) {
              this.dest.die()
              this.affectNewDest()
            }
            // Set the walking with gold animation
            if (this.loading > 0) {
              if (this.allAssets[this.work]) {
                this.walkingSheet = Assets.cache.get(this.allAssets[this.work].loadedSheet)
              }
              this.standingSheet = null
            }
          },
          (1 / this.gatheringRate[this.work]) * 1000,
          false
        )
        break
      case 'build':
        if (!this.getActionCondition(this.dest)) {
          this.affectNewDest()
          return
        }
        this.setTextures('actionSheet')
        this.startInterval(
          () => {
            if (!this.getActionCondition(this.dest)) {
              if (this.dest.type === 'Farm' && !this.dest.isUsedBy) {
                this.sendToFarm(this.dest)
              }
              this.affectNewDest()
              return
            }
            if (this.dest.hitPoints < this.dest.totalHitPoints) {
              this.visible && sound.play('5107')
              this.dest.hitPoints = Math.min(
                Math.round(this.dest.hitPoints + this.dest.totalHitPoints / this.dest.constructionTime),
                this.dest.totalHitPoints
              )
              if (this.dest.selected && this.owner.isPlayed) {
                menu.updateInfo('hitPoints', this.dest.hitPoints + '/' + this.dest.totalHitPoints)
              }
              this.dest.updateHitPoints(this.action)
            } else {
              if (!this.dest.isBuilt) {
                this.depst.updateHitPoints(this.action)
                this.dest.isBuilt = true
                if (this.dest.type === 'Farm' && !this.dest.isUsedBy) {
                  this.sendToFarm(this.dest)
                }
              }
              this.affectNewDest()
            }
          },
          1000,
          false
        )
        break
      case 'attack':
        if (!this.getActionCondition(this.dest)) {
          this.affectNewDest()
          return
        }
        this.setTextures('actionSheet')
        if (this.range && this.type !== 'Villager') {
          this.sprite.onLoop = () => {
            if (!this.getActionCondition(this.dest)) {
              if (this.dest && this.dest.hitPoints <= 0) {
                this.dest.die()
              }
              this.affectNewDest()
              return
            }
            if (!this.isUnitAtDest(this.action, this.dest)) {
              this.stop()
              return
            }
            if (this.destHasMoved()) {
              this.realDest.i = this.dest.i
              this.realDest.j = this.dest.j
              this.realDest.x = this.dest.x
              this.realDest.y = this.dest.y
              const oldDeg = this.degree
              this.degree = getInstanceDegree(this, this.dest.x, this.dest.y)
              if (degreeToDirection(oldDeg) !== degreeToDirection(this.degree)) {
                this.setTextures('actionSheet')
              }
            }
          }
          onSpriteLoopAtFrame(this.sprite, 6, () => {
            const projectile = new Projectile(
              {
                owner: this,
                target: this.dest,
                type: this.projectile,
                destination: this.realDest,
              },
              this.context
            )
            map.addChild(projectile)
          })
        } else {
          this.startInterval(
            () => {
              if (!this.getActionCondition(this.dest)) {
                if (this.dest && this.dest.hitPoints <= 0) {
                  this.dest.die()
                }
                this.affectNewDest()
                return
              }
              if (this.destHasMoved()) {
                this.realDest.i = this.dest.i
                this.realDest.j = this.dest.j
                this.realDest.x = this.dest.x
                this.realDest.y = this.dest.y
                const oldDeg = this.degree
                this.degree = getInstanceDegree(this, this.dest.x, this.dest.y)
                if (degreeToDirection(oldDeg) !== degreeToDirection(this.degree)) {
                  this.setTextures('actionSheet')
                }
              }
              if (!this.isUnitAtDest(this.action, this.dest)) {
                this.sendTo(this.dest, 'attack')
                return
              }
              if (this.sounds && this.sounds.hit) {
                this.visible &&
                  sound.play(Array.isArray(this.sounds.hit) ? randomItem(this.sounds.hit) : this.sounds.hit)
              }
              if (this.dest.hitPoints > 0) {
                this.dest.hitPoints = getHitPointsWithDamage(this, this.dest)
                if (
                  this.dest.selected &&
                  (player.selectedUnit === this.dest ||
                    player.selectedBuilding === this.dest ||
                    player.selectedOther === this.dest)
                ) {
                  menu.updateInfo('hitPoints', this.dest.hitPoints + '/' + this.dest.totalHitPoints)
                }
                this.dest.isAttacked(this)
                if (this.dest.hitPoints <= 0) {
                  this.dest.die()
                  this.affectNewDest()
                }
              }
            },
            this.rateOfFire * 1000,
            false
          )
        }
        break
      case 'heal':
        if (!this.getActionCondition(this.dest)) {
          this.affectNewDest()
          return
        }
        this.setTextures('actionSheet')
        this.sprite.onLoop = () => {
          if (!this.getActionCondition(this.dest)) {
            this.affectNewDest()
            return
          }
          if (this.destHasMoved()) {
            this.realDest.i = this.dest.i
            this.realDest.j = this.dest.j
            this.realDest.x = this.dest.x
            this.realDest.y = this.dest.y
            const oldDeg = this.degree
            this.degree = getInstanceDegree(this, this.dest.x, this.dest.y)
            if (degreeToDirection(oldDeg) !== degreeToDirection(this.degree)) {
              this.setTextures('actionSheet')
            }
          }
          if (!this.isUnitAtDest(this.action, this.dest)) {
            this.sendTo(this.dest, 'heal')
            return
          }
          if (this.dest.hitPoints < this.dest.totalHitPoints) {
            this.dest.hitPoints = Math.min(this.dest.hitPoints + this.healing, this.dest.totalHitPoints)
            if (this.dest.selected && player.selectedUnit === this.dest) {
              menu.updateInfo('hitPoints', this.dest.hitPoints + '/' + this.dest.totalHitPoints)
            }
          }
        }
        break
      case 'takemeat':
        if (!this.getActionCondition(this.dest)) {
          this.affectNewDest()
          return
        }
        this.setTextures('actionSheet')
        this.startInterval(
          () => {
            if (!this.getActionCondition(this.dest)) {
              this.affectNewDest()
              return
            }
            // Villager is full we send him delivery first
            if (this.loading === this.loadingMax[this.loadingType] || !this.dest) {
              this.sendToDelivery()
              return
            }
            // Villager take meat
            this.visible && sound.play('5178')

            this.loading++
            this.loadingType = 'meat'
            this.updateInterfaceLoading()

            this.dest.quantity = Math.max(this.dest.quantity - 1, 0)
            this.dest.updateTexture()
            if (this.dest.selected && this.owner.isPlayed) {
              menu.updateInfo('quantity-text', this.dest.quantity)
            }
            // Set the walking with meat animation
            if (this.loading > 0) {
              if (this.allAssets[this.work]) {
                this.walkingSheet = Assets.cache.get(this.allAssets[this.work].loadedSheet)
              }
              this.standingSheet = null
            }
            // Destroy corps if it out of quantity
            if (this.dest.quantity <= 0) {
              this.affectNewDest()
            }
          },
          (1 / this.gatheringRate[this.work]) * 1000,
          false
        )
        break
      case 'fishing':
        if (!this.getActionCondition(this.dest)) {
          this.affectNewDest()
          return
        }
        this.setTextures('actionSheet')
        this.startInterval(
          () => {
            if (!this.getActionCondition(this.dest)) {
              this.affectNewDest()
              return
            }
            // Villager is full we send him delivery first
            if (this.loading === this.loadingMax[this.loadingType] || !this.dest) {
              this.sendToDelivery()
              return
            }
            // Villager fish
            this.loading++
            this.loadingType = 'fish'
            this.updateInterfaceLoading()

            this.dest.quantity = Math.max(this.dest.quantity - 1, 0)
            if (this.dest.selected && this.owner.isPlayed) {
              menu.updateInfo('quantity-text', this.dest.quantity)
            }
            // Set the walking with meat animation
            if (this.loading > 0) {
              if (this.allAssets && this.allAssets[this.work]) {
                this.walkingSheet = Assets.cache.get(this.allAssets[this.work].loadedSheet)
              }
              this.standingSheet = null
            }
            // Destroy corps if it out of quantity
            if (this.dest.quantity <= 0) {
              this.affectNewDest()
            }
          },
          (1 / this.gatheringRate[this.work]) * 1000,
          false
        )
        if (this.category !== 'Boat') {
          onSpriteLoopAtFrame(this.sprite, 6, () => {
            this.visible && sound.play('5125')
          })
        }
        break
      case 'hunt':
        if (!this.getActionCondition(this.dest)) {
          this.affectNewDest()
          return
        }
        if (this.dest.isDead) {
          this.previousDest ? this.goBackToPrevious() : this.sendToTakeMeat(this.dest)
        }
        this.setTextures('actionSheet')
        this.sprite.onLoop = () => {
          if (!this.getActionCondition(this.dest)) {
            if (this.dest && this.dest.hitPoints <= 0) {
              this.dest.die()
              this.previousDest ? this.goBackToPrevious() : this.sendToTakeMeat(this.dest)
              return
            }
            this.affectNewDest()
            return
          }
          if (!this.isUnitAtDest(this.action, this.dest)) {
            this.stop()
            return
          }
          if (this.destHasMoved()) {
            this.realDest.i = this.dest.i
            this.realDest.j = this.dest.j
            this.realDest.x = this.dest.x
            this.realDest.y = this.dest.y
            const oldDeg = this.degree
            this.degree = getInstanceDegree(this, this.dest.x, this.dest.y)
            if (degreeToDirection(oldDeg) !== degreeToDirection(this.degree)) {
              this.setTextures('actionSheet')
            }
          }
        }
        onSpriteLoopAtFrame(this.sprite, 6, () => {
          const projectile = new Projectile(
            {
              owner: this,
              target: this.dest,
              type: 'Spear',
              destination: this.realDest,
              damage: 4,
            },
            this.context
          )
          map.addChild(projectile)
        })
        break
      default:
        this.stop()
    }
  }

  detect(instance) {
    if (
      this.work === 'attacker' &&
      instance &&
      instance.family === 'unit' &&
      !this.path.length &&
      !this.dest &&
      this.getActionCondition(instance, 'attack')
    ) {
      this.sendTo(instance, 'attack')
    }
  }

  handleAffectNewDestHunter() {
    const firstTargets = findInstancesInSight(this, instance => this.getActionCondition(instance, 'takemeat'))
    if (firstTargets.length) {
      const target = getClosestInstanceWithPath(this, firstTargets)
      if (target) {
        if (this.action !== 'takemeat') {
          this.action = 'takemeat'
          if (this.allAssets[this.work]) {
            this.actionSheet = Assets.cache.get(this.allAssets[this.work].harvestSheet)
          }
        }
        if (instanceContactInstance(this, target)) {
          this.degree = getInstanceDegree(this, target.x, target.y)
          this.getAction(this.action)
          return true
        }
        this.setDest(target.instance)
        this.setPath(target.path)
        return true
      }
    }
    const secondTargets = findInstancesInSight(this, instance => this.getActionCondition(instance, 'hunt'))
    if (secondTargets.length) {
      const target = getClosestInstanceWithPath(this, secondTargets)
      if (target) {
        if (this.action !== 'hunt') {
          this.action = 'hunt'
          if (this.allAssets[this.work]) {
            this.actionSheet = Assets.cache.get(this.allAssets[this.work].actionSheet)
          }
        }
        if (instanceContactInstance(this, target)) {
          this.degree = getInstanceDegree(this, target.x, target.y)
          this.getAction(this.action)
          return true
        }
        this.setDest(target.instance)
        this.setPath(target.path)
        return true
      }
    }
    return false
  }

  upgrade(type) {
    const data = this.owner.config.units[type]
    this.type = type
    this.hitPoints = data.totalHitPoints - (this.totalHitPoints - this.hitPoints)
    for (const [key, value] of Object.entries(data)) {
      this[key] = value
    }
    for (const [key, value] of Object.entries(this.assets)) {
      this[key] = Assets.cache.get(value)
    }
    if (this.action && !this.path.length) {
      this.getAction(this.action)
    } else {
      this.setTextures(this.currentSheet)
    }
  }

  affectNewDest() {
    this.stopInterval()
    if (this.previousDest && this.work !== 'delivery') {
      this.goBackToPrevious()
      return
    }
    let handleSuccess = false
    if (this.type === 'Villager' && (this.action === 'takemeat' || this.action === 'hunt')) {
      handleSuccess = this.handleAffectNewDestHunter()
    } else if (!this.dest || this.dest.name !== 'animal') {
      const targets = findInstancesInSight(this, instance => this.getActionCondition(instance))
      if (targets.length) {
        const target = getClosestInstanceWithPath(this, targets)
        if (target) {
          if (instanceContactInstance(this, target)) {
            this.degree = getInstanceDegree(this, target.x, target.y)
            this.getAction(this.action)
            return
          }
          this.setDest(target.instance)
          this.setPath(target.path)
          return
        }
      }
    }
    if (!handleSuccess) {
      const notDeliveryWork = ['builder', 'attacker', 'healer']
      if (this.loading && !notDeliveryWork.includes(this.work)) {
        this.sendToDelivery()
      } else {
        this.stop()
      }
    }
  }

  isUnitAtDest(action, dest) {
    if (!action) {
      return false
    }
    if (!dest) {
      this.affectNewDest()
      return false
    }
    if ((this.type !== 'Villager' || action === 'hunt') && this.range && instancesDistance(this, dest) <= this.range) {
      return true
    }
    return instanceContactInstance(this, dest)
  }

  destHasMoved() {
    return (
      (this.dest.i !== this.realDest.i || this.dest.j !== this.realDest.j) &&
      instancesDistance(this, this.dest) <= this.sight
    )
  }

  moveToPath() {
    const {
      context: { map },
    } = this
    const next = this.path[this.path.length - 1]
    const nextCell = map.grid[next.i][next.j]
    if (!this.dest || this.dest.isDestroyed) {
      this.affectNewDest()
      return
    }
    // Collision with another walking unit, we block the mouvement
    if (
      nextCell.has &&
      nextCell.has.family === 'unit' &&
      nextCell.has.name !== this.name &&
      nextCell.has.hasPath() &&
      instancesDistance(this, nextCell.has) <= 1 &&
      nextCell.has.sprite.playing
    ) {
      this.sprite.stop()
      return
    }
    if (nextCell.solid && this.dest) {
      this.sendTo(this.dest, this.action)
      return
    }

    if (!this.sprite.playing) {
      this.sprite.play()
    }

    this.zIndex = getInstanceZIndex(this)
    if (instancesDistance(this, nextCell, false) <= this.speed) {
      clearCellOnInstanceSight(this)
      this.z = nextCell.z
      this.i = nextCell.i
      this.j = nextCell.j
      if (this.currentCell.has === this) {
        this.currentCell.has = null
        this.currentCell.solid = false
      }
      this.currentCell = map.grid[this.i][this.j]
      if (this.currentCell.has === null) {
        this.currentCell.has = this
        this.currentCell.solid = true
      }
      renderCellOnInstanceSight(this)
      this.path.pop()

      // Destination moved
      if (this.destHasMoved()) {
        this.sendTo(this.dest, this.action)
        return
      }
      if (this.isUnitAtDest(this.action, this.dest)) {
        this.path = []
        this.stopInterval()
        this.degree = getInstanceDegree(this, this.dest.x, this.dest.y)
        this.getAction(this.action)
        return
      }

      if (!this.path.length) {
        this.stop()
      }
    } else {
      const {
        context: { menu, player },
      } = this
      // Move to next
      const oldDeg = this.degree
      let speed = this.speed
      if (this.loading > 0) {
        speed *= 0.8
      }
      moveTowardPoint(this, nextCell.x, nextCell.y, this.speed)
      canUpdateMinimap(this, player) && menu.updatePlayerMiniMap(this.owner)
      if (degreeToDirection(oldDeg) !== degreeToDirection(this.degree)) {
        // Change animation according to degree
        this.setTextures('walkingSheet')
      }
    }
  }

  isAttacked(instance) {
    if (!instance || this.dest === instance || this.isDead) {
      return
    }
    const currentDest = this.dest
    if (this.type === 'Villager') {
      if (instance.family === 'animal') {
        this.sendToHunt(instance)
      } else {
        this.sendToAttack(instance)
      }
    } else {
      this.sendTo(instance, 'attack')
    }
    this.previousDest = currentDest
  }

  stop() {
    if (this.currentCell.has.name !== this.name && this.currentCell.solid) {
      this.sendTo(this.currentCell)
      return
    }
    this.handleChangeDest()
    this.inactif = true
    this.action = null
    this.dest = null
    this.realDest = null
    this.currentCell.has = this
    this.currentCell.solid = true
    this.path = []
    this.stopInterval()
    this.setTextures('standingSheet')
  }

  startInterval(callback, time, immediate = true) {
    const finalCb = () => {
      const { paused } = this.context
      if (paused) {
        return
      }
      callback()
    }
    if (this.isDead) {
      return
    }
    this.stopInterval()
    immediate && finalCb()
    this.interval = setInterval(finalCb, time)
  }

  stopInterval() {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  step() {
    if (this.hitPoints <= 0) {
      this.die()
    } else if (this.hasPath()) {
      this.moveToPath()
    }
  }

  explore() {
    const {
      context: { map },
    } = this
    let dest
    for (let i = 3; i < 50; i++) {
      getCellsAroundPoint(this.i, this.j, map.grid, i, cell => {
        if (!this.owner.views[cell.i][cell.j].viewed && !cell.solid) {
          dest = this.owner.views[cell.i][cell.j]
          return
        }
      })
      if (dest) {
        this.sendTo(dest)
        break
      }
    }
  }

  runaway(instance) {
    const {
      context: { map },
    } = this
    let dest = null
    getCellsAroundPoint(this.i, this.j, map.grid, this.sight, cell => {
      if (
        !cell.solid &&
        (!dest ||
          pointsDistance(cell.i, cell.j, instance.i, instance.j) >
            pointsDistance(dest.i, dest.j, instance.i, instance.j))
      ) {
        dest = this.owner.views[cell.i][cell.j]
        return
      }
    })
    if (dest) {
      this.sendTo(dest)
    } else {
      this.stop()
    }
  }

  decompose() {
    const {
      context: { map },
    } = this
    this.setTextures('corpseSheet')
    this.sprite.animationSpeed = (1 / (CORPSE_TIME * 1000)) * ACCELERATOR
    if (map.grid[this.i][this.j].has === this) {
      map.grid[this.i][this.j].has = null
      map.grid[this.i][this.j].corpses.push(this)
      map.grid[this.i][this.j].solid = false
    }
    this.sprite.onComplete = () => {
      //this.clear()
    }
  }

  death() {
    this.setTextures('dyingSheet')
    this.zIndex--
    this.sprite.loop = false
    this.sprite.onComplete = () => {
      clearCellOnInstanceSight(this)
      // Remove from player units
      let index = this.owner.corpses.indexOf(this)
      if (index < 0) {
        this.owner.corpses.push(this)
      }
      this.decompose()
    }
  }

  die() {
    if (this.isDead) {
      return
    }
    const {
      context: { player, menu },
    } = this

    this.sounds &&
      this.sounds.die &&
      this.visible &&
      sound.play(Array.isArray(this.sounds.die) ? randomItem(this.sounds.die) : this.sounds.die)

    this.stopInterval()
    if (this.selected && player.selectedOther === this) {
      player.unselectUnit(this)
    }
    if (this.dest && this.dest.isUsedBy === this) {
      this.dest.isUsedBy = null
    }
    this.hitPoints = 0
    this.path = []
    this.action = null
    this.eventMode = 'none'
    this.isDead = true
    this.unselect()
    if (this.owner) {
      this.owner.population--
      if (this.owner.isPlayed && this.owner.selectedBuilding && this.owner.selectedBuilding.displayPopulation) {
        menu.updateInfo(
          'population-text',
          this.owner.population + '/' + Math.min(POPULATION_MAX, this.owner.POPULATION_MAX)
        )
      }
      // Remove from player units
      let index = this.owner.units.indexOf(this)
      if (index >= 0) {
        this.owner.units.splice(index, 1)
      }
      // Update from player selected unit
      if (this.owner.selectedUnit === this) {
        menu.updateInfo('hitPoints', this.hitPoints + '/' + this.totalHitPoints)
      }
    }
    this.death()
    canUpdateMinimap(this, player) && menu.updatePlayerMiniMapEvt(this.owner)
  }

  clear() {
    const {
      context: { map },
    } = this
    this.isDestroyed = true
    // Remove from player units
    let index = this.owner.corpses.indexOf(this)
    if (index >= 0) {
      this.owner.corpses.splice(index, 1)
    }
    // Remove from map corpses
    const corpsesIndex = map.grid[this.i][this.j].corpses.indexOf(this)
    if (index >= 0) {
      map.grid[this.i][this.j].corpses.splice(corpsesIndex, 1)
    }
    map.removeChild(this)
    this.destroy({ child: true, texture: true })
  }

  setTextures(sheet) {
    setUnitTexture(sheet, this, ACCELERATOR)
  }

  updateInterfaceLoading() {
    const {
      context: { menu },
    } = this
    if (this.selected && this.owner.isPlayed && this.owner.selectedUnit === this) {
      if (this.loading === 1) {
        menu.updateInfo('loading', element => (element.innerHTML = this.getLoadingElement().innerHTML))
      } else if (this.loading > 1) {
        menu.updateInfo('loading-text', this.loading)
      } else {
        menu.updateInfo('loading', element => (element.innerHTML = ''))
      }
    }
  }

  getLoadingElement() {
    const {
      context: { menu },
    } = this
    const loadingDiv = document.createElement('div')
    loadingDiv.className = 'unit-loading'
    loadingDiv.id = 'loading'

    if (this.loading) {
      const iconImg = document.createElement('img')
      iconImg.className = 'unit-loading-icon'
      iconImg.src = menu.infoIcons[LOADING_FOOD_TYPES.includes(this.loadingType) ? 'food' : this.loadingType]
      const textDiv = document.createElement('div')
      textDiv.id = 'loading-text'
      textDiv.textContent = this.loading
      loadingDiv.appendChild(iconImg)
      loadingDiv.appendChild(textDiv)
    }
    return loadingDiv
  }

  commonSendTo(target, work, action, keepPrevious) {
    const {
      context: { menu },
    } = this
    const workFromLoading = getWorkWithLoadingType(this.loadingType)
    if (
      work !== 'builder' &&
      work !== workFromLoading &&
      !(WORK_FOOD_TYPES.includes(work) && WORK_FOOD_TYPES.includes(workFromLoading))
    ) {
      this.loading = 0
      this.loadingType = null
      this.updateInterfaceLoading()
    }
    if (this.work !== work || this.action !== action) {
      this.work = work
      this.owner.isPlayed && this.owner.selectedUnit === this && menu.updateInfo('type', this.work)
      if (this.allAssets && this.allAssets[work]) {
        this.actionSheet = getActionSheet(work, action, Assets, this)
        if (!this.loading) {
          this.standingSheet = Assets.cache.get(this.allAssets[work]['standingSheet'])
          this.walkingSheet = Assets.cache.get(this.allAssets[work]['walkingSheet'])
          this.dyingSheet = Assets.cache.get(this.allAssets[work]['dyingSheet'])
          this.corpseSheet = Assets.cache.get(this.allAssets[work]['corpseSheet'])
        }
      }
    }
    this.previousDest = keepPrevious ? this.previousDest : null
    return this.sendTo(target, action)
  }

  sendToDelivery() {
    const {
      context: { map },
    } = this
    let buildingTypes = []
    if (this.category === 'Boat') {
      buildingTypes = ['Dock']
    } else {
      buildingTypes = ['TownCenter']
      const buildings = {
        Granary: this.owner.config.buildings.Granary,
        StoragePit: this.owner.config.buildings.StoragePit,
      }
      for (const [key, value] of Object.entries(buildings)) {
        if (value.accept && value.accept.includes(this.loadingType)) {
          buildingTypes.push(key)
          break
        }
      }
    }

    const targets = this.owner.buildings.filter(building =>
      getActionCondition(this, building, 'delivery', { buildingTypes })
    )
    const target = getClosestInstance(this, targets)
    if (this.dest) {
      this.previousDest = this.dest
    } else {
      this.previousDest = map.grid[this.i][this.j]
    }
    this.sendTo(target, 'delivery')
  }

  sendToFish(target) {
    return this.commonSendTo(target, 'fisher', 'fishing')
  }

  sendToAttack(target) {
    return this.commonSendTo(target, 'attacker', 'attack', { resource: 'attack' })
  }

  sendToTakeMeat(target) {
    return this.commonSendTo(target, 'hunter', 'takemeat', { actionSheet: 'harvestSheet' })
  }

  sendToHunt(target) {
    return this.commonSendTo(target, 'hunter', 'hunt')
  }

  sendToBuilding(target) {
    return this.commonSendTo(target, 'builder', 'build')
  }

  sendToFarm(target) {
    return this.commonSendTo(target, 'farmer', 'farm')
  }

  sendToTree(target) {
    return this.commonSendTo(target, 'woodcutter', 'chopwood')
  }

  sendToBerrybush(target) {
    return this.commonSendTo(target, 'forager', 'forageberry')
  }

  sendToStone(target) {
    return this.commonSendTo(target, 'stoneminer', 'minestone')
  }

  sendToGold(target) {
    return this.commonSendTo(target, 'goldminer', 'minegold')
  }

  setDefaultInterface(element, data) {
    const civDiv = document.createElement('div')
    civDiv.id = 'civ'
    civDiv.textContent = this.owner.civ
    element.appendChild(civDiv)

    const typeDiv = document.createElement('div')
    typeDiv.id = 'type'
    typeDiv.textContent = this.type === 'Villager' ? this.work || this.type : this.type
    element.appendChild(typeDiv)

    const iconImg = document.createElement('img')
    iconImg.id = 'icon'
    iconImg.src = getIconPath(data.icon)
    element.appendChild(iconImg)

    const hitPointsDiv = document.createElement('div')
    hitPointsDiv.id = 'hitPoints'
    hitPointsDiv.textContent = this.hitPoints + '/' + this.totalHitPoints
    element.appendChild(hitPointsDiv)

    const infosDiv = document.createElement('div')
    infosDiv.id = 'infos'

    const infos = [
      ['meleeAttack', '007_50731'],
      ['pierceAttack', '006_50731'],
      ['meleeArmor', '008_50731'],
      ['pierceArmor', '010_50731'],
    ]

    for (let i = 0; i < infos.length; i++) {
      const info = infos[i]
      if (data[info[0]]) {
        const infoDiv = document.createElement('div')
        infoDiv.id = 'info'

        const attackImg = document.createElement('img')
        attackImg.src = getIconPath(info[1])
        const attackDiv = document.createElement('div')
        attackDiv.id = info[0]
        attackDiv.textContent = data[info[0]]
        infoDiv.appendChild(attackImg)
        infoDiv.appendChild(attackDiv)
        infosDiv.appendChild(infoDiv)
      }
    }

    element.appendChild(infosDiv)
  }
}
