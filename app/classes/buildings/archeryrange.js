import { Building } from './building'
import { Assets, Sprite, Polygon } from 'pixi.js'
import { getTexture, changeSpriteColor, getBuildingTextureNameWithSize } from '../../lib'

export class ArcheryRange extends Building {
  constructor({ i, j, owner, isBuilt = false }, context) {
    const type = 'ArcheryRange'
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
        assets,
        interface: {
          info: element => {
            const assets = Assets.cache.get(this.owner.civ.toLowerCase()).buildings[this.owner.age][this.type]
            this.setDefaultInterface(element, assets)
          },
          menu: owner.isPlayed ? [context.menu.getUnitButton('Bowman')] : [],
        },
      },
      context
    )
  }

  finalTexture() {
    const assets = Assets.cache.get(this.owner.civ.toLowerCase()).buildings[this.owner.age][this.type]

    const spriteColor = this.getChildByName('sprite')
    spriteColor.texture = getTexture(assets.images.final, Assets)
    changeSpriteColor(spriteColor, this.owner.color)
    spriteColor.anchor.set(spriteColor.texture.defaultAnchor.x, spriteColor.texture.defaultAnchor.y)
  }
}
