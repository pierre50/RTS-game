import { Container, Assets, AnimatedSprite, Graphics } from 'pixi.js'
import { accelerator, stepTime, corpseTime } from '../constants'
import * as projectiles from './projectile'
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
  getClosestInstance,
  changeSpriteColor,
  findInstancesInSight,
  getClosestInstanceWithPath,
  getCellsAroundPoint,
  drawInstanceBlinkingSelection,
  instanceIsInPlayerSight,
  degreeToDirection,
  onSpriteLoopAtFrame,
} from '../lib'

class Unit extends Container {
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
    const { owner } = this
    if (!action) {
      return
    }
    const conditions = {
      takemeat: instance =>
        instance && instance.name === 'animal' && instance.quantity > 0 && instance.isDead && !instance.isDestroyed,
      hunt: instance => instance && instance.name === 'animal' && instance.quantity > 0 && !instance.isDead,
      chopwood: instance => instance && instance.type === 'Tree' && instance.quantity > 0 && !instance.isDestroyed,
      farm: instance =>
        instance &&
        instance.type === 'Farm' &&
        instance.life > 0 &&
        instance.quantity > 0 &&
        (!instance.isUsedBy || instance.isUsedBy === this) &&
        !instance.isDead,
      forageberry: instance =>
        instance && instance.type === 'Berrybush' && instance.quantity > 0 && !instance.isDestroyed,
      minestone: instance => instance && instance.type === 'Stone' && instance.quantity > 0 && !instance.isDestroyed,
      minegold: instance => instance && instance.type === 'Gold' && instance.quantity > 0 && !instance.isDestroyed,
      build: instance =>
        instance &&
        instance.owner === owner &&
        instance.name === 'building' &&
        instance.life > 0 &&
        (!instance.isBuilt || instance.life < instance.lifeMax) &&
        !instance.isDead,
      attack: instance =>
        instance &&
        instance.owner !== owner &&
        (instance.name === 'building' || instance.name === 'unit' || instance.name === 'animal') &&
        instance.life > 0 &&
        !instance.isDead,
    }
    return conditions[action] ? conditions[action](target) : this.stop()
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
            this.sendToDelivery('Granary', 'deliveryfood')
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
      case 'deliveryfood':
        this.owner.food += this.loading
        if (this.owner.isPlayed) {
          menu.updateTopbar()
        }
        this.loading = 0
        this.updateInterfaceLoading()
        this.standingSheet = Assets.cache.get('430')
        this.walkingSheet = Assets.cache.get('670')

        if (this.previousDest) {
          this.sendToFarm(this.previousDest)
        } else {
          this.stop()
        }
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
            this.sendToDelivery('StoragePit', 'deliverywood')
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
      case 'deliverywood':
        this.owner.wood += this.loading
        if (this.owner.isPlayed) {
          menu.updateTopbar()
        }
        this.loading = 0
        this.updateInterfaceLoading()
        this.walkingSheet = Assets.cache.get('682')
        this.standingSheet = Assets.cache.get('440')

        if (this.previousDest) {
          this.sendToTree(this.previousDest)
        } else {
          this.stop()
        }
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
            this.sendToDelivery('Granary', 'deliveryberry')
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
      case 'deliveryberry':
        this.owner.food += this.loading
        if (this.owner.isPlayed) {
          menu.updateTopbar()
        }
        this.loading = 0
        this.updateInterfaceLoading()
        this.standingSheet = Assets.cache.get('432')
        this.walkingSheet = Assets.cache.get('672')

        if (this.previousDest) {
          this.sendToBerrybush(this.previousDest)
        } else {
          this.stop()
        }
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
            this.sendToDelivery('StoragePit', 'deliverystone')
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
      case 'deliverystone':
        this.owner.stone += this.loading
        if (this.owner.isPlayed) {
          menu.updateTopbar()
        }
        this.loading = 0
        this.updateInterfaceLoading()
        this.walkingSheet = Assets.cache.get('683')
        this.standingSheet = Assets.cache.get('441')

