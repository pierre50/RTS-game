import { sound } from '@pixi/sound'
import { Container, Assets, AnimatedSprite, Graphics } from 'pixi.js'
import { accelerator, stepTime, corpseTime } from '../constants'
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
  getHitPointsWithDamage,
  uuidv4,
  CustomTimeout,
  setUnitTexture,
} from '../lib'

export class Animal extends Container {
  constructor(options, context) {
    super()

    this.context = context

    const {
      context: { map },
    } = this
    this.setParent(map)
    this.name = uuidv4()
    this.family = 'animal'

    this.dest = null
    this.realDest = null
    this.previousDest = null
    this.path = []
    this.selected = false
    this.degree = randomRange(1, 360)
    this.action = null
    this.currentFrame = 0
    this.currentSheet = 'standingSheet'
    this.inactif = true
    this.isDead = false
    this.isDestroyed = false
    this.timeout
    this.x = null
    this.y = null
    this.z = null

    Object.keys(options).forEach(prop => {
      this[prop] = options[prop]
    })
    Object.keys(this.owner.config.animals[this.type]).forEach(prop => {
      this[prop] = this.owner.config.animals[this.type][prop]
    })

    this.size = 1
    this.visible = false
    this.x = this.x ?? map.grid[this.i][this.j].x
    this.y = this.y ?? map.grid[this.i][this.j].y
    this.z = this.z ?? map.grid[this.i][this.j].z
    this.zIndex = getInstanceZIndex(this)

    this.currentCell = map.grid[this.i][this.j]
    this.currentCell.has = this
    this.currentCell.solid = true

    this.hitPoints = this.hitPoints ?? this.totalHitPoints
    this.quantity = this.quantity ?? this.totalQuantity

    for (const [key, value] of Object.entries(this.assets)) {
      this[key] = Assets.cache.get(value)
    }

    this.interface = {
      info: element => {
        const data = this.owner.config.animals[this.type]
        this.setDefaultInterface(element, data)
      },
    }

    this.allowMove = false
    this.eventMode = 'static'
    this.sprite = new AnimatedSprite(this.standingSheet.animations['south'])
    this.sprite.name = 'sprite'
    this.sprite.allowMove = false
    this.sprite.eventMode = 'auto'
    this.sprite.allowClick = false
    this.sprite.roundPixels = true
    this.sprite.loop = this.loop ?? true
    if (this.isDead) {
      this.currentSheet === 'corpseSheet' ? this.decompose() : this.death()
    } else {
      this.setTextures(this.currentSheet)
    }
    this.sprite.currentFrame = this.currentFrame

    this.on('pointerup', evt => {
      const {
        context: { controls, player, menu },
      } = this
      if (controls.mouseBuilding || controls.mouseRectangle || !controls.isMouseInApp(evt)) {
        return
      }
      controls.mouse.prevent = true
      let drawDestinationRectangle = false
      let hasSentVillager = false
      let hasSentOther = false

      if (player.selectedUnits.length) {
        for (let i = 0; i < player.selectedUnits.length; i++) {
          const playerUnit = player.selectedUnits[i]
          if (playerUnit.type === 'Villager') {
            if (getActionCondition(playerUnit, this, 'hunt')) {
              playerUnit.sendToHunt(this)
              hasSentVillager = true
              drawDestinationRectangle = true
            } else if (getActionCondition(playerUnit, this, 'takemeat')) {
              playerUnit.sendToTakeMeat(this)
              hasSentVillager = true
              drawDestinationRectangle = true
            }
          } else if (getActionCondition(playerUnit, this, 'attack')) {
            playerUnit.sendTo(this, 'attack')
            drawDestinationRectangle = true
            hasSentOther = true
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

      if (hasSentOther) {
        const voice = randomItem(['5075', '5076', '5128', '5164'])
        sound.play(voice)
      } else if (hasSentVillager) {
        const voice = Assets.cache.get('config').units.Villager.sounds.hunt
        sound.play(voice)
      }
      if (drawDestinationRectangle) {
        drawInstanceBlinkingSelection(this)
      }
    })

    this.interval = null
    this.sprite.updateAnchor = true
    this.addChild(this.sprite)

    renderCellOnInstanceSight(this)
  }

  startInterval(callback, time, immediate = true) {
    const finalCb = () => {
      const { paused } = this.context
      if (paused) {
        return
      }
      callback()
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

  pause() {
    this.timeout?.pause()
    this.sprite?.stop()
  }

  resume() {
    this.timeout?.resume()
    this.sprite?.play()
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
    if (
      this.isAnimalAtDest(action, dest) &&
      (!map.grid[this.i][this.j].solid ||
        (map.grid[this.i][this.j].solid && map.grid[this.i][this.j].has?.name === this.name))
    ) {
      this.setDest(dest)
      this.action = action
      this.degree = getInstanceDegree(this, dest.x, dest.y)
      this.getAction(action)
      return
    }
    // Set animal path
    if (map.grid[dest.i] && map.grid[dest.i][dest.j] && map.grid[dest.i][dest.j].solid) {
      path = getInstanceClosestFreeCellPath(this, dest, map)
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

            this.sounds && this.sounds.hit && this.visible && sound.play(this.sounds.hit)

            if (this.dest.hitPoints > 0) {
              this.dest.hitPoints = getHitPointsWithDamage(this, this.dest)
              if (
                this.dest.selected &&
                player &&
                (player.selectedUnit === this.dest || player.selectedBuilding === this.dest)
              ) {
                menu.updateInfo('hitPoints', this.dest.hitPoints + '/' + this.dest.totalHitPoints)
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
      nextCell.has.family === 'animal' &&
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
      // Move to next
      const oldDeg = this.degree
      moveTowardPoint(this, nextCell.x, nextCell.y, this.speed)
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
    if (this.strategy && instance && instance.family === 'unit' && !this.isDead && !this.path.length && !this.dest) {
      this.getReaction(instance)
    }
  }

  isAttacked(instance) {
    if (!instance || this.dest || this.isDead) {
      return
    }
    this.getReaction(instance)
  }

  stop() {
    if (this.currentCell.has.name !== this.name && this.currentCell.solid) {
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
    } else if (this.hasPath()) {
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

  decompose() {
    const {
      context: { player, menu },
    } = this
    this.setTextures('corpseSheet')
    this.sprite.animationSpeed = 0
    this.startInterval(() => {
      if (this.quantity > 0) {
        this.quantity--
        if (this.selected && player.selectedOther === this) {
          menu.updateInfo('quantity-text', this.quantity)
        }
      }
      this.updateTexture()
    }, 5000)
  }

  death() {
    this.setTextures('dyingSheet')
    this.zIndex--
    this.sprite.loop = false
    this.sprite.onComplete = () => {
      this.decompose()
    }
  }

  die() {
    if (this.isDead) {
      return
    }
    if (this.sounds && this.visible) {
      this.sounds.die && sound.play(this.sounds.die)
      this.sounds.fall && sound.play(this.sounds.fall)
    }
    clearCellOnInstanceSight(this)

    this.owner.population--
    this.stopInterval()
    this.isDead = true
    this.zIndex--
    this.path = []
    this.action = null
    this.death()
  }

  updateTexture() {
    const {
      context: { player, map },
    } = this
    const percentage = getPercentage(this.quantity, this.totalQuantity)

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
      this.timeout = new CustomTimeout(() => {
        this.clear()
      }, corpseTime * 1000)
    }
  }

  clear() {
    const {
      context: { map },
    } = this
    this.isDestroyed = true
    // Remove from map corpses
    const corpsesIndex = map.grid[this.i][this.j].corpses.indexOf(this)
    corpsesIndex >= 0 && map.grid[this.i][this.j].corpses.splice(corpsesIndex, 1)
    map.removeChild(this)
    this.destroy({ child: true, texture: true })
  }

  setTextures(sheet) {
    setUnitTexture(sheet, this, accelerator)
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

    const hitPointsDiv = document.createElement('div')
    hitPointsDiv.id = 'hitPoints'
    hitPointsDiv.textContent = this.hitPoints + '/' + this.totalHitPoints
    element.appendChild(hitPointsDiv)

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
