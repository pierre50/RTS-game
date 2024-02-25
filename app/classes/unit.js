import { sound } from '@pixi/sound'
import { Container, Assets, AnimatedSprite, Graphics } from 'pixi.js'
import {
  accelerator,
  stepTime,
  corpseTime,
  loadingFoodTypes,
  maxSelectUnits,
  typeAction,
  populationMax,
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
} from '../lib'
import { Projectile } from './projectile'

/*
allAssets = {
  default: {
    standingSheet: '418',
    walkingSheet: '657',
    dyingSheet: '314',
    corpseSheet: '373',
  },
  attack: {
    actionSheet: '224',
    standingSheet: '418',
    dyingSheet: '314', // missing
    walkingSheet: '657', // missing
    corpseSheet: '373', // missing
  },
  hunter: {
    actionSheet: '624',
    harvestSheet: '626',
    standingSheet: '435',
    walkingSheet: '676',
    dyingSheet: '332',
    corpseSheet: '389',
    loadedSheet: '272',
  },
  farmer: {
    actionSheet: '630',
    standingSheet: '430',
    walkingSheet: '670',
    dyingSheet: '326',
    corpseSheet: '388',
    loadedSheet: '672',
  },
  forager: {
    actionSheet: '632',
    standingSheet: '432',
    walkingSheet: '672',
    dyingSheet: '328',
    corpseSheet: '390',
    loadedSheet: '672',
  },
  stoneminer: {
    actionSheet: '633',
    standingSheet: '441',
    walkingSheet: '683',
    dyingSheet: '315', // missing
    corpseSheet: '400',
    loadedSheet: '274',
  },
  goldminer: {
    actionSheet: '633',
    standingSheet: '441',
    walkingSheet: '683',
    dyingSheet: '315', // missing
    corpseSheet: '400',
    loadedSheet: '281',
  },
  woodcutter: {
    actionSheet: '625',
    standingSheet: '440',
    walkingSheet: '682',
    dyingSheet: '315', // missing
    corpseSheet: '399',
    loadedSheet: '273',
  },
  builder: {
    actionSheet: '628',
    standingSheet: '419',
    walkingSheet: '658', // to reupload yellow ?
    dyingSheet: '315',
    corpseSheet: '374',
  },
},*/

