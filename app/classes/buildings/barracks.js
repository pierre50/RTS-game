import { Building } from './building'
import { Assets, Sprite, Polygon } from 'pixi.js'
import { getTexture, changeSpriteColor, getBuildingTextureNameWithSize, getBuildingAsset } from '../../lib'

export class Barracks extends Building {
  constructor({ i, j, owner, isBuilt = false }, context) {
    const type = 'Barracks'
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
          menu: owner.isPlayed ? [context.menu.getUnitButton('Clubman')] : [],
        },
      },
      context
    )
  }

  finalTexture() {
    const assets = getBuildingAsset(this.type, this.owner, Assets)

    const sprite = this.getChildByName('sprite')
    sprite.texture = getTexture(assets.images.final, Assets)
    sprite.anchor.set(sprite.texture.defaultAnchor.x, sprite.texture.defaultAnchor.y)

    if (assets.images.color) {
      const spriteColor = Sprite.from(getTexture(assets.images.color, Assets))
      spriteColor.name = 'color'
      changeSpriteColor(spriteColor, this.owner.color)
      this.addChildAt(spriteColor, 0)
    }
  }
}