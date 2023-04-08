import { Unit } from './unit'
import { Assets } from 'pixi.js'
import { accelerator } from '../../constants'

export class Clubman extends Unit {
  constructor({ i, j, owner }, context) {
    const type = 'Clubman'
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
        standingSheet: Assets.cache.get('425'),
        walkingSheet: Assets.cache.get('664'),
        actionSheet: Assets.cache.get('212'),
        dyingSheet: Assets.cache.get('321'),
        corpseSheet: Assets.cache.get('380'),
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
