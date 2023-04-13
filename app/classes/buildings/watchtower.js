import { Building } from './building'
import { Assets, Sprite } from 'pixi.js'
import * as projectiles from '../projectiles/'
import {
  getTexture,
  timeoutRecurs,
  getBuildingTextureNameWithSize,
  getBuildingAsset,
  instancesDistance,
  getActionCondition,
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

  attackAction(target) {
    const {
      context: { map },
    } = this

    timeoutRecurs(
      this.rateOfFire,
      () => getActionCondition(this, target, 'attack') && instancesDistance(this, target) <= this.range,
      () => {
        const projectile = new projectiles.Arrow(
          {
            owner: this,
            target,
          },
          this.context
        )
        map.addChild(projectile)
        if (target.life <= 0) {
          target.die()
        }
      }
    )
  }
}
