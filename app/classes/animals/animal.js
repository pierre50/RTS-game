import { Container, AnimatedSprite, Graphics } from 'pixi.js'
import { accelerator, stepTime, corpseTime } from '../../constants'
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
  drawInstanceBlinkingSelection,
  findInstancesInSight,
  getClosestInstanceWithPath,
  getCellsAroundPoint,
  instanceIsInPlayerSight,
  getActionCondition,
} from '../../lib'

export class Animal extends Container {
  constructor(options, context) {
    super()

    this.context = context

    const {
      context: { map, player },
    } = this
    this.setParent(map)
    this.id = map.children.length
    this.name = 'animal'

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
      if (!player || controls.mouseBuilding || controls.mouseRectangle || !controls.isMouseInApp()) {
        return
      }
      controls.mouse.prevent = true
      let drawDestinationRectangle = false
      if (player.selectedUnits.length) {
        for (let i = 0; i < player.selectedUnits.length; i++) {
          const playerUnit = player.selectedUnits[i]
          if (getActionCondition(playerUnit, this, 'hunt')) {
            playerUnit.sendToHunt(this)
            drawDestinationRectangle = true
          } else if (getActionCondition(playerUnit, this, 'attack')) {
            playerUnit.sendTo(this, 'attack')
            drawDestinationRectangle = true
          } else if (getActionCondition(playerUnit, this, 'takemeat')) {
            playerUnit.sendToTakeMeat(this)
            drawDestinationRectangle = true
          }
        }
      } else if (player.selectedBuilding && player.selectedBuilding.range) {
        if (
          getActionCondition(player.selectedBuilding, this, 'attack') &&
          instancesDistance(player.selectedBuilding, this) <= player.selectedBuilding.range
        ) {
          player.selectedBuilding.attackAction(this)
          drawDestinationRectangle = true
        }
      } else if (instanceIsInPlayerSight(this, player) || map.revealEverything) {
        player.unselectAll()
        this.select()
        menu.setBottombar(this)
        player.selectedOther = this
      }

      if (drawDestinationRectangle) {
        drawInstanceBlinkingSelection(this)
      }
    })

    this.interval = null
    sprite.updateAnchor = true
    this.addChild(sprite)

    this.stop()

    renderCellOnInstanceSight(this)
  }

  startInterval(callback, time, immediate = true) {
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

    this.setTextures('walkingSheet')
    this.inactif = false
    this.path = path
    this.startInterval(() => this.step(), stepTime, true)
  }

  isAnimalAtDest(action, dest) {
    if (!action) {
      return false
    }
    if (!dest) {
      this.affectNewDest()
      return false
    }
    return instanceContactInstance(this, dest)
  }

  sendTo(dest, action) {
    const {
      context: { map },
    } = this
    this.stopInterval()
    let path = []
    // No instance we cancel the destination
    if (!dest) {
      this.stop()
      return
    }
    // Animal is already beside our target
    if (this.isAnimalAtDest(action, dest)) {
      this.setDest(dest)
      this.action = action
      this.degree = getInstanceDegree(this, dest.x, dest.y)
      this.getAction(action)
      return
    }
    // Set animal path
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
    // Animal found a path, set the action and play walking animation
    if (path.length) {
      this.setDest(dest)
      this.action = action
      this.setPath(path)
    } else {
      this.stop()
    }
  }

  getActionCondition(target) {
    return getActionCondition(this, target, this.action)
  }

  getAction(name) {
    const {
      context: { menu, player },
    } = this
    switch (name) {
      case 'attack':
        if (!this.getActionCondition(this.dest)) {
          this.affectNewDest()
          return
        }
        this.setTextures('actionSheet')
        this.startInterval(() => {
          if (!this.getActionCondition(this.dest)) {
            if (this.dest.life <= 0) {
              this.dest.die()
            }
            this.affectNewDest()
            return
          }
          if (this.destHasMoved()) {
            this.degree = getInstanceDegree(this, this.dest.x, this.dest.y)
            this.setTextures('actionSheet')
          }
          if (!instanceContactInstance(this, this.dest)) {
            this.sendTo(this.dest, 'attack')
            return
          }
          if (this.dest.life > 0) {
            this.dest.life = Math.max(this.dest.life - this.attack, 0)
            if (
              this.dest.selected &&
              player &&
              (player.selectedUnit === this.dest || player.selectedBuilding === this.dest)
            ) {
              menu.updateInfo('life', element => (element.textContent = this.dest.life + '/' + this.dest.lifeMax))
            }
            this.dest.isAttacked(this)
          }

          if (this.dest.life <= 0) {
            this.dest.die()
            this.affectNewDest()
          }
        }, this.rateOfFire * 1000)
        break
      default:
        this.stop()
    }
  }

  affectNewDest() {
    this.stopInterval()
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
    this.stop()
    return
  }

  destHasMoved() {
    return (
      (this.dest.i !== this.realDest.i || this.dest.j !== this.realDest.j) &&
      instancesDistance(this, this.dest) <= this.sight
    )
  }

  moveToPath() {
    const {
      context: { map, player },
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
    if (instancesDistance(this, nextCell, false) < this.speed) {
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
      if (this.isAnimalAtDest(this.action, this.dest)) {
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
    if (!instance || this.dest) {
      return
    }
    if (this.type === 'Gazelle') {
      this.runaway()
    } else {
      this.sendTo(instance, 'attack')
    }
  }

  stop() {
    if (this.currentCell.has !== this && this.currentCell.solid) {
      this.sendTo(this.currentCell)
      return
    }
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

  step() {
    if (this.life <= 0) {
      this.die()
    }
    if (this.hasPath()) {
      this.moveToPath()
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
    if (this.isDead) {
      return
    }
    this.stopInterval()
    this.isDead = true
    this.path = []
    this.action = null
    this.zIndex--
    const sprite = this.getChildByName('sprite')
    this.setTextures('dyingSheet')
    sprite.loop = false
    sprite.onComplete = () => {
      this.owner.population--
      this.setTextures('corpseSheet')
      sprite.animationSpeed = (1 / (corpseTime * 1000)) * accelerator
      sprite.onComplete = () => {
        this.clear()
      }
    }
  }

  clear() {
    const {
      context: { player, map },
    } = this
    clearCellOnInstanceSight(this)
    map.grid[this.i][this.j].has = null
    map.grid[this.i][this.j].solid = false
    map.removeChild(this)
    if (this.selected && player) {
      player.unselectAll()
    }
    this.isDestroyed = true
    this.destroy({ child: true, texture: true })
  }

  setTextures(sheet) {
    const sprite = this.getChildByName('sprite')
    const sheetToReset = ['actionSheet']
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
    if (!sheetToReset.includes(sheet)) {
      sprite.onLoop = null
    }
    this.currentSheet = sheet
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
    sprite.animationSpeed = (this[sheet].data.animationSpeed || (sheet === 'standingSheet' ? 0.15 : 0.3)) * accelerator
    sprite.play()
  }

  setDefaultInterface(element, data) {
    const {
      context: { menu },
    } = this

    const civDiv = document.createElement('div')
    civDiv.id = 'civ'
    civDiv.textContent = ''
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

    const quantityDiv = document.createElement('div')
    quantityDiv.id = 'quantity'
    quantityDiv.className = 'resource-quantity'
    const smallIconImg = document.createElement('img')
    smallIconImg.src = menu.icons['food']
    smallIconImg.className = 'resource-quantity-icon'
    const textDiv = document.createElement('div')
    textDiv.id = 'quantity-text'
    textDiv.textContent = this.quantity
    quantityDiv.appendChild(smallIconImg)
    quantityDiv.appendChild(textDiv)
    element.appendChild(quantityDiv)
  }
}
