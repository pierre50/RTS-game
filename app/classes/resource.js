import { sound } from '@pixi/sound'
import { Container, Graphics, Sprite, Assets, Polygon, AnimatedSprite } from 'pixi.js'
import {
  getInstanceZIndex,
  instanceIsInPlayerSight,
  getIconPath,
  randomItem,
  drawInstanceBlinkingSelection,
  getActionCondition,
  uuidv4,
} from '../lib'
import {
  TYPE_ACTION,
  CELL_WIDTH,
  CELL_HEIGHT,
  COLOR_WHITE,
  FAMILY_TYPES,
  PLAYER_TYPES,
  LABEL_TYPES,
  MENU_INFO_IDS,
  RESOURCE_TYPES,
} from '../constants'

export class Resource extends Container {
  constructor(options, context) {
    super()

    this.context = context

    const {
      context: { map },
    } = this

    this.label = uuidv4()
    this.family = FAMILY_TYPES.resource

    this.selected = false
    this.isDead = false
    this.isDestroyed = false
    this.size = 1

    Object.keys(options).forEach(prop => {
      this[prop] = options[prop]
    })
    const config = Assets.cache.get('config')
    Object.keys(config.resources[this.type]).forEach(prop => {
      this[prop] = config.resources[this.type][prop]
    })

    this.quantity = this.quantity ?? this.totalQuantity
    this.hitPoints = this.hitPoints ?? this.totalHitPoints
    this.x = map.grid[this.i][this.j].x
    this.y = map.grid[this.i][this.j].y
    this.z = map.grid[this.i][this.j].z
    this.zIndex = getInstanceZIndex(this)
    this.visible = false

    // Set solid zone
    const cell = map.grid[this.i][this.j]
    cell.solid = true
    cell.has = this

    this.eventMode = 'auto'
    this.allowClick = false
    this.allowMove = false

    this.interface = {
      info: element => {
        const data = config.resources[this.type]
        this.setDefaultInterface(element, data)
      },
    }
    if (this.isAnimated) {
      const spritesheetJump = Assets.cache.get(this.assets)
      this.sprite = new AnimatedSprite(spritesheetJump.animations.jump)
      this.sprite.play()
      this.sprite.animationSpeed = 0.2
    } else {
      this.textureName =
        this.textureName || randomItem(Array.isArray(this.assets) ? this.assets : this.assets[cell.type])
      const resourceName = this.textureName.split('_')[1]
      const textureFile = this.textureName + '.png'
      const spritesheet = Assets.cache.get(resourceName)
      const texture = spritesheet.textures[textureFile]
      this.sprite = Sprite.from(texture)
      this.sprite.hitArea =
        spritesheet.data.frames[textureFile].hitArea && new Polygon(spritesheet.data.frames[textureFile].hitArea)
    }

    this.sprite.updateAnchor = true
    this.sprite.label = LABEL_TYPES.sprite
    if (this.sprite) {
      this.sprite.allowMove = false
      this.sprite.eventMode = 'static'
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
      this.sprite.on('pointerup', evt => {
        const {
          context: { player, controls },
        } = this
        const action = TYPE_ACTION[this.category || this.type]
        if (controls.mouseBuilding || controls.mouseRectangle || !controls.isMouseInApp(evt)) {
          return
        }
        controls.mouse.prevent = true
        // Send Villager to forage the berry
        let hasVillager = false
        let hasOther = false
        for (let i = 0; i < player.selectedUnits.length; i++) {
          const unit = player.selectedUnits[i]
          if (getActionCondition(unit, this, action)) {
            hasVillager = true
            const sendToFunc = `sendTo${this.category || this.type}`
            typeof unit[sendToFunc] === 'function' ? unit[sendToFunc](this) : unit.sendTo(this)
          } else {
            hasOther = true
            unit.sendTo(this)
          }
        }
        if (hasVillager) {
          drawInstanceBlinkingSelection(this)
        }
        if (hasOther) {
          const voice = randomItem(['5075', '5076', '5128', '5164'])
          voice && sound.play(voice)
        } else if (hasVillager) {
          const voice = Assets.cache.get('config').units.Villager.sounds[action]
          voice && sound.play(voice)
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
    selection.label = LABEL_TYPES.selection
    selection.zIndex = 3
    const path = [-32 * this.size, 0, 0, -16 * this.size, 32 * this.size, 0, 0, 16 * this.size]
    selection.poly(path)
    selection.stroke(COLOR_WHITE)
    this.addChildAt(selection, 0)
  }

  unselect() {
    if (!this.selected) {
      return
    }
    this.selected = false
    const selection = this.getChildByLabel(LABEL_TYPES.selection)
    if (selection) {
      this.removeChild(selection)
    }
  }

  die(immediate) {
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
      if (players[i].type === PLAYER_TYPES.ai) {
        const list = players[i][listName]
        if (list) {
          const index = list.indexOf(this)
          list.splice(index, 1)
        }
      }
    }
    // Remove from map resources
    let index = map.resources.indexOf(this)
    if (index >= 0) {
      map.resources.splice(index, 1)
    }
    menu.updateResourcesMiniMap()
    this.isDead = true
    if (this.type === RESOURCE_TYPES.tree && !immediate) {
      this.onTreeDie()
    } else {
      this.clear()
    }
  }

  setCuttedTreeTexture() {
    const { sprite } = this
    const spritesheet = Assets.cache.get('636')
    this.textureName = `00${randomRange(0, 3)}_636.png`
    const texture = spritesheet.textures[this.textureName]
    sprite.texture = texture
    const points = [-CELL_WIDTH / 2, 0, 0, -CELL_HEIGHT / 2, CELL_WIDTH / 2, 0, 0, CELL_HEIGHT / 2]
    sprite.hitArea = new Polygon(points)
    sprite.anchor.set(texture.defaultAnchor.x, texture.defaultAnchor.y)
  }

  onTreeDie() {
    const {
      context: { map },
    } = this
    const spritesheet = Assets.cache.get('623')
    this.textureName = `00${randomRange(0, 3)}_623.png`
    const texture = spritesheet.textures[this.textureName]
    const { sprite } = this
    sprite.texture = texture
    sprite.eventMode = 'none'
    this.zIndex--
    if (map.grid[this.i][this.j].has === this) {
      map.grid[this.i][this.j].has = null
      map.grid[this.i][this.j].corpses.push(this)
      map.grid[this.i][this.j].solid = false
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
    typeDiv.id = MENU_INFO_IDS.type
    typeDiv.textContent = this.type
    element.appendChild(typeDiv)

    const iconImg = document.createElement('img')
    iconImg.id = MENU_INFO_IDS.icon
    iconImg.src = getIconPath(data.icon)
    element.appendChild(iconImg)

    if (this.hitPoints) {
      const hitPointsDiv = document.createElement('div')
      hitPointsDiv.id = MENU_INFO_IDS.hitPoints
      hitPointsDiv.textContent = this.hitPoints + '/' + this.totalHitPoints
      element.appendChild(hitPointsDiv)
    }
    if (this.quantity) {
      const quantityDiv = document.createElement('div')

      quantityDiv.id = MENU_INFO_IDS.quantity
      quantityDiv.className = 'resource-quantity'

      let iconToUse
      switch (this.type) {
        case RESOURCE_TYPES.tree:
          iconToUse = menu.infoIcons['wood']
          break
        case RESOURCE_TYPES.salmon:
        case RESOURCE_TYPES.berrybush:
          iconToUse = menu.infoIcons['food']
          break
        case RESOURCE_TYPES.stone:
          iconToUse = menu.infoIcons['stone']
          break
        case RESOURCE_TYPES.gold:
          iconToUse = menu.infoIcons['gold']
          break
      }
      const smallIconImg = document.createElement('img')
      smallIconImg.src = iconToUse
      smallIconImg.className = 'resource-quantity-icon'
      const textDiv = document.createElement('div')
      textDiv.id = MENU_INFO_IDS.quantityText
      textDiv.textContent = this.quantity
      quantityDiv.appendChild(smallIconImg)
      quantityDiv.appendChild(textDiv)
      element.appendChild(quantityDiv)
    }
  }
}
