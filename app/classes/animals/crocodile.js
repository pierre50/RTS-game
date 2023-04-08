import { Animal } from './animal'
import { Assets } from 'pixi.js'
import { accelerator } from '../../constants'

export class Crocodile extends Animal {
  constructor({ i, j, owner }, context) {
    const type = 'Crocodile'
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
        actionSheet: Assets.cache.get('217'),
        standingSheet: Assets.cache.get('433'),
        walkingSheet: Assets.cache.get('673'),
        dyingSheet: Assets.cache.get('330'),
        corpseSheet: Assets.cache.get('391'),
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
