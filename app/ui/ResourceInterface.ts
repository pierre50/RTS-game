import { RESOURCE_TYPES } from '../constants'
import { t } from '../lib/lang'
import { appendBaseEntityInfo, appendQuantityInfo } from './BaseEntityInterface'
import type { EntityInfoRenderOptions, ResourceEntity } from '../types/entities'
import type { ResourceConfig } from '../types/config'
import type { MenuLike } from '../types/context'

export class ResourceInterface {
  resource: ResourceEntity

  constructor(resource: ResourceEntity) {
    this.resource = resource
  }

  setDefaultInterface(element: HTMLElement, _data: ResourceConfig, options?: EntityInfoRenderOptions): void {
    const resource = this.resource
    const menu = (resource.context as { menu: MenuLike }).menu

    appendBaseEntityInfo(element, '', t(resource.type), resource.hitPoints, resource.totalHitPoints ?? 0, {
      hideType: options?.hideIdentity,
    })

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

      appendQuantityInfo(element, iconToUse!, resource.quantity)
    }
  }
}
