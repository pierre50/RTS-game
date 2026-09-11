import { getBuildingShelterCapacity } from './buildingOccupancy'
import { getEntitySpaceId } from '../mapSpaces'
import type { GameContextLike } from '../../types/context'
import type { BuildingEntity, UnitEntity } from '../../types/entities'

/** Rechecked at the door, so concurrent arrivals cannot overfill a building. */
export function hasInteriorCombatCapacity(
  context: GameContextLike,
  space: { id: string; building: BuildingEntity; walkableCells: unknown[] },
  unit: UnitEntity
): boolean {
  const capacity = getBuildingShelterCapacity(space.building) || space.walkableCells.length
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