        if (this.previousDest) {
          this.sendToStone(this.previousDest)
        } else {
          this.stop()
        }
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
            this.sendToDelivery('StoragePit', 'deliverygold')
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
      case 'deliverygold':
        this.owner.gold += this.loading
        if (this.owner.isPlayed) {
          menu.updateTopbar()
        }
        this.loading = 0
        this.updateInterfaceLoading()
        this.walkingSheet = Assets.cache.get('683')
        this.standingSheet = Assets.cache.get('441')

        if (this.previousDest) {
          this.sendToGold(this.previousDest)
        } else {
          this.stop()
        }
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
      case 'deliverymeat':
        this.owner.food += this.loading
        if (this.owner.isPlayed) {
          menu.updateTopbar()
        }
        this.loading = 0
        this.updateInterfaceLoading()
        this.standingSheet = Assets.cache.get('435')
        this.walkingSheet = Assets.cache.get('676')

        if (this.previousDest) {
          this.sendToTakeMeat(this.previousDest)
        } else {
          this.stop()
        }
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
            this.sendToDelivery('StoragePit', 'deliverymeat')
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
            const projectile = new projectiles.Arrow(
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
      if (this.loading) {
        switch (this.work) {
          case 'farm':
            this.sendToDelivery('Granary', 'deliveryfood')
            return
          case 'woodcutter':
            this.sendToDelivery('StoragePit', 'deliverywood')
            return
          case 'gatherer':
            this.sendToDelivery('Granary', 'deliveryberry')
            return
          case 'hunter':
          case 'takemeat':
            this.sendToDelivery('StoragePit', 'deliverymeat')
            return
          case 'stoneminer':
            this.sendToDelivery('StoragePit', 'deliverystone')
            return
          case 'goldminer':
            this.sendToDelivery('StoragePit', 'deliverygold')
            return
        }
      }
      this.stop()
      return
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
    if ((action === 'hunt' || action === 'attack') && this.range && instancesDistance(this, dest) < this.range) {
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
    if (this.work === 'attacker' && this.inactif) {
      this.action = 'attack'
      this.affectNewDest()
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
    sprite.animationSpeed = (this[sheet].data.animationSpeed || (sheet === 'standingSheet' ? 0.1 : 0.2)) * accelerator
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

export class Villager extends Unit {
  constructor({ i, j, owner }, context) {
    const type = 'Villager'
    const data = Assets.cache.get('config').units[type]
    const { menu } = context
    super(
      {
        i,
        j,
        owner,
        type,
        lifeMax: data.lifeMax,
        sight: data.sight,
        speed: data.speed * accelerator,
        attack: data.attack,
        range: data.range,
        standingSheet: Assets.cache.get('418'),
        walkingSheet: Assets.cache.get('657'),
        dyingSheet: Assets.cache.get('314'),
        corpseSheet: Assets.cache.get('373'),
        interface: {
          info: element => {
            const { owner } = this
            this.setDefaultInterface(element, data)
            if (owner.isPlayed) {
              element.appendChild(this.getLoadingElement())
            }
          },
          menu: owner.isPlayed
            ? [
                {
                  icon: 'interface/50721/002_50721.png',
                  children: [
                    menu.getBuildingButton('House'),
                    menu.getBuildingButton('Barracks'),
                    menu.getBuildingButton('Granary'),
                    menu.getBuildingButton('StoragePit'),
                    menu.getBuildingButton('Farm'),
                    menu.getBuildingButton('Stable'),
                    menu.getBuildingButton('ArcheryRange'),
                  ],
                },
              ]
            : [],
        },
      },
      context
    )
  }

  updateInterfaceLoading() {
    const {
      context: { menu },
    } = this
    if (this.selected && this.owner.isPlayed && this.owner.selectedUnit === this) {
      if (this.loading === 1) {
        menu.updateInfo('loading', element => (element.innerHTML = this.getLoadingElement().outerHTML))
      } else if (this.loading > 1) {
        menu.updateInfo('loading-text', element => (element.textContent = this.loading))
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
      iconImg.src = menu.icons[this.loadingType]
      const textDiv = document.createElement('div')
      textDiv.id = 'loading-text'
      textDiv.textContent = this.loading
      loadingDiv.appendChild(iconImg)
      loadingDiv.appendChild(textDiv)
    }
    return loadingDiv
  }

  sendToAttack(target) {
    this.updateInterfaceLoading()
    this.work = null
    this.actionSheet = Assets.cache.get('224')
    this.standingSheet = Assets.cache.get('418')
    if (!this.loading) {
      this.walkingSheet = Assets.cache.get('657')
    }
    this.previousDest = null
    return this.sendTo(target, 'attack')
  }

  sendToTakeMeat(target) {
    if (this.loadingType !== 'food') {
      this.loading = 0
      this.updateInterfaceLoading()
    }
    if (this.work !== 'hunter' || this.action !== 'takemeat') {
      this.work = 'hunter'
      this.actionSheet = Assets.cache.get('626')
      this.standingSheet = Assets.cache.get('435')
      if (!this.loading) {
        this.walkingSheet = Assets.cache.get('676')
        this.dyingSheet = Assets.cache.get('332')
        this.corpseSheet = Assets.cache.get('389')
      }
    }
    this.previousDest = null
    return this.sendTo(target, 'takemeat')
  }

  sendToHunt(target) {
    if (this.loadingType !== 'food') {
      this.loading = 0
      this.updateInterfaceLoading()
    }
    if (this.work !== 'hunter' || this.action !== 'hunt') {
      this.work = 'hunter'
      this.actionSheet = Assets.cache.get('624')
      this.standingSheet = Assets.cache.get('435')
      if (!this.loading) {
        this.walkingSheet = Assets.cache.get('676')
        this.dyingSheet = Assets.cache.get('332')
        this.corpseSheet = Assets.cache.get('389')
      }
    }
    this.previousDest = null
    return this.sendTo(target, 'hunt')
  }

  sendToDelivery(type, action) {
    const {
      context: { map },
    } = this
    const targets = this.owner.buildings.filter(building => {
      return building.life > 0 && building.isBuilt && (building.type === 'TownCenter' || building.type === type)
    })
    const target = getClosestInstance(this, targets)
    if (this.dest) {
      this.previousDest = this.dest
    } else {
      this.previousDest = map.grid[this.i][this.j]
    }
    this.sendTo(target, action)
  }

  sendToBuilding(building) {
    if (this.work !== 'builder') {
      this.updateInterfaceLoading()
      this.work = 'builder'
      this.actionSheet = Assets.cache.get('628')
      this.standingSheet = Assets.cache.get('419')
      if (!this.loading) {
        this.walkingSheet = Assets.cache.get('658')
        this.dyingSheet = Assets.cache.get('315')
        this.corpseSheet = Assets.cache.get('374')
      }
    }
    this.previousDest = null
    return this.sendTo(building, 'build')
  }

  sendToFarm(farm) {
    if (this.loadingType !== 'food') {
      this.loading = 0
      this.updateInterfaceLoading()
    }
    if (this.work !== 'farmer') {
      this.work = 'farmer'
      this.actionSheet = Assets.cache.get('630')
      this.standingSheet = Assets.cache.get('430')
      if (!this.loading) {
        this.walkingSheet = Assets.cache.get('670')
        this.dyingSheet = Assets.cache.get('326')
        this.corpseSheet = Assets.cache.get('388')
      }
    }
    this.previousDest = null
    return this.sendTo(farm, 'farm')
  }

  sendToTree(tree) {
    if (this.work !== 'woodcutter') {
      this.loading = 0
      this.updateInterfaceLoading()
      this.work = 'woodcutter'
      this.actionSheet = Assets.cache.get('625')
      this.standingSheet = Assets.cache.get('440')
      this.walkingSheet = Assets.cache.get('682')
      this.corpseSheet = Assets.cache.get('399')
    }
    this.previousDest = null
    return this.sendTo(tree, 'chopwood')
  }

  sendToBerrybush(berrybush) {
    if (this.loadingType !== 'food') {
      this.loading = 0
      this.updateInterfaceLoading()
    }
    if (this.work !== 'gatherer') {
      this.work = 'gatherer'
      this.actionSheet = Assets.cache.get('632')
      this.standingSheet = Assets.cache.get('432')
      if (!this.loading) {
        this.walkingSheet = Assets.cache.get('672')
        this.dyingSheet = Assets.cache.get('328')
        this.corpseSheet = Assets.cache.get('390')
      }
    }
    this.previousDest = null
    return this.sendTo(berrybush, 'forageberry')
  }

  sendToStone(stone) {
    if (this.work !== 'stoneminer') {
      this.loading = 0
      this.updateInterfaceLoading()
      this.work = 'stoneminer'
      this.actionSheet = Assets.cache.get('633')
      this.standingSheet = Assets.cache.get('441')
      this.walkingSheet = Assets.cache.get('683')
      this.corpseSheet = Assets.cache.get('400')
    }
    this.previousDest = null
    return this.sendTo(stone, 'minestone')
  }

  sendToGold(gold) {
    if (this.work !== 'goldminer') {
      this.loading = 0
      this.updateInterfaceLoading()
      this.work = 'goldminer'
      this.actionSheet = Assets.cache.get('633')
      this.standingSheet = Assets.cache.get('441')
      this.walkingSheet = Assets.cache.get('683')
      this.corpseSheet = Assets.cache.get('400')
    }
    this.previousDest = null
    return this.sendTo(gold, 'minegold')
  }
}

export class Clubman extends Unit {
  constructor({ i, j, owner }, context) {
    const type = 'Clubman'
    const data = Assets.cache.get('config').units[type]
    super(
      {
        i,
        j,
        owner,
        type,
        lifeMax: data.lifeMax,
        sight: data.sight,
        speed: data.speed * accelerator,
        attack: data.attack,
        work: 'attacker',
        standingSheet: Assets.cache.get('425'),
        walkingSheet: Assets.cache.get('664'),
        actionSheet: Assets.cache.get('212'),
        dyingSheet: Assets.cache.get('321'),
        corpseSheet: Assets.cache.get('380'),
        interface: {
          info: element => {
            this.setDefaultInterface(element, data)
          },
        },
      },
      context
    )
  }
}

export class Scout extends Unit {
  constructor({ i, j, owner }, context) {
    const type = 'Scout'
    const data = Assets.cache.get('config').units[type]
    super(
      {
        i,
        j,
        owner,
        type,
        lifeMax: data.lifeMax,
        sight: data.sight,
        speed: data.speed * accelerator,
        attack: data.attack,
        work: 'attacker',
        standingSheet: Assets.cache.get('445'),
        walkingSheet: Assets.cache.get('651'),
        actionSheet: Assets.cache.get('227'),
        dyingSheet: Assets.cache.get('343'),
        corpseSheet: Assets.cache.get('403'),
        interface: {
          info: element => {
            this.setDefaultInterface(element, data)
          },
        },
      },
      context
    )
  }
}

export class Bowman extends Unit {
  constructor({ i, j, owner }, context) {
    const type = 'Bowman'
    const data = Assets.cache.get('config').units[type]
    super(
      {
        i,
        j,
        owner,
        type,
        lifeMax: data.lifeMax,
        sight: data.sight,
        speed: data.speed * accelerator,
        attack: data.attack,
        range: data.range,
        work: 'attacker',
        projectile: 'Arrow',
        standingSheet: Assets.cache.get('413'),
        walkingSheet: Assets.cache.get('652'),
        actionSheet: Assets.cache.get('203'),
        dyingSheet: Assets.cache.get('308'),
        corpseSheet: Assets.cache.get('367'),
        interface: {
          info: element => {
            this.setDefaultInterface(element, data)
          },
        },
      },
      context
    )
  }
}

export default {
  Villager,
  Clubman,
  Bowman,
  Scout,
}
