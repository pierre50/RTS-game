import { Projectile } from './projectile'
import { accelerator } from '../../constants'

export class Arrow extends Projectile {
  constructor(props, context) {
    const { owner } = props
    const type = 'Arrow'
    super(
      {
        x: owner.x,
        y: owner.y - owner.sprite.height / 2,
        type,
        ...props,
        size: 3,
        speed: 14,
      },
      context
    )
  }
}
