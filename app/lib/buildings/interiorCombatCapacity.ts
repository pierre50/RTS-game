import { BUILDING_TYPES } from '../../constants/entities'
import { getEntitySpaceId } from '../mapSpaces'
import type { GameContextLike } from '../../types/context'
import type { BuildingEntity, UnitEntity } from '../../types/entities'

const DEFAULT_BUILDING_SHELTER_CAPACITY: Record<string, number> = {
  [BUILDING_TYPES.house]: 5,
}

function getInteriorOccupantCapacity(
  building: Pick<BuildingEntity, 'shelterCapacity' | 'type'> | null | undefined
): number {
  if (!building || building.type === BUILDING_TYPES.townCenter) return 0
  const configured = Number(building.shelterCapacity)
  if (Number.isFinite(configured) && configured > 0) return Math.floor(configured)
  return DEFAULT_BUILDING_SHELTER_CAPACITY[building.type] ?? 0
}

/** Rechecked at the door, so concurrent arrivals cannot overfill a building. */
export function hasInteriorCombatCapacity(
  context: GameContextLike,
  space: { id: string; building: BuildingEntity; walkableCells: unknown[] },
  unit: UnitEntity
): boolean {
  const capacity = getInteriorOccupantCapacity(space.building) || space.walkableCells.length
  const occupants = (context.players ?? [])
    .flatMap(player => player.units ?? [])
    .filter(
      other =>
        other !== unit &&
        !other.isDead &&
        !other.isDestroyed &&
        (other.hitPoints ?? 1) > 0 &&
        getEntitySpaceId(other) === space.id
    ).length
  return occupants < capacity
}
