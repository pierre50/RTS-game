import { Animal } from './animal'
import { Assets } from 'pixi.js'
import { accelerator } from '../../constants'

export class Lion extends Animal {
  constructor({ i, j, owner }, context) {
    const type = 'Lion'
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
        actionSheet: Assets.cache.get('222'),
        standingSheet: Assets.cache.get('497'),
        walkingSheet: Assets.cache.get('680'),
        dyingSheet: Assets.cache.get('331'),
        corpseSheet: Assets.cache.get('397'),
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
