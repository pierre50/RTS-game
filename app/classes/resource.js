import { Container, Assets, Sprite, Polygon, Graphics } from 'pixi.js'
import {
  randomItem,
  getInstanceZIndex,
  randomRange,
  instanceIsInPlayerSight,
  getIconPath,
  instanceIsSurroundedBySolid,
  drawInstanceBlinkingSelection,
  getNewInstanceClosestFreeCellPath,
} from '../lib'
import { colorTree, colorGold, colorStone, colorBerry } from '../constants'

class resource extends Container {
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

    this.life = this.lifeMax

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
    const {
      context: { player, players, map, menu },
    } = this
    if (this.selected && player) {
      player.unselectAll()
    }
    if (typeof this.onDie === 'function') {
      this.onDie()
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
    let index = this.map.resources.indexOf(this)
    if (index >= 0) {
      this.map.resources.splice(index, 1)
    }
    menu.updateResourcesMiniMap()
    map.grid[this.i][this.j].has = null
    map.grid[this.i][this.j].solid = false
    map.removeChild(this)
    this.isDestroyed = true
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

    if (this.life) {
      const lifeDiv = document.createElement('div')
      lifeDiv.id = 'life'
      lifeDiv.textContent = this.life + '/' + this.lifeMax
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

export class Tree extends resource {
  constructor({ i, j }, context) {
    const type = 'Tree'
    const data = Assets.cache.get('config').resources[type]

    // Define sprite
    const forestTrees = ['492', '493', '494', '503', '509']
    const palmTrees = ['463', '464', '465', '466']

    const { map } = context
    const cell = map.grid[i][j]

    let textureNames = forestTrees
    switch (cell.type) {
      case 'desert':
      case 'jungle':
        textureNames = palmTrees
        break
      default:
        textureNames = forestTrees
    }

    const randomSpritesheet = randomItem(textureNames)
    const spritesheet = Assets.cache.get(randomSpritesheet)
    const textureName = `000_${randomSpritesheet}.png`
    const texture = spritesheet.textures[textureName]
    const sprite = Sprite.from(texture)
    sprite.updateAnchor = true
    sprite.name = 'sprite'
    sprite.hitArea = new Polygon(spritesheet.data.frames[textureName].hitArea)
    sprite.on('pointerup', () => {
      const {
        context: { player, controls },
      } = this
      if (!player || controls.mouseBuilding || controls.mouseRectangle || !controls.isMouseInApp()) {
        return
      }
      controls.mouse.prevent = true
      // Send Villager to cut the tree
      let hasVillager = false
      let dest = this
      for (let i = 0; i < player.selectedUnits.length; i++) {
        const unit = player.selectedUnits[i]
        if (instanceIsSurroundedBySolid(this)) {
          const newDest = getNewInstanceClosestFreeCellPath(unit, this, this.parent)
          if (newDest) {
            dest = newDest.target
          }
        }
        if (unit.type === 'Villager') {
          hasVillager = true
          unit.sendToTree(dest)
        } else {
          unit.sendTo(dest)
        }
      }
      if (hasVillager) {
        drawInstanceBlinkingSelection(dest)
      }
    })

    super(
      {
        i,
        j,
        type,
        sprite: sprite,
        size: 1,
        color: colorTree,
        quantity: data.quantity,
        lifeMax: data.lifeMax,
        interface: {
          info: element => {
            this.setDefaultInterface(element, data)
          },
        },
      },
      context
    )
  }
  setCuttedTreeTexture() {
    const sprite = this.getChildByName('sprite')
    const spritesheet = Assets.cache.get('636')
    const textureName = `00${randomRange(0, 3)}_636.png`
    const texture = spritesheet.textures[textureName]
    sprite.texture = texture
    const points = [-32, 0, 0, -16, 32, 0, 0, 16]
    sprite.hitArea = new Polygon(points)
    sprite.anchor.set(texture.defaultAnchor.x, texture.defaultAnchor.y)
  }
  onDie() {
    const {
      context: { player, map },
    } = this
    const spritesheet = Assets.cache.get('623')
    const textureName = `00${randomRange(0, 3)}_623.png`
    const texture = spritesheet.textures[textureName]
    const sprite = Sprite.from(texture)
    if (!instanceIsInPlayerSight(this, player)) {
      sprite.visible = false
    }
    sprite.name = 'stump'
    map.grid[this.i][this.j].addChild(sprite)
  }
}

export class Berrybush extends resource {
  constructor({ i, j }, context) {
    const type = 'Berrybush'
    const data = Assets.cache.get('config').resources[type]
    const resourceName = '240'

    // Define sprite
    const spritesheet = Assets.cache.get(resourceName)
    const textureName = `000_${resourceName}.png`
    const texture = spritesheet.textures[textureName]
    const sprite = Sprite.from(texture)
    sprite.updateAnchor = true
    sprite.name = 'sprite'
    sprite.hitArea = new Polygon(spritesheet.data.frames[textureName].hitArea)
    sprite.on('pointerup', () => {
      const {
        context: { player, controls },
      } = this
      if (!player || controls.mouseBuilding || controls.mouseRectangle || !controls.isMouseInApp()) {
        return
      }
      controls.mouse.prevent = true
      // Send Villager to forage the berry
      let hasVillager = false
      for (let i = 0; i < player.selectedUnits.length; i++) {
        const unit = player.selectedUnits[i]
        if (unit.type === 'Villager') {
          hasVillager = true
          unit.sendToBerrybush(this)
        } else {
          unit.sendTo(this)
        }
      }
      if (hasVillager) {
        drawInstanceBlinkingSelection(this)
      }
    })

    super(
      {
        i,
        j,
        type,
        sprite: sprite,
        size: 1,
        color: colorBerry,
        quantity: data.quantity,
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

export class Stone extends resource {
  constructor({ i, j }, context) {
    const type = 'Stone'
    const data = Assets.cache.get('config').resources[type]
    const resourceName = '622'

    // Define sprite
    const randomSprite = randomRange(0, 6)
    const spritesheet = Assets.cache.get(resourceName)
    const textureName = `00${randomSprite}_${resourceName}.png`
    const texture = spritesheet.textures[textureName]
    const sprite = Sprite.from(texture)
    sprite.updateAnchor = true
    sprite.name = 'sprite'
    sprite.hitArea = new Polygon(spritesheet.data.frames[textureName].hitArea)
    sprite.on('pointerup', () => {
      const {
        context: { player, controls },
      } = this
      if (!player || controls.mouseBuilding || controls.mouseRectangle || !controls.isMouseInApp()) {
        return
      }
      controls.mouse.prevent = true
      // Send Villager to forage the berry
      let hasVillager = false
      for (let i = 0; i < player.selectedUnits.length; i++) {
        const unit = player.selectedUnits[i]
        if (unit.type === 'Villager') {
          hasVillager = true
          unit.sendToStone(this)
        } else {
          unit.sendTo(this)
        }
      }
      if (hasVillager) {
        drawInstanceBlinkingSelection(this)
      }
    })

    super(
      {
        i,
        j,
        type,
        sprite: sprite,
        size: 1,
        color: colorStone,
        quantity: data.quantity,
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

export class Gold extends resource {
  constructor({ i, j }, context) {
    const type = 'Gold'
    const data = Assets.cache.get('config').resources[type]
    const resourceName = '481'

    // Define sprite
    const randomSprite = randomRange(0, 6)
    const spritesheet = Assets.cache.get(resourceName)
    const textureName = `00${randomSprite}_${resourceName}.png`
    const texture = spritesheet.textures[textureName]
    const sprite = Sprite.from(texture)
    sprite.updateAnchor = true
    sprite.name = 'sprite'
    sprite.hitArea = new Polygon(spritesheet.data.frames[textureName].hitArea)
    sprite.on('pointerup', () => {
      const {
        context: { player, controls },
      } = this
      if (!player || controls.mouseBuilding || controls.mouseRectangle || !controls.isMouseInApp()) {
        return
      }
      controls.mouse.prevent = true
      // Send Villager to forage the berry
      let hasVillager = false
      for (let i = 0; i < player.selectedUnits.length; i++) {
        const unit = player.selectedUnits[i]
        if (unit.type === 'Villager') {
          hasVillager = true
          unit.sendToGold(this)
        } else {
          unit.sendTo(this)
        }
      }
      if (hasVillager) {
        drawInstanceBlinkingSelection(this)
      }
    })

    super(
      {
        i,
        j,
        type,
        sprite: sprite,
        color: colorGold,
        size: 1,
        quantity: data.quantity,
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
  Tree,
  Berrybush,
  Stone,
  Gold,
}
