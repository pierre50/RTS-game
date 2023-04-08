import { Cell } from './cell'
import { Assets, Sprite } from 'pixi.js'
import { randomRange, formatNumber } from '../../lib'
import { colorWater } from '../../constants'

export class Water extends Cell {
  constructor({ i, j, z }, context) {
    const randomSpritesheet = randomRange(0, 3)
    const resourceName = '15002'
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
        solid: true,
        color: colorWater,
        type: 'water',
      },
      context
    )
  }
}
