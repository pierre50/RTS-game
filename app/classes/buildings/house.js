import { Building } from './building'
import { Assets, Sprite, AnimatedSprite, Polygon } from 'pixi.js'
import { accelerator } from '../../constants'
import { getTexture, changeSpriteColor, getBuildingTextureNameWithSize } from '../../lib'

export class House extends Building {
  constructor({ i, j, owner, isBuilt = false }, context) {
    const type = 'House'
    const config = Assets.cache.get('config').buildings[type]

    // Define sprite
    const texture = getTexture(getBuildingTextureNameWithSize(config.size), Assets)
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
        interface: {
          info: element => {
            const assets = Assets.cache.get(this.owner.civ.toLowerCase()).buildings[this.owner.age][this.type]
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

  finalTexture() {
    const assets = Assets.cache.get(this.owner.civ.toLowerCase()).buildings[this.owner.age][this.type]

    const sprite = this.getChildByName('sprite')
    sprite.texture = getTexture(assets.images.final, Assets)
    sprite.anchor.set(sprite.texture.defaultAnchor.x, sprite.texture.defaultAnchor.y)

    const spriteColor = Sprite.from(getTexture(assets.images.color, Assets))
    spriteColor.name = 'color'
    changeSpriteColor(spriteColor, this.owner.color)
    this.addChildAt(spriteColor, 0)

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
