import { Unit } from './unit'
import { Assets } from 'pixi.js'
import { accelerator } from '../../constants'

export class Bowman extends Unit {
  constructor({ i, j, owner }, context) {
    const type = 'Bowman'
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
        range: data.range,
        work: 'attacker',
        projectile: 'Arrow',
        standingSheet: Assets.cache.get('413'),
        walkingSheet: Assets.cache.get('652'),
        actionSheet: Assets.cache.get('203'),
        dyingSheet: Assets.cache.get('308'),
        corpseSheet: Assets.cache.get('367'),
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
