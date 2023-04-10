import { Building } from './building'
import { Assets, Sprite, Polygon } from 'pixi.js'
import * as projectiles from '../projectiles/'
import { getTexture, changeSpriteColor, timeoutRecurs, getBuildingTextureNameWithSize, getBuildingAsset } from '../../lib'

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

    const conditions = {
      attack: instance =>
        this.life > 0 &&
        !this.isDead &&
        instance &&
        instance.owner !== this.owner &&
        (instance.name === 'building' || instance.name === 'unit' || instance.name === 'animal') &&
        instance.life > 0 &&
        !instance.isDead,
    }

    timeoutRecurs(
      this.rateOfFire,
      () => conditions.attack(target),
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

  finalTexture() {
    const assets = getBuildingAsset(this.type, this.owner, Assets)

    const sprite = this.getChildByName('sprite')
    sprite.texture = getTexture(assets.images.final, Assets)
    sprite.anchor.set(sprite.texture.defaultAnchor.x, sprite.texture.defaultAnchor.y)

    const spriteColor = Sprite.from(getTexture(assets.images.color, Assets))
    spriteColor.name = 'color'
    changeSpriteColor(spriteColor, this.owner.color)
    this.addChild(spriteColor)
  }
}
