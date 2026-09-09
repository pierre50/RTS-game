import { getBuildingInteriorPortalId } from '../../app/lib/buildings/interiors'
import { getEntityMapSpace, getMapSpace } from '../../app/lib/mapSpaces'
import type { GameContextLike } from '../../app/types/context'
import type { BuildingEntity, UnitEntity } from '../../app/types/entities'
import type { RuntimeMapSpace } from '../../app/types/map'
import type { BuildingInteriorRuntimeSpace } from './BuildingInteriorSpaceTypes'

export function getBuildingInteriorSpaceId(building: BuildingEntity): string {
  return `interior:${getBuildingInteriorPortalId(building)}`
}

export function isBuildingInteriorRuntimeSpace(
  space: RuntimeMapSpace | null | undefined
): space is BuildingInteriorRuntimeSpace {
  return Boolean(space && space.kind === 'interior' && 'renderer' in space)
}

export function getBuildingInteriorSpaceForBuilding(
  context: GameContextLike,
  building: BuildingEntity
): BuildingInteriorRuntimeSpace | null {
  const space = getMapSpace(context.map, getBuildingInteriorSpaceId(building))
  return isBuildingInteriorRuntimeSpace(space) ? space : null
}

export function getBuildingInteriorSpaceForUnit(unit: UnitEntity): BuildingInteriorRuntimeSpace | null {
  const space = getEntityMapSpace(unit)
  return isBuildingInteriorRuntimeSpace(space) ? space : null
}
