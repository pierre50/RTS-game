import { Unit } from './unit'
import { Assets } from 'pixi.js'

export class Military extends Unit {
  constructor({ i, j, type, owner }, context) {
    const data = owner.config[type]
    super(
      {
        i,
        j,
        owner,
        type,
        ...data,
        work: type === 'Priest' ? 'healer' : 'attacker',
        interface: {
          info: element => {
            const data = owner.config[this.type]
            this.setDefaultInterface(element, data)
          },
        },
      },
      context
    )
  }
}
