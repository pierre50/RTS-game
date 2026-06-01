import { MENU_INFO_IDS } from '../constants'
import { getIconPath } from '../lib'
import { t } from '../lib/lang'

export class AnimalInterface {
  constructor(animal) {
    this.animal = animal
  }

  setDefaultInterface(element, data) {
    const animal = this.animal
    const {
      context: { menu },
    } = animal

    const civDiv = document.createElement('div')
    civDiv.id = MENU_INFO_IDS.civ
    civDiv.textContent = ''
    element.appendChild(civDiv)

    const typeDiv = document.createElement('div')
    typeDiv.id = MENU_INFO_IDS.type
    typeDiv.textContent = t(animal.type)
    element.appendChild(typeDiv)

    const iconImg = document.createElement('img')
    iconImg.id = MENU_INFO_IDS.icon
    iconImg.src = getIconPath(data.icon)
    element.appendChild(iconImg)

    const hitPointsDiv = document.createElement('div')
    hitPointsDiv.id = MENU_INFO_IDS.hitPoints
    hitPointsDiv.textContent = animal.hitPoints + '/' + animal.totalHitPoints
    element.appendChild(hitPointsDiv)

    const quantityDiv = document.createElement('div')
    quantityDiv.id = MENU_INFO_IDS.quantity
    quantityDiv.className = 'resource-quantity'
    const smallIconImg = document.createElement('img')
    smallIconImg.src = menu.icons['food']
    smallIconImg.className = 'resource-quantity-icon'
    const textDiv = document.createElement('div')
    textDiv.id = MENU_INFO_IDS.quantityText
    textDiv.textContent = animal.quantity
    quantityDiv.appendChild(smallIconImg)
    quantityDiv.appendChild(textDiv)
    element.appendChild(quantityDiv)
  }
}
