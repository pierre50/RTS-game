import { PLAYER_TYPES } from '../../constants'
import { Animal } from '../animal'
import { Player } from './player'

type AnyRecord = Record<string, any>

export class Gaia extends Player {
  constructor(context: AnyRecord) {
    super({ i: 0, j: 0, type: PLAYER_TYPES.gaia }, context)
  }
  createAnimal(options: AnyRecord) {
    const { context } = this
    const animal = context.map.addChild(new Animal({ ...options, owner: this }, context))
    this.units.push(animal)
    if (!animal.isDead && !animal.isDestroyed) {
      this.population++
    }
    return animal
  }
}
