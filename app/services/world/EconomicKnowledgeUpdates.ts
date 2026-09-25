import { updateVillageResource } from './VillageResourceKnowledge'
import type { ResourceEntity } from '../../types/entities'

export function invalidateEconomicKnowledge(map: object, resource: ResourceEntity): void {
  updateVillageResource(map, resource)
}
