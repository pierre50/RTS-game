import { sound } from '@pixi/sound'
import { resource } from './resource'
import { Assets, Sprite, Polygon } from 'pixi.js'
import { randomRange, drawInstanceBlinkingSelection } from '../../lib'
import { colorGold } from '../../constants'

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
      if (controls.mouseBuilding || controls.mouseRectangle || !controls.isMouseInApp()) {
        return
      }
      controls.mouse.prevent = true
      // Send Villager to forage the berry
      let hasVillager = false
      let hasOther = false
      for (let i = 0; i < player.selectedUnits.length; i++) {
        const unit = player.selectedUnits[i]
        if (unit.type === 'Villager') {
          hasVillager = true
          unit.sendToGold(this)
        } else {
          unit.sendTo(this)
        }
      }
      if (hasOther) {
        const sounds = randomItem(['5075', '5076', '5128', '5164'])
        sound.play(sounds)
      } else if (hasVillager) {
        sound.play('5075')
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
