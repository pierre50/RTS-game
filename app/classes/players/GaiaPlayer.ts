import { PLAYER_TYPES } from '../../constants'
import { addEntityToMapSpaceContainer } from '../../lib'
import { isNeutralPlayer } from '../../lib/playerState'
import { Animal } from '../animal/Animal'
import type { AnimalOptions } from '../animal/Animal'
import { Player } from './Player'
import type { PlayerOptions } from './Player'
import type { GameContextLike } from '../../types/context'
import type { AnimalEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'

export const NEUTRAL_PLAYER_LABEL = 'neutral'
export const NEUTRAL_PLAYER_NAME = 'Neutral'

export class Gaia extends Player {
  animals: AnimalEntity[]

  constructor(context: GameContextLike, options: PlayerOptions = {}) {
    super({ i: 0, j: 0, type: PLAYER_TYPES.gaia, ...options }, context)
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

export function ensureNeutralPlayer(
  context: GameContextLike,
  position: { i: number; j: number } = { i: 0, j: 0 }
): PlayerLike {
  const existing = context.players.find(isNeutralPlayer)
  if (existing) return existing

  const owner = new Gaia(context, {
    i: position.i,
    j: position.j,
    label: NEUTRAL_PLAYER_LABEL,
    name: NEUTRAL_PLAYER_NAME,
    civ: 'Hellas',
    color: 'grey',
    diplomacy: 'neutral',
    isPlayed: false,
    team: null,
  })
  context.players.push(owner)
  return owner
}
