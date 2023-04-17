import { Building } from './building'
import { Assets, Sprite } from 'pixi.js'
import {
  getTexture,
  getBuildingTextureNameWithSize,
  getBuildingAsset,
} from '../../lib'

export class WatchTower extends Building {
  constructor({ i, j, owner, isBuilt = false }, context) {
    const type = 'WatchTower'
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
        isUsedBy: null,
        ...config,
        interface: {
          info: element => {
            const assets = getBuildingAsset(this.type, this.owner, Assets)
            this.setDefaultInterface(element, assets)
          },
        },
      },
      context
    )
  }
}
