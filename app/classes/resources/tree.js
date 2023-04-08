import { resource } from './resource'
import { Assets, Sprite, Polygon } from 'pixi.js'
import {
  randomItem,
  randomRange,
  instanceIsInPlayerSight,
  instanceIsSurroundedBySolid,
  drawInstanceBlinkingSelection,
  getNewInstanceClosestFreeCellPath,
} from '../../lib'
import { colorTree } from '../../constants'

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
