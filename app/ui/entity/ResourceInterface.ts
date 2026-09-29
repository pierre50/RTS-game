import { getEntityDescription } from './EntityDescription'
import { RESOURCE_TYPES } from '../../constants'
import { appendBaseEntityInfo } from './BaseEntityInterface'
import { getEntityDisplayName } from '../utils/entityDisplayName'
import type { EntityInfoRenderOptions, ResourceEntity } from '../../types/entities'
import type { ResourceConfig } from '../../types/config'

export class ResourceInterface {
  resource: ResourceEntity

  constructor(resource: ResourceEntity) {
    this.resource = resource
  }

  setDefaultInterface(element: HTMLElement, _data: ResourceConfig, options?: EntityInfoRenderOptions): void {
    const resource = this.resource
    const standingTree =
      resource.type === RESOURCE_TYPES.tree && !resource.isCutOrFallenTree?.() && (resource.hitPoints ?? 0) > 0
    const emptyBush = resource.type === RESOURCE_TYPES.berrybush && (resource.quantity ?? 0) <= 0
    const showResistance = standingTree || emptyBush
    const current = showResistance ? (resource.hitPoints ?? 0) : (resource.quantity ?? 0)
    const total = showResistance ? (resource.totalHitPoints ?? 0) : (resource.totalQuantity ?? current)

    appendBaseEntityInfo(element, '', getEntityDisplayName(resource), current, total, {
      hideType: options?.hideIdentity,
      description: getEntityDescription(resource),
    })
  }
}
