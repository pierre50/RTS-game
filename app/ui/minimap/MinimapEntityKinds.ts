import { FAMILY_TYPES } from "../../constants"
import type { ResourceEntity,RuntimeEntity } from "../../types/entities"

export function isResourceEntity(instance: RuntimeEntity | null | undefined): instance is ResourceEntity {
  return instance?.family === FAMILY_TYPES.resource
}

export function isMinimapUnitMarker(instance: RuntimeEntity | null | undefined): boolean {
  return Boolean(instance && instance.family !== FAMILY_TYPES.animal)
}
