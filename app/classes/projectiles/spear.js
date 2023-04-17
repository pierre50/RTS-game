import { Projectile } from './projectile'
import { accelerator } from '../../constants'

export class Spear extends Projectile {
  constructor(props, context) {
    const { owner } = props
    const type = 'Spear'
    /*const ownerSprite = owner.getChildByName('sprite')
    const { height, width } = ownerSprite
    const anchoredWidth = width * ownerSprite.anchor.x
    const anchoredHeight = height * ownerSprite.anchor.y
    const direction = degreeToDirection(owner.degree)*/
    const position = {
      x: owner.x,
      y: owner.y,
    }
    super(
      {
        x: position.x,
        y: position.y,
        type,
        ...props,
        size: 10,
        speed: 8 * accelerator,
      },
      context
    )
  }
}
