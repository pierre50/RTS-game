import { Player } from './player'

export class Gaia extends Player {
  constructor(context) {
    super({ i: 0, j: 0, type: 'Gaia' }, context)
  }
}
