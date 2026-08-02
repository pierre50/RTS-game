import { MENU_INFO_IDS, RESOURCE_TYPES } from '../constants'
import { getIconPath } from '../lib'
import { t } from '../lib/lang'
import { appendQuantityInfo, createHitPointsInfo, createInfoImage, createInfoText } from './BaseEntityInterface'
import type { ResourceEntity } from '../types/entities'
import type { ResourceConfig } from '../types/config'
import type { MenuLike } from '../types/context'

export class ResourceInterface {
  resource: ResourceEntity

  constructor(resource: ResourceEntity) {
    this.resource = resource
  }

  setDefaultInterface(element: HTMLElement, data: ResourceConfig): void {
    const resource = this.resource
    const menu = (resource.context as { menu: MenuLike }).menu

    element.appendChild(createInfoText(MENU_INFO_IDS.type, t(resource.type)))
    if (data.icon) {
      element.appendChild(createInfoImage(MENU_INFO_IDS.icon, getIconPath(data.icon)))
    }

    if (resource.hitPoints) {
      element.appendChild(
        createHitPointsInfo(MENU_INFO_IDS.hitPoints, resource.hitPoints, resource.totalHitPoints ?? 0)
      )
    }

    if (resource.quantity) {
      let iconToUse: string | undefined
      switch (resource.type) {
        case RESOURCE_TYPES.tree:
          iconToUse = menu.infoIcons?.['wood']
          break
        case RESOURCE_TYPES.berrybush:
          iconToUse = menu.infoIcons?.['food']
          break
        case RESOURCE_TYPES.stone:
          iconToUse = menu.infoIcons?.['stone']
          break
        case RESOURCE_TYPES.gold:
          iconToUse = menu.infoIcons?.['gold']
          break
      }

      if (resource.category === 'Fish') {
        iconToUse = menu.infoIcons?.['food']
      }

      appendQuantityInfo(element, iconToUse!, resource.quantity)
    }
  }
}
