import { PLAYER_TYPES } from '../../constants'
import { addEntityToMapSpaceContainer } from '../../lib'
import { Animal } from '../animal/Animal'
import type { AnimalOptions } from '../animal/Animal'
import { Player } from './Player'
import type { GameContextLike } from '../../types/context'
import type { AnimalEntity } from '../../types/entities'

export class Gaia extends Player {
  animals: AnimalEntity[]

  constructor(context: GameContextLike) {
    super({ i: 0, j: 0, type: PLAYER_TYPES.gaia }, context)
    this.animals = []
  }

  createAnimal(options: AnimalOptions) {
    const { context } = this
    const animal = new Animal({ ...options, owner: this }, context)
    addEntityToMapSpaceContainer(context.map, animal)
    this.animals.push(animal)
    if (!animal.isDead && !animal.isDestroyed) {
      this.population++
    }
    return animal
  }
}
