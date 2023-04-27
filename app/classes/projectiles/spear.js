import { Projectile } from './projectile'
import { accelerator } from '../../constants'

export class Spear extends Projectile {
  constructor(props, context) {
    const { owner } = props
    const type = 'Spear'
    const position = {
      x: owner.x,
      y: owner.y - owner.sprite.height / 2,
    }
    super(
      {
        x: position.x,
        y: position.y,
        type,
        ...props,
        size: 10,
        speed: 8,
      },
      context
    )
  }
}
