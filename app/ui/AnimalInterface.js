import { MENU_INFO_IDS } from '../constants'
import { getIconPath } from '../lib'
import { t } from '../lib/lang'
import { appendBaseEntityInfo, appendQuantityInfo } from './BaseEntityInterface'

export class AnimalInterface {
  constructor(animal) {
    this.animal = animal
  }

  setDefaultInterface(element, data) {
    const animal = this.animal
    const {
      context: { menu },
    } = animal

    appendBaseEntityInfo(element, '', t(animal.type), getIconPath(data.icon), animal.hitPoints, animal.totalHitPoints)

    appendQuantityInfo(element, menu.icons['food'], animal.quantity)
  }
}
