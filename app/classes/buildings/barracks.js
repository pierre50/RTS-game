import { Building } from './building'
import { Assets, Sprite, Polygon } from 'pixi.js'
import { getTexture, changeSpriteColor } from '../../lib'

export class Barracks extends Building {
  constructor({ i, j, owner, isBuilt = false }, context) {
    const type = 'Barracks'
    const config = Assets.cache.get('config').buildings[type]
    const assets = Assets.cache.get(owner.civ.toLowerCase()).buildings[owner.age][type]

    // Define sprite
    const texture = getTexture(assets.images.build, Assets)
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
            this.setDefaultInterface(element, assets)
          },
          menu: owner.isPlayed ? [context.menu.getUnitButton('Clubman')] : [],
        },
      },
      context
    )
  }

  finalTexture() {
    const spriteColor = this.getChildByName('sprite')
    spriteColor.texture = getTexture(this.assets.images.final, Assets)
    changeSpriteColor(spriteColor, this.owner.color)
    spriteColor.anchor.set(spriteColor.texture.defaultAnchor.x, spriteColor.texture.defaultAnchor.y)
  }
}
