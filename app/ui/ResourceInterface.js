import { MENU_INFO_IDS, RESOURCE_TYPES } from '../constants'
import { getIconPath } from '../lib'
import { t } from '../lib/lang'

export class ResourceInterface {
  constructor(resource) {
    this.resource = resource
  }

  setDefaultInterface(element, data) {
    const resource = this.resource
    const {
      context: { menu },
    } = resource

    const typeDiv = document.createElement('div')
    typeDiv.classList.add(MENU_INFO_IDS.type)
    typeDiv.textContent = t(resource.type)
    element.appendChild(typeDiv)

    const iconImg = document.createElement('img')
    iconImg.classList.add(MENU_INFO_IDS.icon)
    iconImg.src = getIconPath(data.icon)
    element.appendChild(iconImg)

    if (resource.hitPoints) {
      const hitPointsDiv = document.createElement('div')
      hitPointsDiv.classList.add(MENU_INFO_IDS.hitPoints)
      hitPointsDiv.textContent = resource.hitPoints + '/' + resource.totalHitPoints
      element.appendChild(hitPointsDiv)
    }

    if (resource.quantity) {
      const quantityDiv = document.createElement('div')
      quantityDiv.classList.add(MENU_INFO_IDS.quantity)
      quantityDiv.className = 'resource-quantity'

      let iconToUse
      switch (resource.type) {
        case RESOURCE_TYPES.tree:
          iconToUse = menu.infoIcons['wood']
          break
        case RESOURCE_TYPES.salmon:
        case RESOURCE_TYPES.berrybush:
          iconToUse = menu.infoIcons['food']
          break
        case RESOURCE_TYPES.stone:
          iconToUse = menu.infoIcons['stone']
          break
        case RESOURCE_TYPES.gold:
          iconToUse = menu.infoIcons['gold']
          break
      }

      const smallIconImg = document.createElement('img')
      smallIconImg.src = iconToUse
      smallIconImg.className = 'resource-quantity-icon'
      const textDiv = document.createElement('div')
      textDiv.classList.add(MENU_INFO_IDS.quantityText)
      textDiv.textContent = resource.quantity
      quantityDiv.appendChild(smallIconImg)
      quantityDiv.appendChild(textDiv)
      element.appendChild(quantityDiv)
    }
  }
}
