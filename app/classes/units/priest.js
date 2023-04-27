import { Unit } from './unit'
import { Assets } from 'pixi.js'

export class Priest extends Unit {
  constructor({ i, j, owner }, context) {
    const type = 'Priest'
    const data = Assets.cache.get('config').units[type]
    super(
      {
        i,
        j,
        owner,
        type,
        ...data,
        work: 'healer',
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

