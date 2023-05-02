import { Building } from './building'
import { Assets, Sprite } from 'pixi.js'
import { getTexture, getBuildingTextureNameWithSize, getBuildingAsset } from '../../lib'

export class SiegeWorkshop extends Building {
  constructor({ i, j, owner, isBuilt = false }, context) {
    const type = 'SiegeWorkshop'
    const config = owner.config[type]

    // Define sprite
    const texture = getTexture(getBuildingTextureNameWithSize(config.size), Assets)
    const sprite = Sprite.from(texture)
    sprite.updateAnchor = true
    sprite.name = 'sprite'

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
          menu: owner.isPlayed ? [] : [],
        },
      },
      context
    )
  }
}
