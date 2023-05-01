import { sound } from '@pixi/sound'
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
  pointsDistance,
} from '../../lib'

export class Animal extends Container {
  constructor(options, context) {
    super()

    this.context = context

    const {
      context: { map },
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

    this.hitPoints = this.totalHitPoints
    this.quantityMax = this.quantity
    this.inactif = true

    this.allowMove = false
    this.interactive = true
    this.sprite = new AnimatedSprite(this.standingSheet.animations['south'])
    this.sprite.name = 'sprite'
    this.sprite.allowMove = false
    this.sprite.interactive = false
    this.sprite.allowClick = false
    this.sprite.roundPixels = true

    this.on('pointerup', () => {
      const {
        context: { controls, player, menu },
      } = this
      if (controls.mouseBuilding || controls.mouseRectangle || !controls.isMouseInApp()) {
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
      } else if ((instanceIsInPlayerSight(this, player) || map.revealEverything) && this.quantity > 0) {
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
    this.sprite.updateAnchor = true
    this.addChild(this.sprite)

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
              this.degree = getInstanceDegree(this, this.dest.x, this.dest.y)
              this.setTextures('actionSheet')
            }
            if (!instanceContactInstance(this, this.dest)) {
              this.sendTo(this.dest, 'attack')
              return
            }
            if (this.dest.hitPoints > 0) {
              if (this.sounds && this.sounds.attack){
                sound.play(this.sounds.attack)
              }
              this.dest.hitPoints = Math.max(this.dest.hitPoints - this.attack, 0)
              if (
                this.dest.selected &&
                player &&
                (player.selectedUnit === this.dest || player.selectedBuilding === this.dest)
              ) {
                menu.updateInfo(
                  'hitPoints',
                  element => (element.textContent = this.dest.hitPoints + '/' + this.dest.totalHitPoints)
                )
              }
              this.dest.isAttacked(this)
            }

            if (this.dest.hitPoints <= 0) {
              this.dest.die()
              this.affectNewDest()
            }
          },
          this.rateOfFire * 1000,
          false
        )
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
      (nextCell.has.name === 'unit' || nextCell.has.name === 'animal') &&
      nextCell.has !== this &&
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
      if (degreeToDirection(oldDeg) !== degreeToDirection(this.degree)) {
        // Change animation according to degree
        this.setTextures('walkingSheet')
      }
    }
  }

  getReaction(instance) {
    if (this.strategy === 'runaway') {
      this.runaway(instance)
    } else {
      this.sendTo(instance, 'attack')
    }
  }

  detect(instance) {
    if (this.strategy && instance && instance.name === 'unit' && !this.isDead && !this.path.length && !this.dest) {
      this.getReaction(instance)
    }
  }

  isAttacked(instance) {
    if (!instance || this.dest) {
      return
    }
    this.getReaction(instance)
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
    if (this.hitPoints <= 0) {
      this.die()
    }
    if (this.hasPath()) {
      this.moveToPath()
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
      context: { player, menu },
    } = this
    if (this.sounds && this.sounds.dead){
      sound.play(this.sounds.dead)
    }
    this.stopInterval()
    this.isDead = true
    this.path = []
    this.action = null
    this.zIndex--
    this.setTextures('dyingSheet')
    this.sprite.loop = false
    this.sprite.onComplete = () => {
      this.owner.population--
      this.setTextures('corpseSheet')
      this.sprite.animationSpeed = 0
      this.startInterval(() => {
        if (this.quantity > 0) {
          this.quantity--
          if (this.selected && player.selectedOther === this) {
            menu.updateInfo('quantity-text', element => (element.textContent = this.quantity))
          }
        }
        this.updateTexture()
      }, 5000)
    }
  }

  updateTexture() {
    const {
      context: { player, map },
    } = this
    const percentage = getPercentage(this.quantity, this.quantityMax)

    if (percentage > 25 && percentage < 50) {
      this.sprite.currentFrame = 1
    } else if (percentage > 0 && percentage <= 25) {
      this.sprite.currentFrame = 2
    } else if (percentage <= 0) {
      this.stopInterval()
      if (map.grid[this.i][this.j].has === this) {
        map.grid[this.i][this.j].has = null
        map.grid[this.i][this.j].corpses.push(this)
        map.grid[this.i][this.j].solid = false
      }
      if (this.selected && player.selectedOther === this) {
        player.unselectAll()
      }
      this.sprite.currentFrame = 3
      setTimeout(() => {
        this.clear()
      }, corpseTime * 1000)
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
    }
    this.currentSheet = sheet
    if (this.degree > 67.5 && this.degree < 112.5) {
      this.sprite.scale.x = 1
      this.sprite.textures = this[sheet].animations['north']
    } else if (this.degree > 247.5 && this.degree < 292.5) {
      this.sprite.scale.x = 1
      this.sprite.textures = this[sheet].animations['south']
    } else if (this.degree > 337.5 || this.degree < 22.5) {
      this.sprite.scale.x = 1
      this.sprite.textures = this[sheet].animations['west']
    } else if (this.degree >= 22.5 && this.degree <= 67.5) {
      this.sprite.scale.x = 1
      this.sprite.textures = this[sheet].animations['northwest']
    } else if (this.degree >= 292.5 && this.degree <= 337.5) {
      this.sprite.scale.x = 1
      this.sprite.textures = this[sheet].animations['southwest']
    } else if (this.degree > 157.5 && this.degree < 202.5) {
      this.sprite.scale.x = -1
      this.sprite.textures = this[sheet].animations['west']
    } else if (this.degree > 112.5 && this.degree < 157.5) {
      this.sprite.scale.x = -1
      this.sprite.textures = this[sheet].animations['northwest']
    } else if (this.degree > 202.5 && this.degree < 247.5) {
      this.sprite.scale.x = -1
      this.sprite.textures = this[sheet].animations['southwest']
    }
    this.sprite.animationSpeed =
      (this[sheet].data.animationSpeed || (sheet === 'standingSheet' ? 0.15 : 0.3)) * accelerator
    this.sprite.play()
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
    lifeDiv.id = 'hitPoints'
    lifeDiv.textContent = this.hitPoints + '/' + this.totalHitPoints
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
