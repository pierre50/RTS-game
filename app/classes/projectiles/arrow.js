import { Projectile } from './projectile'

import { degreeToDirection } from '../../lib'
import { accelerator } from '../../constants'

export class Arrow extends Projectile {
  constructor({ owner, target }, context) {
    const type = 'Arrow'
    const ownerSprite = owner.getChildByName('sprite')
    const { height, width } = ownerSprite
    const anchoredWidth = width * ownerSprite.anchor.x
    const anchoredHeight = height * ownerSprite.anchor.y
    const direction = degreeToDirection(owner.degree)
    const position = {
      x: owner.x,
      y: owner.y,
    }
    switch (direction) {
      case 'north':
        position.y = owner.y - anchoredHeight
        break
      case 'west':
        position.y = owner.y - anchoredHeight
        position.x = owner.x - anchoredWidth
        break
      case 'northwest':
        position.y = owner.y - anchoredHeight
        position.x = owner.x - anchoredWidth
        break
      case 'southwest':
        position.y = owner.y - anchoredHeight
        position.x = owner.x - anchoredWidth
        break
      case 'est':
        position.y = owner.y - anchoredHeight
        position.x = owner.x + anchoredWidth * 2
        break
      case 'northest':
        position.y = owner.y - anchoredHeight
        position.x = owner.x + anchoredWidth
        break
      case 'southest':
        position.y = owner.y - anchoredHeight
        position.x = owner.x + anchoredWidth
        break
    }
    super(
      {
        x: position.x,
        y: position.y,
        type,
        target,
        owner,
        size: 3,
        speed: 14 * accelerator,
      },
      context
    )
  }
}
