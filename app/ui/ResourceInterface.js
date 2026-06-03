import { MENU_INFO_IDS, RESOURCE_TYPES } from '../constants'
import { getIconPath } from '../lib'
import { t } from '../lib/lang'
import { appendQuantityInfo, createInfoImage, createInfoText } from './BaseEntityInterface'

export class ResourceInterface {
  constructor(resource) {
    this.resource = resource
  }

  setDefaultInterface(element, data) {
    const resource = this.resource
    const {
      context: { menu },
    } = resource

    element.appendChild(createInfoText(MENU_INFO_IDS.type, t(resource.type)))
    element.appendChild(createInfoImage(MENU_INFO_IDS.icon, getIconPath(data.icon)))

    if (resource.hitPoints) {
      element.appendChild(createInfoText(MENU_INFO_IDS.hitPoints, resource.hitPoints + '/' + resource.totalHitPoints))
    }

    if (resource.quantity) {
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

      appendQuantityInfo(element, iconToUse, resource.quantity)
    }
  }
}
