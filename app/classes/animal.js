import { Container, Assets, AnimatedSprite, Graphics } from 'pixi.js'
import { accelerator, stepTime } from '../constants'
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
} from '../lib'

class Animal extends Container {
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

      if (player.selectedUnits.length) {
        drawInstanceBlinkingSelection(this)
        for (let i = 0; i < player.selectedUnits.length; i++) {
          const playerUnit = player.selectedUnits[i]
          if (!this.isDead) {
            if (playerUnit.type === 'Villager') {
              playerUnit.sendToHunt(this)
            } else {
              playerUnit.sendTo(this, 'attack')
            }
          } else {
            if (playerUnit.type === 'Villager') {
              playerUnit.sendToTakeMeat(this)
            }
          }
        }
        return
      }
      if (instanceIsInPlayerSight(this, player) || map.revealEverything) {
        player.unselectAll()
        this.select()
        menu.setBottombar(this)
        player.selectedOther = this
      }
    })

    this.interval = null
    sprite.updateAnchor = true
    this.addChild(sprite)

    this.stop()

    renderCellOnInstanceSight(this)
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
    this.startInterval()
    this.inactif = false
    this.setTextures('walkingSheet')
    this.path = path
  }

  sendTo(dest, action) {
    const {
      context: { map },
    } = this
    let path = []
    // No instance we cancel the destination
    if (!dest) {
      return false
    }
    // Unit is already beside our target
    if (action && instanceContactInstance(this, dest)) {
      this.setDest(dest)
      this.action = action
      this.degree = getInstanceDegree(this, dest.x, dest.y)
      this.getAction(action)
      return true
    }
    // Set unit path
    if (this.parent.grid[dest.i] && this.parent.grid[dest.i][dest.j] && this.parent.grid[dest.i][dest.j].solid) {
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

  getActionCondition(target) {
    const { action, owner } = this
    if (!action) {
      return
    }
    const conditions = {
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
      this.currentCell = this.parent.grid[this.i][this.j]
      if (this.currentCell.has === null) {
        this.currentCell.has = this
        this.currentCell.solid = true
      }

      renderCellOnInstanceSight(this)
      this.path.pop()

      // Destination moved
      if (this.dest.i !== this.realDest.i || this.dest.j !== this.realDest.j) {
        if (this.owner.views[this.dest.i][this.dest.j].viewBy.length > 1) {
          this.sendTo(this.dest, this.action)
          return
        }
      }
      if (this.action && instanceContactInstance(this, this.dest)) {
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
      let speed = this.speed
      if (this.loading > 1) {
        speed *= 0.8
      }
      moveTowardPoint(this, nextCell.x, nextCell.y, speed)
      if (oldDeg !== this.degree) {
        // Change animation according to degree
        this.setTextures('walkingSheet')
      }
    }
  }

  isAttacked(instance) {
    if (!instance || (this.dest && this.dest.name === 'unit' && this.action === 'attack')) {
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
    this.isDead = true
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

        this.setTextures('corpsSheet')
      }
    }
    clearInterval(this.interval)
  }

  clear() {
    if (this.parent) {
      this.parent.removeChild(this)
    }
    if (this.selected && player) {
      player.unselectAll()
    }
    clearCellOnInstanceSight(this)
    this.parent.grid[this.i][this.j].has = null
    this.parent.grid[this.i][this.j].solid = false
    this.isDestroyed = true
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
        sprite.textures[[sprite.currentFrame]].defaultAnchor.y
      )
      return
    }
    // Reset action loop
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
    lifeDiv.textContent = Math.max(this.life, 0) + '/' + this.lifeMax
    element.appendChild(lifeDiv)

    const quantityDiv = document.createElement('div')
    quantityDiv.id = 'quantity'
    quantityDiv.className = 'resource-quantity'
    const smallIconImg = document.createElement('img')
    smallIconImg.src = menu.icons['food']
    smallIconImg.className = 'resource-quantity-icon'
    const textDiv = document.createElement('div')
    textDiv.id = 'quantity-text'
    textDiv.textContent = Math.max(this.quantity, 0)
    quantityDiv.appendChild(smallIconImg)
    quantityDiv.appendChild(textDiv)
    element.appendChild(quantityDiv)
  }
}

export class Gazelle extends Animal {
  constructor({ i, j, owner }, context) {
    const type = 'Gazelle'
    const data = Assets.cache.get('config').animals[type]
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
        quantity: data.quantity,
        standingSheet: Assets.cache.get('418'),
        walkingSheet: Assets.cache.get('657'),
        dyingSheet: Assets.cache.get('314'),
        corpseSheet: Assets.cache.get('314'),
        interface: {
          info: element => {
            const { owner } = this
            this.setDefaultInterface(element, data)
            if (owner.isPlayed) {
              element.appendChild(this.getLoadingElement())
            }
          },
        },
      },
      context
    )
  }
}

export default {
  Gazelle,
}
