import { Container, Assets, AnimatedSprite, Graphics } from 'pixi.js'
import { accelerator } from '../constants'
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
  instanceIsInPlayerSight,
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
    this.loadingMax = 10
    this.currentSheet = null
    this.size = 1
    this.visible = false
    this.currentCell = map.grid[this.i][this.j]
    this.currentCell.has = this
    this.currentCell.solid = true

    this.life = this.lifeMax
    this.originalSpeed = this.peed
    this.inactif = true

    this.allowMove = false
    this.interactive = true
    const sprite = new AnimatedSprite(this.standingSheet.animations['south'])
    sprite.name = 'sprite'
    sprite.allowMove = false
    sprite.interactive = false
    sprite.allowClick = false
    sprite.roundPixels = true

    this.on('pointertap', () => {
      const {
        context: { controls, player, menu },
      } = this
      if (controls.mouseBuilding || controls.mouseRectangle || !controls.isMouseInApp()) {
        return
      }
      if (this.owner.isPlayed) {
        this.owner.unselectAll()
        this.select()
        menu.setBottombar(this)
        this.owner.selectedUnit = this
        this.owner.selectedUnits = [this]
      } else {
        if (player.selectedUnits.length) {
          drawInstanceBlinkingSelection(unit)
          for (let i = 0; i < player.selectedUnits.length; i++) {
            const playerUnit = player.selectedUnits[i]
            if (playerUnit.type === 'Villager') {
              playerUnit.sendToAttack(unit)
            } else {
              playerUnit.sendTo(unit, 'attack')
            }
          }
          return
        }
        if (instanceIsInPlayerSight(unit, player) || map.revealEverything) {
          player.unselectAll()
          unit.select()
          menu.setBottombar(unit)
          player.selectedOther = unit
        }
      }
    })
    changeSpriteColor(sprite, this.owner.color)

    this.interval = setInterval(() => this.step(), 40)
    sprite.updateAnchor = true
    this.addChild(sprite)

    this.stop()

    renderCellOnInstanceSight(this)
  }
  select() {
    if (this.selected) {
      return
    }
    this.selected = true
    const selection = new Graphics()
    selection.name = 'selection'
    selection.zIndex = 3
    selection.lineStyle(1, 0xffffff)
    const path = [-32 * 0.5, 0, 0, -16 * 0.5, 32 * 0.5, 0, 0, 16 * 0.5]
    selection.drawPolygon(path)
    this.addChildAt(selection, 0)
  }
  unselect() {
    this.selected = false
    const selection = this.getChildByName('selection')
    if (selection) {
      this.removeChild(selection)
    }
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
    //No instance we cancel the destination
    if (!dest) {
      return false
    }
    //Unit is already beside our target
    if (action && instanceContactInstance(this, dest)) {
      this.setDest(dest)
      this.action = action
      this.degree = getInstanceDegree(this, dest.x, dest.y)
      this.getAction(action)
      return true
    }
    //Set unit path
    if (this.parent.grid[dest.i][dest.j].solid) {
      path = getInstanceClosestFreeCellPath(this, dest, map)
      if (!path.length && this.work) {
        this.action = action
        this.affectNewDest()
        return
      }
    } else {
      path = getInstancePath(this, dest.i, dest.j, map)
    }
    //Unit found a path, set the action and play walking animation
    if (path.length) {
      this.setDest(dest)
      this.action = action
      this.setPath(path)
      return true
    }
    this.stop()
    return false
  }

  getActionCondition(target) {
    const { action, owner } = this
    if (!action) {
      return
    }
    const conditions = {
      chopwood: instance => instance && instance.type === 'Tree' && instance.quantity > 0 && !instance.isDestroyed,
      farm: instance =>
        instance &&
        instance.type === 'Farm' &&
        instance.life > 0 &&
        instance.quantity > 0 &&
        (!instance.isUsedBy || instance.isUsedBy === this) &&
        !instance.isDestroyed,
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
        !instance.isDestroyed,
      attack: instance =>
        instance &&
        instance.owner !== owner &&
        (instance.name === 'building' || instance.name === 'unit') &&
        instance.life > 0 &&
        !instance.isDestroyed,
    }
    return conditions[action] ? conditions[action](target) : this.stop()
  }

  getAction(name) {
    const {
      context: { menu, player },
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
          //Villager is full we send him delivery first
          if (this.loading === this.loadingMax || !this.dest) {
            this.sendToDelivery('Granary', 'deliveryfood')
            this.dest.isUsedBy = null
            return
          }
          //Villager farm the farm
          this.loading++
          this.updateInterfaceLoading()

          this.dest.quantity--
          if (this.dest.selected && this.owner.isPlayed) {
            menu.updateInfo('quantity-text', element => (element.textContent = this.dest.quantity))
          }
          //Destroy farm if it out of quantity
          if (this.dest.quantity <= 0) {
            this.dest.die()
            this.affectNewDest()
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
          //Villager is full we send him delivery first
          if (this.loading === this.loadingMax || !this.dest) {
            this.sendToDelivery('StoragePit', 'deliverywood')
            return
          }
          //Tree destination is still alive we cut him until it's dead
          if (this.dest.life > 0) {
            this.dest.life -= this.attack
            if (this.dest.selected && this.owner.isPlayed) {
              menu.updateInfo('life', element =>
                this.dest.life > 0
                  ? (element.textContent = this.dest.life + '/' + this.dest.lifeMax)
                  : (element.textContent = '')
              )
            }
            if (this.dest.life <= 0) {
              //Set cutted tree texture
              this.dest.life = 0
              this.dest.setCuttedTreeTexture()
            }
            return
          }
          //Villager cut the stump
          this.loading++
          this.updateInterfaceLoading()

          this.dest.quantity--
          if (this.dest.selected && this.owner.isPlayed) {
            menu.updateInfo('quantity-text', element => (element.textContent = this.dest.quantity))
          }
          //Destroy tree if stump out of quantity
          if (this.dest.quantity <= 0) {
            this.dest.die()
            this.affectNewDest()
          }
          //Set the walking with wood animation
          if (this.loading > 1) {
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
          //Villager is full we send him delivery first
          if (this.loading === this.loadingMax || !this.dest) {
            this.sendToDelivery('Granary', 'deliveryberry')
            return
          }
          //Villager forage the berrybush
          this.loading++
          this.updateInterfaceLoading()

          this.dest.quantity--
          if (this.dest.selected && this.owner.isPlayed) {
            menu.updateInfo('quantity-text', element => (element.textContent = this.dest.quantity))
          }
          //Destroy berrybush if it out of quantity
          if (this.dest.quantity <= 0) {
            this.dest.die()
            this.affectNewDest()
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
          //Villager is full we send him delivery first
          if (this.loading === this.loadingMax || !this.dest) {
            this.sendToDelivery('StoragePit', 'deliverystone')
            return
          }
          //Villager mine the stone
          this.loading++
          this.updateInterfaceLoading()

          this.dest.quantity--
          if (this.dest.selected && this.owner.isPlayed) {
            menu.updateInfo('quantity-text', element => (element.textContent = this.dest.quantity))
          }
          //Destroy stone if it out of quantity
          if (this.dest.quantity <= 0) {
            this.dest.die()
            this.affectNewDest()
          }
          //Set the walking with stone animation
          if (this.loading > 1) {
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
          //Villager is full we send him delivery first
          if (this.loading === this.loadingMax || !this.dest) {
            this.sendToDelivery('StoragePit', 'deliverygold')
            return
          }
          //Villager mine the gold
          this.loading++
          this.updateInterfaceLoading()

          this.dest.quantity--
          if (this.dest.selected && this.owner.isPlayed) {
            menu.updateInfo('quantity-text', element => (element.textContent = this.dest.quantity))
          }
          //Destroy gold if it out of quantity
          if (this.dest.quantity <= 0) {
            this.dest.die()
            this.affectNewDest()
          }
          //Set the walking with gold animation
          if (this.loading > 1) {
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
          if (!instanceContactInstance(this, this.dest)) {
            this.sendTo(this.dest, 'attack')
            return
          }
          if (this.dest.life > 0) {
            this.dest.life -= this.attack
            if (this.dest.selected && player && player.selectedUnit === this.dest) {
              menu.updateInfo('life', element => (element.textContent = this.dest.life + '/' + this.dest.lifeMax))
            }
            if (this.dest.name === 'building') {
              this.dest.updateLife(this.action)
            } else {
              this.dest.isAttacked(this)
            }
          } else {
            this.dest.die()
            this.affectNewDest()
          }
        }
        this.setTextures('actionSheet')
        break
      default:
        this.stop()
    }
  }

  affectNewDest() {
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

  moveToPath() {
    const next = this.path[this.path.length - 1]
    const nextCell = this.parent.grid[next.i][next.j]
    const sprite = this.getChildByName('sprite')
    if (!sprite) {
      return
    }
    if (!this.dest || this.dest.isDestroyed) {
      this.affectNewDest()
      return
    }
    //Collision with another walking unit, we block the mouvement
    if (
      nextCell.has &&
      nextCell.has.name === 'unit' &&
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
      this.currentCell = this.parent.grid[this.i][this.j]
      if (this.currentCell.has === null) {
        this.currentCell.has = this
        this.currentCell.solid = true
      }

      renderCellOnInstanceSight(this)
      this.path.pop()

      //Destination moved
      if (this.dest.i !== this.realDest.i || this.dest.j !== this.realDest.j) {
        if (this.owner.views[this.dest.i][this.dest.j].viewBy.length > 1) {
          this.sendTo(this.dest, this.action)
          return
        }
      }
      if (this.action && instanceContactInstance(this, this.dest)) {
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
      //Move to next
      const oldDeg = this.degree
      let speed = this.speed
      if (this.loading > 1) {
        speed *= 0.8
      }
      moveTowardPoint(this, nextCell.x, nextCell.y, speed)
      menu.updatePlayerMiniMap(this.owner)
      if (oldDeg !== this.degree) {
        //Change animation according to degree
        this.setTextures('walkingSheet')
      }
    }
  }

  isAttacked(instance) {
    if (!instance || (this.dest && this.dest.name === 'unit' && this.action === 'attack')) {
      return
    }
    if (this.type === 'Villager') {
      this.sendToAttack(instance, 'attack')
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
    this.setTextures('standingSheet')
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
    let dest
    for (let i = 3; i < 50; i++) {
      getCellsAroundPoint(this.i, this.j, this.parent.grid, i, cell => {
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
    let dest
    for (let i = 5; i < 50; i++) {
      getCellsAroundPoint(this.i, this.j, this.parent.grid, i, cell => {
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
      context: { player },
    } = this
    if (this.currentSheet === 'dyingSheet') {
      return
    }
    if (this.selected && player) {
      player.unselectAll()
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
      if (this.parent) {
        this.owner.population--

        this.parent.grid[this.i][this.j].has = null
        this.parent.grid[this.i][this.j].solid = false

        //Remove from player units
        let index = this.owner.units.indexOf(this)
        if (index >= 0) {
          this.owner.units.splice(index, 1)
        }
        //Remove from player selected units
        if (this.owner.selectedUnits) {
          index = this.owner.selectedUnits.indexOf(this)
          if (index >= 0) {
            this.owner.selectedUnits.splice(index, 1)
          }
        }
        this.parent.removeChild(this)
      }
      clearCellOnInstanceSight(this)
      this.isDestroyed = true
      this.destroy({ child: true, texture: true })
      clearInterval(this.interval)
    }
  }

  setTextures(sheet) {
    const sprite = this.getChildByName('sprite')
    if (!sprite) {
      return
    }
    //Sheet don't exist we just block the current sheet
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
        sprite.textures[[sprite.currentFrame]].defaultAnchor.y
      )
      return
    }
    //Reset action loop
    if (sheet !== 'actionSheet') {
      sprite.onLoop = () => {}
    }
    this.currentSheet = sheet
    sprite.animationSpeed = this[sheet].data.animationSpeed || (sheet === 'standingSheet' ? 0.1 : 0.2)
    if (this.degree > 67.5 && this.degree < 112.5) {
      sprite.scale.x = 1
      sprite.textures = this[sheet].animations['north']
    } else if (this.degree > 247.5 && this.degree < 292.5) {
      sprite.scale.x = 1
      sprite.textures = this[sheet].animations['south']
    } else if (this.degree > 337.5 || this.degree < 22.5) {
      sprite.scale.x = 1
      sprite.textures = this[sheet].animations['west']
    } else if (this.degree >= 22.5 && this.degree <= 67.5) {
      sprite.scale.x = 1
      sprite.textures = this[sheet].animations['northwest']
    } else if (this.degree >= 292.5 && this.degree <= 337.5) {
      sprite.scale.x = 1
      sprite.textures = this[sheet].animations['southwest']
    } else if (this.degree > 157.5 && this.degree < 202.5) {
      sprite.scale.x = -1
      sprite.textures = this[sheet].animations['west']
    } else if (this.degree > 112.5 && this.degree < 157.5) {
      sprite.scale.x = -1
      sprite.textures = this[sheet].animations['northwest']
    } else if (this.degree > 202.5 && this.degree < 247.5) {
      sprite.scale.x = -1
      sprite.textures = this[sheet].animations['southwest']
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
    lifeDiv.textContent = this.life + '/' + this.lifeMax
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
        attack: data.attack * accelerator,
        standingSheet: Assets.cache.get('418'),
        walkingSheet: Assets.cache.get('657'),
        dyingSheet: Assets.cache.get('314'),
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
      context: { player, menu },
    } = this
    if (this.selected && this.owner === player) {
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
      let iconToUse
      switch (this.work) {
        case 'woodcutter':
          iconToUse = menu.icons['wood']
          break
        case 'farmer':
        case 'gatherer':
          iconToUse = menu.icons['food']
          break
        case 'stoneminer':
          iconToUse = menu.icons['stone']
          break
        case 'goldminer':
          iconToUse = menu.icons['gold']
          break
      }
      const iconImg = document.createElement('img')
      iconImg.className = 'unit-loading-icon'
      iconImg.src = iconToUse
      const textDiv = document.createElement('div')
      textDiv.id = 'loading-text'
      textDiv.textContent = this.loading
      loadingDiv.appendChild(iconImg)
      loadingDiv.appendChild(textDiv)
    }
    return loadingDiv
  }
  sendToAttack(target) {
    const {
      context: { menu },
    } = this
    this.loading = 0
    if (this.selected && this.owner.isPlayed) {
      menu.updateInfo('loading', element => (element.innerHTML = ''))
    }
    this.work = null
    this.actionSheet = Assets.cache.get('224')
    this.standingSheet = Assets.cache.get('418')
    this.walkingSheet = Assets.cache.get('657')
    this.previousDest = null
    return this.sendTo(target, 'attack')
  }
  sendToDelivery(type, action) {
    const targets = this.owner.buildings.filter(building => {
      return building.life > 0 && building.isBuilt && (building.type === 'TownCenter' || building.type === type)
    })
    const target = getClosestInstance(this, targets)
    if (this.dest) {
      this.previousDest = this.dest
    } else {
      this.previousDest = this.parent.grid[this.i][this.j]
    }
    this.sendTo(target, action)
  }
  sendToBuilding(building) {
    if (this.work !== 'builder') {
      this.loading = 0
      this.updateInterfaceLoading()
      this.work = 'builder'
      this.actionSheet = Assets.cache.get('628')
      this.standingSheet = Assets.cache.get('419')
      this.walkingSheet = Assets.cache.get('658')
    }
    this.previousDest = null
    return this.sendTo(building, 'build')
  }
  sendToFarm(farm) {
    if (this.work !== 'farmer') {
      this.loading = 0
      this.updateInterfaceLoading()
      this.work = 'farmer'
      this.actionSheet = Assets.cache.get('632')
      this.standingSheet = Assets.cache.get('432')
      this.walkingSheet = Assets.cache.get('672')
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
    }
    this.previousDest = null
    return this.sendTo(tree, 'chopwood')
  }
  sendToBerrybush(berrybush) {
    if (this.work !== 'gatherer') {
      this.loading = 0
      this.updateInterfaceLoading()
      this.work = 'gatherer'
      this.actionSheet = Assets.cache.get('632')
      this.standingSheet = Assets.cache.get('432')
      this.walkingSheet = Assets.cache.get('672')
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
        speed: data.speed,
        attack: data.attack,
        work: 'attacker',
        standingSheet: Assets.cache.get('425'),
        walkingSheet: Assets.cache.get('664'),
        actionSheet: Assets.cache.get('212'),
        dyingSheet: Assets.cache.get('321'),
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
}
