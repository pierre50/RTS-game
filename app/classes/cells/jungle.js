import { Cell } from './cell'
import { Assets, Sprite } from 'pixi.js'
import { randomRange, formatNumber } from '../../lib'
import { colorGrass } from '../../constants'

export class Jungle extends Cell {
  constructor({ i, j, z }, context) {
    const randomSpritesheet = randomRange(0, 8)
    const resourceName = '15001'
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
        color: colorGrass,
        solid: false,
        type: 'jungle',
      },
      context
    )
  }
}
