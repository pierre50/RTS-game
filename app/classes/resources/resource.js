import { Container, Graphics } from 'pixi.js'
import { getInstanceZIndex, instanceIsInPlayerSight, getIconPath } from '../../lib'

export class resource extends Container {
  constructor(options, context) {
    super()

    this.context = context

    const {
      context: { map },
    } = this
    this.setParent(map)

    this.id = map.children.length
    this.name = 'resource'
    Object.keys(options).forEach(prop => {
      this[prop] = options[prop]
    })
    this.x = map.grid[this.i][this.j].x
    this.y = map.grid[this.i][this.j].y
    this.z = map.grid[this.i][this.j].z
    this.zIndex = getInstanceZIndex(this)
    map.grid[this.i][this.j].has = this
    this.selected = false
    this.visible = false
    this.isDead = false
    this.isDestroyed = false

    this.hitPoints = this.totalHitPoints

    // Set solid zone
    const cell = map.grid[this.i][this.j]
    cell.solid = true
    cell.has = this

    this.interactive = false
    this.allowClick = false
    this.allowMove = false

    if (this.sprite) {
      this.sprite.allowMove = false
      this.sprite.interactive = true
      this.sprite.roundPixels = true

      this.sprite.on('pointertap', () => {
        const {
          context: { player, menu },
        } = this
        if (!player.selectedUnits.length && (instanceIsInPlayerSight(this, player) || map.revealEverything)) {
          player.unselectAll()
          this.select()
          menu.setBottombar(this)
          player.selectedOther = this
        }
      })
      this.addChild(this.sprite)
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
    const path = [-32 * this.size, 0, 0, -16 * this.size, 32 * this.size, 0, 0, 16 * this.size]
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

  die() {
    if (this.isDead) {
      return
    }
    const {
      context: { player, players, map, menu },
    } = this
    if (this.selected && player.selectedOther === this) {
      player.unselectAll()
    }
    const listName = 'founded' + this.type + 's'
    for (let i = 0; i < players.length; i++) {
      if (players[i].type === 'AI') {
        const list = players[i][listName]
        const index = list.indexOf(this)
        list.splice(index, 1)
      }
    }
    // Remove from map resources
    let index = map.resources.indexOf(this)
    if (index >= 0) {
      map.resources.splice(index, 1)
    }
    menu.updateResourcesMiniMap()
    this.isDead = true
    if (typeof this.onDie === 'function') {
      this.onDie()
    } else {
      this.clear()
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
    if (map.grid[this.i][this.j].has === this) {
      map.grid[this.i][this.j].has = null
      map.grid[this.i][this.j].solid = false
    }
    const corpseIndex = map.grid[this.i][this.j].corpses.indexOf(this)
    corpseIndex >= 0 && map.grid[this.i][this.j].corpses.splice(corpseIndex, 1)
    map.removeChild(this)
    this.destroy({ child: true, texture: true })
  }

  setDefaultInterface(element, data) {
    const {
      context: { menu },
    } = this
    const typeDiv = document.createElement('div')
    typeDiv.id = 'type'
    typeDiv.textContent = this.type
    element.appendChild(typeDiv)

    const iconImg = document.createElement('img')
    iconImg.id = 'icon'
    iconImg.src = getIconPath(data.icon)
    element.appendChild(iconImg)

    if (this.hitPoints) {
      const lifeDiv = document.createElement('div')
      lifeDiv.id = 'hitPoints'
      lifeDiv.textContent = this.hitPoints + '/' + this.totalHitPoints
      element.appendChild(lifeDiv)
    }
    if (this.quantity) {
      const quantityDiv = document.createElement('div')

      quantityDiv.id = 'quantity'
      quantityDiv.className = 'resource-quantity'

      let iconToUse
      switch (this.type) {
        case 'Tree':
          iconToUse = menu.icons['wood']
          break
        case 'Berrybush':
          iconToUse = menu.icons['food']
          break
        case 'Stone':
          iconToUse = menu.icons['stone']
          break
        case 'Gold':
          iconToUse = menu.icons['gold']
          break
      }
      const smallIconImg = document.createElement('img')
      smallIconImg.src = iconToUse
      smallIconImg.className = 'resource-quantity-icon'
      const textDiv = document.createElement('div')
      textDiv.id = 'quantity-text'
      textDiv.textContent = this.quantity
      quantityDiv.appendChild(smallIconImg)
      quantityDiv.appendChild(textDiv)
      element.appendChild(quantityDiv)
    }
  }
}
