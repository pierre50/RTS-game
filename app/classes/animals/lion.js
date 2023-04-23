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
        ...data,
        speed: data.speed * accelerator,
        actionSheet: Assets.cache.get('222'),
        standingSheet: Assets.cache.get('497'),
        walkingSheet: Assets.cache.get('680'),
        dyingSheet: Assets.cache.get('336'),
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

  detect(instance) {
    if (instance.name === 'unit' && !this.isDead && !this.path.length && !this.dest) {
      this.sendTo(instance, 'attack')
    }
  }
}
