import { PLAYER_TYPES } from '../../constants'
import { Animal } from '../animal'
import { Player } from './player'

export class Gaia extends Player {
  constructor(context) {
    super({ i: 0, j: 0, type: PLAYER_TYPES.gaia }, context)
  }
  createAnimal(options) {
    const { context } = this
    let unit = context.map.addChild(new Animal({ ...options, owner: this }, context))
    this.units.push(unit)
    return unit
  }
}
