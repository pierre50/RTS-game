import { Cell } from './cell'
import { Assets, Sprite } from 'pixi.js'
import { randomRange, formatNumber } from '../../lib'
import { colorDesert } from '../../constants'

export class Desert extends Cell {
  constructor({ i, j, z }, context) {
    const randomSpritesheet = randomRange(0, 8)
    const resourceName = '15000'
    const spritesheet = Assets.cache.get(resourceName)
    const texture = spritesheet.textures[formatNumber(randomSpritesheet) + '_' + resourceName + '.png']
    const sprite = Sprite.from(texture)
    sprite.name = 'sprite'
    super(
      {
        i,
        j,
        z,
        sprite,
        solid: false,
        color: colorDesert,
        type: 'desert',
      },
      context
    )
  }
}