export class Unit extends Container {
  constructor(options, context) {
    super()

    this.context = context

    const {
      context: { map, menu },
    } = this
    this.setParent(map)
    this.id = uuidv4()
    this.name = 'unit'

    Object.keys(options).forEach(prop => {
      this[prop] = options[prop]
    })
    Object.keys(this.owner.config.units[this.type]).forEach(prop => {
      this[prop] = this.owner.config.units[this.type][prop]
    })

    this.x = map.grid[this.i][this.j].x
    this.y = map.grid[this.i][this.j].y
    this.z = map.grid[this.i][this.j].z
    this.dest = null
    this.realDest = null
    this.previousDest = null
    this.path = []
    this.zIndex = getInstanceZIndex(this)
    this.selected = false
    this.degree = randomRange(1, 360)
    this.currentFrame = randomRange(0, 4)
    this.action = null
    this.loading = 0
    this.loadingType = null
    this.currentSheet = null
    this.size = 1
    this.visible = false
    this.currentCell = map.grid[this.i][this.j]
    this.currentCell.has = this
    this.currentCell.solid = true
    this.isDead = false
    this.isDestroyed = false

    switch (this.type) {
      case 'Villager':
        this.work = null
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

    this.hitPoints = this.totalHitPoints
    this.inactif = true

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
                icon: 'interface/50721/002_50721.png',
                children: Object.keys(this.owner.config.buildings).map(key => menu.getBuildingButton(key)),
              },
            ]
          : [],
    }

    this.allowMove = false
    this.eventMode = 'static'
    this.sprite = new AnimatedSprite(this.standingSheet.animations['south'])
    this.sprite.name = 'sprite'
    this.sprite.allowMove = false
    this.sprite.eventMode = 'auto'
    this.sprite.allowClick = false
    this.sprite.roundPixels = true

    this.sendTo = throttle(this.sendToEvt, 100)

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
              player.selectedUnits.length < maxSelectUnits &&
              cell.has &&
              cell.has.owner &&
              cell.has.owner.id === this.owner.id &&
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
    this.sprite.updateAnchor = true
    this.addChild(this.sprite)

    this.stop()

    renderCellOnInstanceSight(this)
  }

  select() {
    if (this.selected) {
      return
    }
    const {
      context: { menu },
    } = this

    this.selected = true
    const selection = new Graphics()
    selection.name = 'selection'
    selection.zIndex = 3
    selection.lineStyle(1, 0xffffff)
    const path = [-32 * 0.5, 0, 0, -16 * 0.5, 32 * 0.5, 0, 0, 16 * 0.5]
    selection.drawPolygon(path)
    this.addChildAt(selection, 0)

    menu.updatePlayerMiniMapEvt(this.owner)
  }

  unselect() {
    if (!this.selected) {
      return
    }
    const {
      context: { menu },
    } = this

    this.selected = false
    const selection = this.getChildByName('selection')
    if (selection) {
      this.removeChild(selection)
    }
    menu.updatePlayerMiniMapEvt(this.owner)
  }

  hasPath() {
    return this.path.length > 0
  }

  setDest(dest) {
    if (!dest) {
      this.stop()
      return
    }
    this.dest = dest
    this.realDest = {
      i: dest.i,
      j: dest.j,
      x: dest.x,
      y: dest.y,
      id: dest.id,
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
    this.startInterval(() => this.step(), stepTime)
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
    if (!dest) {
      return
    }
    // Unit is already beside our target
    if (this.isUnitAtDest(action, dest)) {
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
    if (dest.name === 'animal') {
      if (this.getActionCondition(dest, 'takemeat')) {
        this.sendToTakeMeat(dest)
      } else {
        this.sendTo(map.grid[dest.i][dest.j], 'hunt')
      }
    } else if (dest.name === 'building') {
      if (this.getActionCondition(dest, 'build')) {
        this.sendToBuilding(dest)
      } else if (this.getActionCondition(dest, 'farm')) {
        this.sendToFarm(dest)
      } else {
        this.sendTo(map.grid[dest.i][dest.j], 'build')
      }
    } else if (typeAction[type]) {
      if (this.getActionCondition(dest, typeAction[type])) {
        const sendToFunc = `sendTo${type}`
        typeof this[sendToFunc] === 'function' ? this[sendToFunc](dest) : this.stop()
      } else {
        this.sendTo(map.grid[dest.i][dest.j], typeAction[type])
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
        this.owner[loadingFoodTypes.includes(this.loadingType) ? 'food' : this.loadingType] += this.loading
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
            if (this.dest.selected && this.owner.isPlayed) {
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

              if (this.dest.selected && this.owner.isPlayed) {
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
              if (this.dest.selected && this.owner.isPlayed) {
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
            if (this.dest.selected && this.owner.isPlayed) {
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
            if (this.dest.selected && this.owner.isPlayed) {
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
            if (this.dest.selected && this.owner.isPlayed) {
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
                this.dest.updateHitPoints(this.action)
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
      instance.name === 'unit' &&
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
      nextCell.has.name === 'unit' &&
      nextCell.has.id !== this.id &&
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
        context: { menu },
      } = this
      // Move to next
      const oldDeg = this.degree
      let speed = this.speed
      if (this.loading > 0) {
        speed *= 0.8
      }
      moveTowardPoint(this, nextCell.x, nextCell.y, this.speed)
      menu.updatePlayerMiniMap(this.owner)
      if (degreeToDirection(oldDeg) !== degreeToDirection(this.degree)) {
        // Change animation according to degree
        this.setTextures('walkingSheet')
      }
    }
  }

  isAttacked(instance) {
    if (!instance || this.dest === instance) {
      return
    }
    const currentDest = this.dest
    if (this.type === 'Villager') {
      if (instance.name === 'animal') {
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
    if (this.currentCell.has.id !== this.id && this.currentCell.solid) {
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
    if (this.isDead) {
      return
    }
    this.stopInterval()
    immediate && callback()
    this.interval = setInterval(callback, time)
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

  die() {
    if (this.isDead) {
      return
    }
    const {
      context: { player, map, menu },
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
          this.owner.population + '/' + Math.min(populationMax, this.owner.populationMax)
        )
      }
      // Remove from player units
      let index = this.owner.units.indexOf(this)
      if (index >= 0) {
        this.owner.units.splice(index, 1)
      }
      // Remove from player selected units
      if (this.owner.selectedUnits) {
        index = this.owner.selectedUnits.indexOf(this)
        if (index >= 0) {
          this.owner.selectedUnits.splice(index, 1)
        }
      }
    }

    this.setTextures('dyingSheet')
    this.sprite.loop = false
    this.sprite.onComplete = () => {
      clearCellOnInstanceSight(this)
      this.setTextures('corpseSheet')
      this.zIndex--
      if (map.grid[this.i][this.j].has === this) {
        map.grid[this.i][this.j].has = null
        map.grid[this.i][this.j].corpses.push(this)
        map.grid[this.i][this.j].solid = false
      }
      this.sprite.animationSpeed = (1 / (corpseTime * 1000)) * accelerator
      this.sprite.onComplete = () => {
        this.clear()
      }
    }
  }

  clear() {
    if (this.isDestroyed) {
      return
    }
    const {
      context: { map },
    } = this
    this.isDestroyed = true
    map.grid[this.i][this.j].corpses.splice(map.grid[this.i][this.j].corpses.indexOf(this), 1)
    map.removeChild(this)
    this.destroy({ child: true, texture: true })
  }

  setTextures(sheet) {
    const sheetToReset = ['actionSheet']
    // Sheet don't exist we just block the current sheet
    if (!this[sheet]) {
      if (this.currentSheet !== 'walkingSheet' && this.walkingSheet) {
        this.sprite.textures = [this.walkingSheet.textures[Object.keys(this.walkingSheet.textures)[0]]]
      } else {
        this.sprite.textures = [this.sprite.textures[this.sprite.currentFrame]]
      }
      this.currentSheet = 'walkingSheet'
      this.sprite.stop()
      this.sprite.anchor.set(
        this.sprite.textures[this.sprite.currentFrame].defaultAnchor.x,
        this.sprite.textures[this.sprite.currentFrame].defaultAnchor.y
      )
      return
    }
    // Reset action loop
    if (!sheetToReset.includes(sheet)) {
      this.sprite.onLoop = null
      this.sprite.onFrameChange = null
    }
    this.currentSheet = sheet
    const direction = degreeToDirection(this.degree)
    switch (direction) {
      case 'southest':
        this.sprite.scale.x = -1
        this.sprite.textures = this[sheet].animations['southwest']
        break
      case 'northest':
        this.sprite.scale.x = -1
        this.sprite.textures = this[sheet].animations['northwest']
        break
      case 'est':
        this.sprite.scale.x = -1
        this.sprite.textures = this[sheet].animations['west']
        break
      default:
        this.sprite.scale.x = 1
        this.sprite.textures = this[sheet].animations[direction]
    }
    this.sprite.animationSpeed =
      (this[sheet].data.animationSpeed || (sheet === 'standingSheet' ? 0.15 : 0.3)) * accelerator
    this.sprite.play()
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
      iconImg.src = menu.infoIcons[loadingFoodTypes.includes(this.loadingType) ? 'food' : this.loadingType]
      const textDiv = document.createElement('div')
      textDiv.id = 'loading-text'
      textDiv.textContent = this.loading
      loadingDiv.appendChild(iconImg)
      loadingDiv.appendChild(textDiv)
    }
    return loadingDiv
  }

  sendToFish(target) {
    const {
      context: { menu, map },
    } = this
    if (!loadingFoodTypes.includes(this.loadingType)) {
      this.loading = 0
      this.updateInterfaceLoading()
    }
    if (this.work !== 'fisher') {
      this.work = 'fisher'
      this.owner.isPlayed && this.owner.selectedUnit === this && menu.updateInfo('type', this.work)
      if (this.allAssets && this.allAssets.fisher) {
        this.actionSheet = Assets.cache.get(this.allAssets.fisher.actionSheet)
        this.standingSheet = Assets.cache.get(this.allAssets.fisher.standingSheet)
        if (!this.loading) {
          this.walkingSheet = Assets.cache.get(this.allAssets.fisher.walkingSheet)
          this.dyingSheet = Assets.cache.get(this.allAssets.fisher.dyingSheet)
          this.corpseSheet = Assets.cache.get(this.allAssets.fisher.corpseSheet)
        }
      }
    }
    this.previousDest = null
    return this.sendTo(target, 'fishing')
  }

  sendToAttack(target) {
    const {
      context: { menu },
    } = this
    if (work !== 'attacker') {
      this.work = 'attacker'
      this.owner.isPlayed && this.owner.selectedUnit === this && menu.updateInfo('type', this.type)
      this.actionSheet = Assets.cache.get(this.allAssets.attack.actionSheet)
      this.standingSheet = Assets.cache.get(this.allAssets.attack.standingSheet)
      if (!this.loading) {
        this.walkingSheet = Assets.cache.get(this.allAssets.attack.walkingSheet)
        this.dyingSheet = Assets.cache.get(this.allAssets.attack.dyingSheet)
        this.corpseSheet = Assets.cache.get(this.allAssets.attack.corpseSheet)
      }
    }
    this.previousDest = null
    return this.sendTo(target, 'attack')
  }

  sendToTakeMeat(target) {
    const {
      context: { menu },
    } = this
    if (!loadingFoodTypes.includes(this.loadingType)) {
      this.loading = 0
      this.updateInterfaceLoading()
    }
    if (this.work !== 'hunter' || this.action !== 'takemeat') {
      this.work = 'hunter'
      this.owner.isPlayed && this.owner.selectedUnit === this && menu.updateInfo('type', this.work)
      this.actionSheet = Assets.cache.get(this.allAssets.hunter.harvestSheet)
      this.standingSheet = Assets.cache.get(this.allAssets.hunter.standingSheet)
      if (!this.loading) {
        this.walkingSheet = Assets.cache.get(this.allAssets.hunter.walkingSheet)
        this.dyingSheet = Assets.cache.get(this.allAssets.hunter.dyingSheet)
        this.corpseSheet = Assets.cache.get(this.allAssets.hunter.corpseSheet)
      }
    }
    this.previousDest = null
    return this.sendTo(target, 'takemeat')
  }

  sendToHunt(target) {
    const {
      context: { menu },
    } = this
    if (!loadingFoodTypes.includes(this.loadingType)) {
      this.loading = 0
      this.updateInterfaceLoading()
    }
    if (this.work !== 'hunter' || this.action !== 'hunt') {
      this.work = 'hunter'
      this.owner.isPlayed && this.owner.selectedUnit === this && menu.updateInfo('type', this.work)
      this.actionSheet = Assets.cache.get(this.allAssets.hunter.actionSheet)
      this.standingSheet = Assets.cache.get(this.allAssets.hunter.standingSheet)
      if (!this.loading) {
        this.walkingSheet = Assets.cache.get(this.allAssets.hunter.walkingSheet)
        this.dyingSheet = Assets.cache.get(this.allAssets.hunter.dyingSheet)
        this.corpseSheet = Assets.cache.get(this.allAssets.hunter.corpseSheet)
      }
    }
    this.previousDest = null
    return this.sendTo(target, 'hunt')
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

  sendToBuilding(building) {
    const {
      context: { menu },
    } = this
    if (this.work !== 'builder') {
      this.updateInterfaceLoading()
      this.work = 'builder'
      this.owner.isPlayed && this.owner.selectedUnit === this && menu.updateInfo('type', this.work)
      this.actionSheet = Assets.cache.get(this.allAssets.builder.actionSheet)
      if (!this.loading) {
        this.standingSheet = Assets.cache.get(this.allAssets.builder.standingSheet)
        this.walkingSheet = Assets.cache.get(this.allAssets.builder.walkingSheet)
        this.dyingSheet = Assets.cache.get(this.allAssets.builder.dyingSheet)
        this.corpseSheet = Assets.cache.get(this.allAssets.builder.corpseSheet)
      }
    }
    this.previousDest = null
    return this.sendTo(building, 'build')
  }

  sendToFarm(farm) {
    const {
      context: { menu },
    } = this
    if (!loadingFoodTypes.includes(this.loadingType)) {
      this.loading = 0
      this.updateInterfaceLoading()
    }
    if (this.work !== 'farmer') {
      this.work = 'farmer'
      this.owner.isPlayed && this.owner.selectedUnit === this && menu.updateInfo('type', this.work)
      this.actionSheet = Assets.cache.get(this.allAssets.farmer.actionSheet)
      if (!this.loading) {
        this.standingSheet = Assets.cache.get(this.allAssets.farmer.standingSheet)
        this.walkingSheet = Assets.cache.get(this.allAssets.farmer.walkingSheet)
        this.dyingSheet = Assets.cache.get(this.allAssets.farmer.dyingSheet)
        this.corpseSheet = Assets.cache.get(this.allAssets.farmer.corpseSheet)
      }
    }
    this.previousDest = null
    return this.sendTo(farm, 'farm')
  }

  sendToTree(tree) {
    const {
      context: { menu },
    } = this
    if (this.work !== 'woodcutter') {
      this.loading = 0
      this.updateInterfaceLoading()
      this.work = 'woodcutter'
      this.owner.isPlayed && this.owner.selectedUnit === this && menu.updateInfo('type', this.work)
      this.actionSheet = Assets.cache.get(this.allAssets.woodcutter.actionSheet)
      this.standingSheet = Assets.cache.get(this.allAssets.woodcutter.standingSheet)
      this.walkingSheet = Assets.cache.get(this.allAssets.woodcutter.walkingSheet)
      this.dyingSheet = Assets.cache.get(this.allAssets.woodcutter.dyingSheet)
      this.corpseSheet = Assets.cache.get(this.allAssets.woodcutter.corpseSheet)
    }
    this.previousDest = null
    return this.sendTo(tree, 'chopwood')
  }

  sendToBerrybush(berrybush) {
    const {
      context: { menu },
    } = this
    if (!loadingFoodTypes.includes(this.loadingType)) {
      this.loading = 0
      this.updateInterfaceLoading()
    }
    if (this.work !== 'forager') {
      this.work = 'forager'
      this.owner.isPlayed && this.owner.selectedUnit === this && menu.updateInfo('type', this.work)
      this.actionSheet = Assets.cache.get(this.allAssets.forager.actionSheet)
      if (!this.loading) {
        this.standingSheet = Assets.cache.get(this.allAssets.forager.standingSheet)
        this.walkingSheet = Assets.cache.get(this.allAssets.forager.walkingSheet)
        this.dyingSheet = Assets.cache.get(this.allAssets.forager.dyingSheet)
        this.corpseSheet = Assets.cache.get(this.allAssets.forager.corpseSheet)
      }
    }
    this.previousDest = null
    return this.sendTo(berrybush, 'forageberry')
  }

  sendToStone(stone) {
    const {
      context: { menu },
    } = this
    if (this.work !== 'stoneminer') {
      this.loading = 0
      this.updateInterfaceLoading()
      this.work = 'stoneminer'
      this.owner.isPlayed && this.owner.selectedUnit === this && menu.updateInfo('type', this.work)
      this.actionSheet = Assets.cache.get(this.allAssets.stoneminer.actionSheet)
      this.standingSheet = Assets.cache.get(this.allAssets.stoneminer.standingSheet)
      this.walkingSheet = Assets.cache.get(this.allAssets.stoneminer.walkingSheet)
      this.dyingSheet = Assets.cache.get(this.allAssets.stoneminer.dyingSheet)
      this.corpseSheet = Assets.cache.get(this.allAssets.stoneminer.corpseSheet)
    }
    this.previousDest = null
    return this.sendTo(stone, 'minestone')
  }

  sendToGold(gold) {
    const {
      context: { menu },
    } = this
    if (this.work !== 'goldminer') {
      this.loading = 0
      this.updateInterfaceLoading()
      this.work = 'goldminer'
      this.owner.isPlayed && this.owner.selectedUnit === this && menu.updateInfo('type', this.work)
      this.actionSheet = Assets.cache.get(this.allAssets.goldminer.actionSheet)
      this.standingSheet = Assets.cache.get(this.allAssets.goldminer.standingSheet)
      this.walkingSheet = Assets.cache.get(this.allAssets.goldminer.walkingSheet)
      this.dyingSheet = Assets.cache.get(this.allAssets.goldminer.dyingSheet)
      this.corpseSheet = Assets.cache.get(this.allAssets.goldminer.corpseSheet)
    }
    this.previousDest = null
    return this.sendTo(gold, 'minegold')
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
