import { RESOURCE_TYPES } from '../../constants'
import { NATURAL_RESOURCE_REGROWTH_BY_TYPE } from '../../config/gameplay'
import { definedProperties } from '../../lib/definedProperties'
import type { Resource } from '../Resource'

export function registerResourceRespawnSlot(resource: Resource): void {
  if (resource.type === RESOURCE_TYPES.wheat) return
  if (!resource.isNaturalResource) return
  if (!Object.hasOwn(NATURAL_RESOURCE_REGROWTH_BY_TYPE, resource.type)) return
  const slots =
    resource.context.map.naturalResourceRespawnSlots ?? (resource.context.map.naturalResourceRespawnSlots = [])
  slots.push(
    definedProperties({
      depletedDay: resource.context.dayNight?.state?.day ?? 1,
      i: resource.i,
      isDestroyed: true,
      isNaturalResource: true,
      j: resource.j,
      label: resource.label,
      textureName: resource.type === RESOURCE_TYPES.berrybush ? resource.textureName : undefined,
      totalQuantity: resource.totalQuantity,
      type: resource.type,
    })
  )
}
