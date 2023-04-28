import { Building } from './building'
import { Assets, Sprite, Polygon } from 'pixi.js'
import { getTexture, getBuildingTextureNameWithSize, getBuildingAsset } from '../../lib'

export class StoragePit extends Building {
  constructor({ i, j, owner, isBuilt = false }, context) {
    const type = 'StoragePit'
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
        },
      },
      context
    )
  }
}
