import { appendBaseEntityInfo, appendQuantityInfo } from './BaseEntityInterface'
import { getEntityDisplayName } from '../utils/entityDisplayName'
import type { AnimalEntity, EntityInfoRenderOptions } from '../../types/entities'
import type { AnimalConfig } from '../../types/config'
import type { MenuLike } from '../../types/context'

export class AnimalInterface {
  animal: AnimalEntity

  constructor(animal: AnimalEntity) {
    this.animal = animal
  }

  setDefaultInterface(element: HTMLElement, _data: AnimalConfig, options?: EntityInfoRenderOptions): void {
    const animal = this.animal
    const menu = (animal.context as { menu: MenuLike }).menu

    appendBaseEntityInfo(element, '', getEntityDisplayName(animal), animal.hitPoints, animal.totalHitPoints, {
      hideType: options?.hideIdentity,
    })

    appendQuantityInfo(element, menu.icons!['food'], animal.quantity!)
  }
}
