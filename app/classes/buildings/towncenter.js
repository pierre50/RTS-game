import { Building } from './building'
import { Assets, Sprite } from 'pixi.js'
import { getTexture, getBuildingTextureNameWithSize, getBuildingAsset } from '../../lib'

export class TownCenter extends Building {
  constructor({ i, j, owner, isBuilt = false }, context) {
    const type = 'TownCenter'
    const config = owner.config[type]

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

  onBuilt() {
    const {
      context: { menu },
    } = this
    // Increase player population and continue all unit creation that was paused
    this.owner.populationMax += 4
    // Update bottombar with populationmax if house selected
    if (this.selected && this.owner.isPlayed) {
      menu.updateInfo(
        'population',
        element => (element.textContent = this.owner.population + '/' + this.owner.populationMax)
      )
    }
  }
}
