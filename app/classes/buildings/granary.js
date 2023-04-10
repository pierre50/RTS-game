import { Building } from './building'
import { Assets, Sprite, Polygon } from 'pixi.js'
import { getTexture, changeSpriteColor, getBuildingTextureNameWithSize } from '../../lib'

export class Granary extends Building {
  constructor({ i, j, owner, isBuilt = false }, context) {
    const type = 'Granary'
    const config = Assets.cache.get('config').buildings[type]

    // Define sprite
    const texture = getTexture(getBuildingTextureNameWithSize(config.size), Assets)
    const sprite = Sprite.from(texture)
    sprite.updateAnchor = true
    sprite.name = 'sprite'
    sprite.hitArea = new Polygon(texture.hitArea)

    super(
      {
        i,
        j,
        owner,
        type,
        sprite,
        isBuilt,
        ...config,
        interface: {
          info: element => {
            const assets = Assets.cache.get(this.owner.civ.toLowerCase()).buildings[this.owner.age][this.type]
            this.setDefaultInterface(element, assets)
          },
        },
      },
      context
    )
  }

  finalTexture() {
    const assets = Assets.cache.get(this.owner.civ.toLowerCase()).buildings[this.owner.age][this.type]

    const sprite = this.getChildByName('sprite')
    sprite.texture = getTexture(assets.images.final, Assets)
    sprite.anchor.set(sprite.texture.defaultAnchor.x, sprite.texture.defaultAnchor.y)

    const spriteColor = Sprite.from(getTexture(assets.images.color, Assets))
    spriteColor.name = 'color'
    changeSpriteColor(spriteColor, this.owner.color)
    this.addChildAt(spriteColor, 0)
  }
}
