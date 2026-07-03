import { MENU_INFO_IDS } from '../constants'
import { getIconPath } from '../lib'
import { t } from '../lib/lang'
import { appendBaseEntityInfo, appendQuantityInfo } from './BaseEntityInterface'

type AnyRecord = Record<string, any>

export class AnimalInterface {
  animal: AnyRecord

  constructor(animal: AnyRecord) {
    this.animal = animal
  }

  setDefaultInterface(element: HTMLElement, data: AnyRecord): void {
    const animal = this.animal
    const {
      context: { menu },
    } = animal

    appendBaseEntityInfo(element, '', t(animal.type), getIconPath(data.icon), animal.hitPoints, animal.totalHitPoints)

    appendQuantityInfo(element, menu.icons['food'], animal.quantity)
  }
}
