import { Building } from './building'
import { Assets, Sprite, AnimatedSprite, Polygon } from 'pixi.js'
import { accelerator } from '../../constants'
import { getTexture, getBuildingTextureNameWithSize, getBuildingAsset } from '../../lib'

export class House extends Building {
  constructor({ i, j, owner, isBuilt = false }, context) {
    const type = 'House'
    const config = owner.config[type]

    // Define sprite
    const sheet = owner.age === 0 ? '000_489' : getBuildingTextureNameWithSize(config.size)
    const texture = getTexture(sheet, Assets)
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

            if (this.owner.isPlayed && this.isBuilt) {
              const populationDiv = document.createElement('div')
              populationDiv.id = 'population'
              populationDiv.textContent = this.owner.population + '/' + this.owner.populationMax
              element.appendChild(populationDiv)
            }
          },
        },
      },
      context
    )
  }

  afterFinalTextures() {
    if (this.owner.age === 0) {
      const spritesheetFire = Assets.cache.get('347')
      const spriteFire = new AnimatedSprite(spritesheetFire.animations['fire'])
      spriteFire.name = 'deco'
      spriteFire.allowMove = false
      spriteFire.allowClick = false
      spriteFire.interactive = false
      spriteFire.roundPixels = true
      spriteFire.x = 10
      spriteFire.y = 5
      spriteFire.play()
      spriteFire.animationSpeed = 0.2 * accelerator
      this.addChild(spriteFire)
    } else {
      const fire = this.getChildByName('deco')
      if (fire) {
        fire.destroy()
      }
    }
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
