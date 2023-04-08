import { Animal } from './animal'
import { Assets } from 'pixi.js'
import { accelerator } from '../../constants'

export class Elephant extends Animal {
  constructor({ i, j, owner }, context) {
    const type = 'Elephant'
    const data = Assets.cache.get('config').animals[type]
    super(
      {
        i,
        j,
        owner,
        type,
        lifeMax: data.lifeMax,
        sight: data.sight,
        speed: data.speed * accelerator,
        attack: data.attack,
        quantity: data.quantity,
        actionSheet: Assets.cache.get('215'),
        standingSheet: Assets.cache.get('428'),
        walkingSheet: Assets.cache.get('667'),
        dyingSheet: Assets.cache.get('331'),
        corpseSheet: Assets.cache.get('386'),
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
