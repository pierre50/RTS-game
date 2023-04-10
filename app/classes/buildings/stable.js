import { Building } from './building'
import { Assets, Sprite, Polygon } from 'pixi.js'
import { getTexture, changeSpriteColor, getBuildingTextureNameWithSize, getBuildingAsset } from '../../lib'

export class Stable extends Building {
  constructor({ i, j, owner, isBuilt = false }, context) {
    const type = 'Stable'
    const config = Assets.cache.get('config').buildings[type]

    // Define sprite
    const texture = getTexture(getBuildingTextureNameWithSize(config.size), Assets)
    const sprite = Sprite.from(texture)
    sprite.updateAnchor = true
    sprite.name = 'sprite'
    //sprite.hitArea = new Polygon(texture.hitArea)

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
            const assets = getBuildingAsset(this.type, this.owner, Assets)
            this.setDefaultInterface(element, assets)
          },
          menu: owner.isPlayed ? [context.menu.getUnitButton('Scout')] : [],
        },
      },
      context
    )
  }

  finalTexture() {
    const assets = getBuildingAsset(this.type, this.owner, Assets)

    const spriteColor = this.getChildByName('sprite')
    spriteColor.texture = getTexture(assets.images.final, Assets)
    changeSpriteColor(spriteColor, this.owner.color)
    spriteColor.anchor.set(spriteColor.texture.defaultAnchor.x, spriteColor.texture.defaultAnchor.y)
  }
}
