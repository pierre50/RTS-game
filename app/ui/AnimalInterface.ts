import { t } from '../lib/lang'
import { appendBaseEntityInfo, appendQuantityInfo } from './BaseEntityInterface'
import type { AnimalEntity } from '../types/entities'
import type { AnimalConfig } from '../types/config'
import type { MenuLike } from '../types/context'

export class AnimalInterface {
  animal: AnimalEntity

  constructor(animal: AnimalEntity) {
    this.animal = animal
  }

  setDefaultInterface(element: HTMLElement, _data: AnimalConfig): void {
    const animal = this.animal
    const menu = (animal.context as { menu: MenuLike }).menu

    appendBaseEntityInfo(element, '', t(animal.type), animal.hitPoints, animal.totalHitPoints)

    appendQuantityInfo(element, menu.icons!['food'], animal.quantity!)
  }
}
