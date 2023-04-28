import { Building } from './building'
import { Assets, Sprite } from 'pixi.js'
import { getTexture, getBuildingTextureNameWithSize, getBuildingAsset } from '../../lib'

export class ArcheryRange extends Building {
  constructor({ i, j, owner, isBuilt = false }, context) {
    const type = 'ArcheryRange'
    const config = Assets.cache.get('config').buildings[type]

    // Define sprite
    const texture = getTexture(getBuildingTextureNameWithSize(config.size), Assets)
    const sprite = Sprite.from(texture)
    sprite.updateAnchor = true
    sprite.name = 'sprite'
    const units = ['Bowman', 'ImprovedBowman', 'CompositeBowman', 'ChariotArcher'].map(key => context.menu.getUnitButton(key))
    const technologies = ['ImprovedBow', 'ShortSword', 'BroadSword'].map(key => context.menu.getTechnologyButton(key))

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
          menu: owner.isPlayed ? [...units, ...technologies] : [],
        },
      },
      context
    )
  }
}
