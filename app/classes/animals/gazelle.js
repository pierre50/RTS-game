import { Animal } from './animal'
import { Assets } from 'pixi.js'
import { accelerator } from '../../constants'

export class Gazelle extends Animal {
  constructor({ i, j, owner }, context) {
    const type = 'Gazelle'
    const data = Assets.cache.get('config').animals[type]
    super(
      {
        i,
        j,
        owner,
        type,
        ...data,
        speed: data.speed * accelerator,
        standingSheet: Assets.cache.get('479'),
        walkingSheet: Assets.cache.get('478'),
        runningSheet: Assets.cache.get('480'),
        dyingSheet: Assets.cache.get('331'),
        corpseSheet: Assets.cache.get('392'),
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
