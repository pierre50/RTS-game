import { PLAYER_TYPES } from '../../constants'
import { Animal } from '../animal'
import type { AnimalOptions } from '../animal'
import { Player } from './player'
import type { GameContextLike } from '../../types/context'
import type { UnitEntity } from '../../types/entities'

export class Gaia extends Player {
  constructor(context: GameContextLike) {
    super({ i: 0, j: 0, type: PLAYER_TYPES.gaia }, context)
  }
  createAnimal(options: AnimalOptions) {
    const { context } = this
    const animal = context.map.addChild(new Animal({ ...options, owner: this }, context))
    // Gaia reuses the generic `units` collection to track wildlife; other code (e.g. save/load
    // restoration) duck-types entries from it as UnitEntity since Animal shares most of its shape.
    this.units.push(animal as unknown as UnitEntity)
    if (!animal.isDead && !animal.isDestroyed) {
      this.population++
    }
    return animal
  }
}
