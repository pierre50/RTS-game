import { Animal } from '../animal'
import { Player } from './player'

export class Gaia extends Player {
  constructor(context) {
    super({ i: 0, j: 0, type: 'Gaia' }, context)
  }
  createAnimal(options) {
    const { context } = this
    let unit = new Animal({ ...options, owner: this }, context)
    this.units.push(unit)
    return unit
  }
}
