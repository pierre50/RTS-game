import { resource } from './resource'
import { Assets, Sprite, Polygon } from 'pixi.js'
import { drawInstanceBlinkingSelection } from '../../lib'
import { colorBerry } from '../../constants'

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
      if (controls.mouseBuilding || controls.mouseRectangle || !controls.isMouseInApp()) {
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
