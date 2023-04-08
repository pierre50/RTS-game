import { Unit } from './unit'
import { Assets } from 'pixi.js'
import { accelerator } from '../../constants'

export class Scout extends Unit {
  constructor({ i, j, owner }, context) {
    const type = 'Scout'
    const data = Assets.cache.get('config').units[type]
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
        work: 'attacker',
        standingSheet: Assets.cache.get('445'),
        walkingSheet: Assets.cache.get('651'),
        actionSheet: Assets.cache.get('227'),
        dyingSheet: Assets.cache.get('343'),
        corpseSheet: Assets.cache.get('403'),
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

