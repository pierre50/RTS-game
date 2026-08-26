import { RESOURCE_STOCKPILE_TYPES } from '../../constants'
import { appendBaseEntityInfo, appendQuantityInfo } from './BaseEntityInterface'
import { getEntityDisplayName } from '../utils/entityDisplayName'
import type { EntityInfoRenderOptions, ResourceEntity } from '../../types/entities'
import type { ResourceConfig } from '../../types/config'
import type { MenuLike } from '../../types/context'

export class ResourceInterface {
  resource: ResourceEntity

  constructor(resource: ResourceEntity) {
    this.resource = resource
  }

  setDefaultInterface(element: HTMLElement, _data: ResourceConfig, options?: EntityInfoRenderOptions): void {
    const resource = this.resource
    const menu = (resource.context as { menu: MenuLike }).menu

    appendBaseEntityInfo(
      element,
      '',
      getEntityDisplayName(resource),
      resource.hitPoints,
      resource.totalHitPoints ?? 0,
      {
        hideType: options?.hideIdentity,
      }
    )

    if (resource.quantity) {
      const stockpileType = RESOURCE_STOCKPILE_TYPES[resource.type as keyof typeof RESOURCE_STOCKPILE_TYPES]
      const iconToUse = stockpileType ? menu.infoIcons?.[stockpileType] : undefined
      appendQuantityInfo(element, iconToUse ?? menu.infoIcons?.['gold'] ?? '', resource.quantity)
    }
  }
}
