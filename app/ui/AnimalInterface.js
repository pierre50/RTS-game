import { MENU_INFO_IDS } from '../constants'
import { getIconPath } from '../lib'
import { t } from '../lib/lang'
import { appendBaseEntityInfo } from './BaseEntityInterface'

export class AnimalInterface {
  constructor(animal) {
    this.animal = animal
  }

  setDefaultInterface(element, data) {
    const animal = this.animal
    const { context: { menu } } = animal

    appendBaseEntityInfo(element, '', t(animal.type), getIconPath(data.icon), animal.hitPoints, animal.totalHitPoints)

    const quantityDiv = document.createElement('div')
    quantityDiv.classList.add(MENU_INFO_IDS.quantity)
    quantityDiv.className = 'resource-quantity'
    const smallIconImg = document.createElement('img')
    smallIconImg.src = menu.icons['food']
    smallIconImg.className = 'resource-quantity-icon'
    const textDiv = document.createElement('div')
    textDiv.classList.add(MENU_INFO_IDS.quantityText)
    textDiv.textContent = animal.quantity
    quantityDiv.appendChild(smallIconImg)
    quantityDiv.appendChild(textDiv)
    element.appendChild(quantityDiv)
  }
}
