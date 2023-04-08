import { Building } from './building'
import { Assets, Sprite, Polygon } from 'pixi.js'
import { getTexture, changeSpriteColor } from '../../lib'

export class TownCenter extends Building {
  constructor({ i, j, owner, isBuilt = false }, context) {
    const type = 'TownCenter'
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
          menu: owner.isPlayed ? [context.menu.getUnitButton('Villager')] : [],
        },
      },
      context
    )
  }

  finalTexture() {
    const sprite = this.getChildByName('sprite')
    sprite.texture = getTexture(this.assets.images.final, Assets)
    sprite.anchor.set(sprite.texture.defaultAnchor.x, sprite.texture.defaultAnchor.y)

    const spriteColor = Sprite.from(getTexture(this.assets.images.color, Assets))
    spriteColor.name = 'color'

    changeSpriteColor(spriteColor, this.owner.color)

    this.addChildAt(spriteColor, 0)
  }
}
