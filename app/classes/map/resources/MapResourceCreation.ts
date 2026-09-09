import { definedProperties } from '../../../lib/definedProperties'
import type { ResourceEntity } from '../../../types/entities'
import { Resource } from '../../Resource'
import type { MapResourcesMap, ResourcePlacementOptions, ResourceType } from './MapResources'
export function createResource(
  map: MapResourcesMap,
  i: number,
  j: number,
  type: ResourceType,
  options: ResourcePlacementOptions = {}
): ResourceEntity {
  return map.addChild(
    new Resource(
      definedProperties({
        i,
        j,
        type,
        isNaturalResource: options.isNaturalResource ?? true,
        textureName: options.textureName,
        quantity: options.quantity,
        totalQuantity: options.totalQuantity,
        startsMature: options.startsMature,
      }),
      map.context as ConstructorParameters<typeof Resource>[1]
    )
  )
}
