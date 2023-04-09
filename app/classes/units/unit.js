import { Container, Assets, AnimatedSprite, Graphics } from 'pixi.js'
import { accelerator, stepTime, corpseTime } from '../../constants'
import * as projectiles from '../projectiles/'
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
} from '../../lib'

export class Unit extends Container {
  constructor(options, context) {
    super()

    this.context = context

    const {
      context: { map },
    } = this
    this.setParent(map)
    this.id = map.children.length
    this.name = 'unit'

    Object.keys(options).forEach(prop => {
      this[prop] = options[prop]
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
    this.work = null
    this.loading = 0
    this.loadingType = null
    this.loadingMax = 10
    this.currentSheet = null
    this.size = 1
    this.visible = false
    this.currentCell = map.grid[this.i][this.j]
    this.currentCell.has = this
    this.currentCell.solid = true
    this.isDead = false
    this.isDestroyed = false

    this.life = this.lifeMax
    this.originalSpeed = this.speed
    this.inactif = true

    this.allowMove = false
    this.interactive = true
    const sprite = new AnimatedSprite(this.standingSheet.animations['south'])
    sprite.name = 'sprite'
    sprite.allowMove = false
    sprite.interactive = false
    sprite.allowClick = false
    sprite.roundPixels = true

    this.on('pointerup', () => {
      const {
        context: { controls, player, menu },
      } = this
      if (controls.mouseBuilding || controls.mouseRectangle || !controls.isMouseInApp()) {
        return
      }
      controls.mouse.prevent = true
      if (this.owner.isPlayed) {
        this.owner.unselectAll()
        this.select()
        menu.setBottombar(this)
        this.owner.selectedUnit = this
        this.owner.selectedUnits = [this]
      } else {
        if (player.selectedUnits.length) {
          drawInstanceBlinkingSelection(this)
          for (let i = 0; i < player.selectedUnits.length; i++) {
            const playerUnit = player.selectedUnits[i]
            if (playerUnit.type === 'Villager') {
              playerUnit.sendToAttack(this)
            } else {
              playerUnit.sendTo(this, 'attack')
            }
          }
        } else if (instanceIsInPlayerSight(unit, player) || map.revealEverything) {
          player.unselectAll()
          this.select()
          menu.setBottombar(this)
          player.selectedOther = this
        }
      }
    })
    changeSpriteColor(sprite, this.owner.color)

    this.interval = null
    sprite.updateAnchor = true
    this.addChild(sprite)

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
    }
  }

  setPath(path) {
    if (!path.length) {
      this.stop()
      return
    }
    this.startInterval()
    this.inactif = false
    this.setTextures('walkingSheet')
    this.path = path
  }

  handleChangeDest() {
    if (this.dest && this.dest.isUsedBy === this) {
      this.dest.isUsedBy = null
    }
  }

  sendTo(dest, action) {
    const {
      context: { map },
    } = this
    this.handleChangeDest()
    this.stop()
    let path = []
    // No instance we cancel the destination
    if (!dest) {
      return false
    }
    // Unit is already beside our target
    if (this.isUnitAtDest(action, dest)) {
      this.setDest(dest)
      this.action = action
      this.degree = getInstanceDegree(this, dest.x, dest.y)
      this.getAction(action)
      return true
    }
    // Set unit path
    if (map.grid[dest.i] && map.grid[dest.i][dest.j] && map.grid[dest.i][dest.j].solid) {
      path = getInstanceClosestFreeCellPath(this, dest, map)
      if (!path.length && this.work) {
        this.action = action
        this.affectNewDest()
        return
      }
    } else {
      path = getInstancePath(this, dest.i, dest.j, map)
    }
    // Unit found a path, set the action and play walking animation
    if (path.length) {
      this.setDest(dest)
      this.action = action
      this.setPath(path)
      return true
    }
    this.stop()
    return false
  }

  getActionCondition(target, action = this.action) {
    return getActionCondition(this, target, action)
  }

  getAction(name) {
    const {
      context: { menu, player, map },
    } = this
    const sprite = this.getChildByName('sprite')
    if (!sprite) {
      return
    }
    switch (name) {
      case 'delivery':
        if (!this.getActionCondition(this.dest)) {
          this.stop()
          return
        }
        this.owner[this.loadingType] += this.loading
        if (this.owner.isPlayed) {
          menu.updateTopbar()
        }
        this.loading = 0
        this.updateInterfaceLoading()
        if (this.assets[this.work]) {
          this.standingSheet = Assets.cache.get(this.assets[this.work].standingSheet)
          this.walkingSheet = Assets.cache.get(this.assets[this.work].walkingSheet)
        }
        if (this.previousDest) {
          if (this.previousDest.name === 'animal') {
            this.sendToTakeMeat(this.previousDest)
          } else {
            const sendToFunc = `sendTo${this.previousDest.type}`
            typeof this[sendToFunc] === 'function' ? this[sendToFunc](this.previousDest) : this.stop()
          }
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
        sprite.onLoop = () => {
          if (!this.getActionCondition(this.dest)) {
            this.affectNewDest()
            return
          }
          this.dest.isUsedBy = this
          // Villager is full we send him delivery first
          if (this.loading === this.loadingMax || !this.dest) {
            this.sendToDelivery()
            this.dest.isUsedBy = null
            return
          }
          // Villager farm the farm
          this.loading++
          this.loadingType = 'food'
          this.updateInterfaceLoading()

          this.dest.quantity--
          if (this.dest.selected && this.owner.isPlayed) {
            menu.updateInfo('quantity-text', element => (element.textContent = Math.max(this.dest.quantity, 0)))
          }
          // Destroy farm if it out of quantity
          if (this.dest.quantity <= 0) {
            this.dest.die()
            this.affectNewDest()
          }
          // Set the walking with berrybush animation
          if (this.loading > 0) {
            this.walkingSheet = Assets.cache.get('672')
            this.standingSheet = null
          }
        }
        this.setTextures('actionSheet')
        break
      case 'chopwood':
        if (!this.getActionCondition(this.dest)) {
          this.affectNewDest()
          return
        }
        sprite.onLoop = () => {
          if (!this.getActionCondition(this.dest)) {
            this.affectNewDest()
            return
          }
          // Villager is full we send him delivery first
          if (this.loading === this.loadingMax || !this.dest) {
            this.sendToDelivery()
            return
          }
          // Tree destination is still alive we cut him until it's dead
          if (this.dest.life > 0) {
            this.dest.life -= this.attack
            if (this.dest.selected && this.owner.isPlayed) {
              menu.updateInfo('life', element =>
                this.dest.life > 0
                  ? (element.textContent = Math.max(this.dest.life, 0) + '/' + this.dest.lifeMax)
                  : (element.textContent = '')
              )
            }
            if (this.dest.life <= 0) {
              // Set cutted tree texture
              this.dest.life = 0
              this.dest.setCuttedTreeTexture()
            }
            return
          }
          // Villager cut the stump
          this.loading++
          this.loadingType = 'wood'
          this.updateInterfaceLoading()

          this.dest.quantity--
          if (this.dest.selected && this.owner.isPlayed) {
            menu.updateInfo('quantity-text', element => (element.textContent = Math.max(this.dest.quantity, 0)))
          }
          // Destroy tree if stump out of quantity
          if (this.dest.quantity <= 0) {
            this.dest.die()
            this.affectNewDest()
          }
          // Set the walking with wood animation
          if (this.loading > 0) {
            this.walkingSheet = Assets.cache.get('273')
            this.standingSheet = null
          }
        }
        this.setTextures('actionSheet')
        break
      case 'forageberry':
        if (!this.getActionCondition(this.dest)) {
          this.affectNewDest()
          return
        }
        sprite.onLoop = () => {
          if (!this.getActionCondition(this.dest)) {
            this.affectNewDest()
            return
          }
          // Villager is full we send him delivery first
          if (this.loading === this.loadingMax || !this.dest) {
            this.sendToDelivery()
            return
          }
          // Villager forage the berrybush
          this.loading++
          this.loadingType = 'food'
          this.updateInterfaceLoading()

          this.dest.quantity--
          if (this.dest.selected && this.owner.isPlayed) {
            menu.updateInfo('quantity-text', element => (element.textContent = Math.max(this.dest.quantity, 0)))
          }
          // Destroy berrybush if it out of quantity
          if (this.dest.quantity <= 0) {
            this.dest.die()
            this.affectNewDest()
          }
          // Set the walking with berrybush animation
          if (this.loading > 0) {
            this.walkingSheet = Assets.cache.get('672')
            this.standingSheet = null
          }
        }
        this.setTextures('actionSheet')
        break
      case 'minestone':
        if (!this.getActionCondition(this.dest)) {
          this.affectNewDest()
          return
        }
        sprite.onLoop = () => {
          if (!this.getActionCondition(this.dest)) {
            this.affectNewDest()
            return
          }
          // Villager is full we send him delivery first
          if (this.loading === this.loadingMax || !this.dest) {
            this.sendToDelivery()
            return
          }
          // Villager mine the stone
          this.loading++
          this.loadingType = 'stone'
          this.updateInterfaceLoading()

          this.dest.quantity--
          if (this.dest.selected && this.owner.isPlayed) {
            menu.updateInfo('quantity-text', element => (element.textContent = Math.max(this.dest.quantity, 0)))
          }
          // Destroy stone if it out of quantity
          if (this.dest.quantity <= 0) {
            this.dest.die()
            this.affectNewDest()
          }
          // Set the walking with stone animation
          if (this.loading > 0) {
            this.walkingSheet = Assets.cache.get('274')
            this.standingSheet = null
          }
        }
        this.setTextures('actionSheet')
        break
      case 'minegold':
        if (!this.getActionCondition(this.dest)) {
          this.affectNewDest()
          return
        }
        sprite.onLoop = () => {
          if (!this.getActionCondition(this.dest)) {
            this.affectNewDest()
            return
          }
          // Villager is full we send him delivery first
          if (this.loading === this.loadingMax || !this.dest) {
            this.sendToDelivery()
            return
          }
          // Villager mine the gold
          this.loading++
          this.loadingType = 'gold'
          this.updateInterfaceLoading()

          this.dest.quantity--
          if (this.dest.selected && this.owner.isPlayed) {
            menu.updateInfo('quantity-text', element => (element.textContent = Math.max(this.dest.quantity, 0)))
          }
          // Destroy gold if it out of quantity
          if (this.dest.quantity <= 0) {
            this.dest.die()
            this.affectNewDest()
          }
          // Set the walking with gold animation
          if (this.loading > 0) {
            this.walkingSheet = Assets.cache.get('281')
            this.standingSheet = null
          }
        }
        this.setTextures('actionSheet')
        break
      case 'build':
        if (!this.getActionCondition(this.dest)) {
          this.affectNewDest()
          return
        }
        sprite.onLoop = () => {
          if (!this.getActionCondition(this.dest)) {
            if (this.dest.type === 'Farm' && !this.dest.isUsedBy) {
              this.sendToFarm(this.dest)
            }
            this.affectNewDest()
            return
          }
          if (this.dest.life < this.dest.lifeMax) {
            this.dest.life += this.attack
            if (this.dest.selected && this.owner.isPlayed) {
              menu.updateInfo(
                'life',
                element => (element.textContent = Math.min(this.dest.life, this.dest.lifeMax) + '/' + this.dest.lifeMax)
              )
            }
            this.dest.updateLife(this.action)
          } else {
            if (!this.dest.isBuilt) {
              this.dest.updateLife(this.action)
              this.dest.isBuilt = true
              if (this.dest.type === 'Farm' && !this.dest.isUsedBy) {
                this.sendToFarm(this.dest)
              }
            }
            this.affectNewDest()
          }
        }
        this.setTextures('actionSheet')
        break
      case 'attack':
        if (!this.getActionCondition(this.dest)) {
          this.affectNewDest()
          return
        }
        sprite.onLoop = () => {
          if (!this.getActionCondition(this.dest)) {
            this.affectNewDest()
            return
          }
          if (this.destHasMoved()) {
            this.realDest.i = this.dest.i
            this.realDest.j = this.dest.j
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
          if (this.dest.life > 0) {
            if (this.projectile) {
              const projectile = new projectiles[this.projectile](
                {
                  owner: this,
                  target: this.dest,
                },
                this.context
              )
              map.addChild(projectile)
            } else {
              this.dest.life -= this.attack
              if (
                this.dest.selected &&
                player &&
                (player.selectedUnit === this.dest || player.selectedBuilding === this.dest)
              ) {
                menu.updateInfo(
                  'life',
                  element => (element.textContent = Math.max(this.dest.life, 0) + '/' + this.dest.lifeMax)
                )
              }
              this.dest.isAttacked(this)
            }
          }
          if (this.dest.life <= 0) {
            this.dest.die()
            this.affectNewDest()
          }
        }
        this.setTextures('actionSheet')
        break
      case 'takemeat':
        if (!this.getActionCondition(this.dest)) {
          this.affectNewDest()
          return
        }
        sprite.onLoop = () => {
          if (!this.getActionCondition(this.dest)) {
            this.affectNewDest()
            return
          }
          // Villager is full we send him delivery first
          if (this.loading === this.loadingMax || !this.dest) {
            this.sendToDelivery()
            return
          }
          // Villager take meat
          this.loading++
          this.loadingType = 'food'
          this.updateInterfaceLoading()

          this.dest.quantity--
          if (this.dest.selected && this.owner.isPlayed) {
            menu.updateInfo('quantity-text', element => (element.textContent = Math.max(this.dest.quantity, 0)))
          }
          // Destroy corps if it out of quantity
          if (this.dest.quantity <= 0) {
            this.dest.clear()
            this.affectNewDest()
          }
          // Set the walking with meat animation
          if (this.loading > 0) {
            this.walkingSheet = Assets.cache.get('272')
            this.standingSheet = null
          }
        }
        this.setTextures('actionSheet')
        break
      case 'hunt':
        if (!this.getActionCondition(this.dest)) {
          this.affectNewDest()
          return
        }
        if (this.dest.isDead) {
          this.sendToTakeMeat(this.dest)
        }
        onSpriteLoopAtFrame(sprite, 6, () => {
          if (!this.getActionCondition(this.dest)) {
            this.affectNewDest()
            return
          }
          if (this.destHasMoved()) {
            this.realDest.i = this.dest.i
            this.realDest.j = this.dest.j
            const oldDeg = this.degree
            this.degree = getInstanceDegree(this, this.dest.x, this.dest.y)
            if (degreeToDirection(oldDeg) !== degreeToDirection(this.degree)) {
              this.setTextures('actionSheet')
            }
          }
          if (!this.isUnitAtDest(this.action, this.dest)) {
            this.sendToHunt(this.dest)
            return
          }
          if (this.dest.life > 0) {
            const projectile = new projectiles.Spear(
              {
                owner: this,
                target: this.dest,
              },
              this.context
            )
            map.addChild(projectile)
          }
          if (this.dest.life <= 0) {
            if (!this.dest.isDead) {
              this.dest.die()
            }
            this.sendToTakeMeat(this.dest)
          }
        })
        this.setTextures('actionSheet')
        break
      default:
        this.stop()
    }
  }

  handleAffectNewDestHunter() {
    const firstTargets = findInstancesInSight(this, instance => this.getActionCondition(instance, 'takemeat'))
    if (firstTargets.length) {
      const target = getClosestInstanceWithPath(this, firstTargets)
      if (target) {
        if (this.action !== 'takemeat') {
          this.action = 'takemeat'
          this.actionSheet = Assets.cache.get('626')
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
          this.actionSheet = Assets.cache.get('624')
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

  affectNewDest() {
    let handleSuccess = false
    if (this.type === 'Villager' && (this.action === 'takemeat' || this.action === 'hunt')) {
      handleSuccess = this.handleAffectNewDestHunter()
    } else {
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
      const notDeliveryWork = ['builder', 'attacker']
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
    if ((action === 'hunt' || action === 'attack') && this.range && instancesDistance(this, dest) <= this.range) {
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
    const sprite = this.getChildByName('sprite')
    if (!sprite) {
      return
    }
    if (!this.dest || this.dest.isDestroyed) {
      this.affectNewDest()
      return
    }
    // Collision with another walking unit, we block the mouvement
    if (
      nextCell.has &&
      (nextCell.has.name === 'unit' || nextCell.has.name === 'animal') &&
      nextCell.has !== this &&
      nextCell.has.hasPath() &&
      instancesDistance(this, nextCell.has) <= 1 &&
      nextCell.has.getChildByName('sprite').playing
    ) {
      sprite.stop()
      return
    }
    if (nextCell.solid && this.dest) {
      this.sendTo(this.dest, this.action)
      return
    }

    if (!sprite.playing) {
      sprite.play()
    }

    this.zIndex = getInstanceZIndex(this)
    if (instancesDistance(this, nextCell, false) < 10) {
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
      moveTowardPoint(this, nextCell.x, nextCell.y, speed)
      menu.updatePlayerMiniMap(this.owner)
      if (degreeToDirection(oldDeg) !== degreeToDirection(this.degree)) {
        // Change animation according to degree
        this.setTextures('walkingSheet')
      }
    }
  }

  isAttacked(instance) {
    if (!instance || this.dest === instance || (this.dest && this.dest.name === 'unit' && this.action === 'attack')) {
      return
    }
    if (this.type === 'Villager') {
      if (instance.name === 'animal') {
        this.sendToHunt(instance)
      } else {
        this.sendToAttack(instance)
      }
    } else {
      this.sendTo(instance, 'attack')
    }
  }

  stop() {
    if (this.currentCell.has !== this && this.currentCell.solid) {
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

  startInterval() {
    if (!this.interval) {
      this.interval = setInterval(() => this.step(), stepTime)
    }
  }

  stopInterval() {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  step() {
    if (this.life <= 0) {
      this.die()
    }
    if (this.hasPath()) {
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

  runaway() {
    const {
      context: { map },
    } = this
    let dest
    for (let i = 5; i < 50; i++) {
      getCellsAroundPoint(this.i, this.j, map.grid, i, cell => {
        if (!cell.solid) {
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

  die() {
    const {
      context: { player, map },
    } = this
    if (this.currentSheet === 'dyingSheet') {
      return
    }
    this.stopInterval()
    if (this.selected && player) {
      player.unselectUnit(this)
    }
    if (this.dest && this.dest.isUsedBy === this) {
      this.dest.isUsedBy = null
    }
    this.path = []
    this.action = null
    this.setTextures('dyingSheet')
    const sprite = this.getChildByName('sprite')
    if (!sprite) {
      return
    }
    sprite.onLoop = () => {
      this.unselect()

      if (this.owner) {
        this.owner.population--
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

      map.grid[this.i][this.j].has = null
      map.grid[this.i][this.j].solid = false

      this.interactive = false
      this.isDead = true
      clearCellOnInstanceSight(this)
      clearInterval(this.interval)

      this.setTextures('corpseSheet')
      sprite.animationSpeed = corpseTime * accelerator
      sprite.onLoop = () => {
        this.clear()
      }
    }
  }

  clear() {
    const {
      context: { map },
    } = this
    map.removeChild(this)
    this.destroy({ child: true, texture: true })
  }

  setTextures(sheet) {
    const sprite = this.getChildByName('sprite')
    if (!sprite) {
      return
    }
    // Sheet don't exist we just block the current sheet
    if (!this[sheet]) {
      if (this.currentSheet !== 'walkingSheet' && this.walkingSheet) {
        sprite.textures = [this.walkingSheet.textures[Object.keys(this.walkingSheet.textures)[0]]]
      } else {
        sprite.textures = [sprite.textures[sprite.currentFrame]]
      }
      this.currentSheet = 'walkingSheet'
      sprite.stop()
      sprite.anchor.set(
        sprite.textures[sprite.currentFrame].defaultAnchor.x,
        sprite.textures[sprite.currentFrame].defaultAnchor.y
      )
      return
    }
    // Reset action loop
    if (sheet !== 'actionSheet') {
      sprite.onLoop = null
      sprite.onFrameChange = null
    }
    this.currentSheet = sheet
    sprite.animationSpeed = (this[sheet].data.animationSpeed || (sheet === 'standingSheet' ? 0.1 : 0.3)) * accelerator
    const direction = degreeToDirection(this.degree)
    switch (direction) {
      case 'southest':
        sprite.scale.x = -1
        sprite.textures = this[sheet].animations['southwest']
        break
      case 'northest':
        sprite.scale.x = -1
        sprite.textures = this[sheet].animations['northwest']
        break
      case 'est':
        sprite.scale.x = -1
        sprite.textures = this[sheet].animations['west']
        break
      default:
        sprite.scale.x = 1
        sprite.textures = this[sheet].animations[direction]
    }
    sprite.play()
  }

  setDefaultInterface(element, data) {
    const civDiv = document.createElement('div')
    civDiv.id = 'civ'
    civDiv.textContent = this.owner.civ
    element.appendChild(civDiv)

    const typeDiv = document.createElement('div')
    typeDiv.id = 'type'
    typeDiv.textContent = this.type
    element.appendChild(typeDiv)

    const iconImg = document.createElement('img')
    iconImg.id = 'icon'
    iconImg.src = getIconPath(data.icon)
    element.appendChild(iconImg)

    const lifeDiv = document.createElement('div')
    lifeDiv.id = 'life'
    lifeDiv.textContent = Math.max(this.life, 0) + '/' + this.lifeMax
    element.appendChild(lifeDiv)
  }
}
