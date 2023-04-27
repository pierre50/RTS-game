import { Unit } from './unit'
import { Assets } from 'pixi.js'

export class Clubman extends Unit {
  constructor({ i, j, owner }, context) {
    const type = 'Clubman'
    const data = Assets.cache.get('config').units[type]
    super(
      {
        i,
        j,
        owner,
        type,
        ...data,
        work: 'attacker',
        interface: {
          info: element => {
            this.setDefaultInterface(element, data)
          },
        },
      },
      context
    )
  }
}
