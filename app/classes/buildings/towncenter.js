import { Building } from './building'
import { Assets, Sprite, Polygon } from 'pixi.js'
import { getTexture, changeSpriteColor, getBuildingTextureNameWithSize, getBuildingAsset } from '../../lib'

export class TownCenter extends Building {
  constructor({ i, j, owner, isBuilt = false }, context) {
    const type = 'TownCenter'
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
          menu: owner.isPlayed
            ? [
                context.menu.getUnitButton('Villager'),
                context.menu.getTechnologyButton('ToolAge'),
                context.menu.getTechnologyButton('BronzeAge'),
                context.menu.getTechnologyButton('IronAge'),
              ]
            : [],
        },
      },
      context
    )
  }
}
