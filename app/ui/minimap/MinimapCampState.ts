import { isUnitAbleToHoldPlayerBuildings } from '../../lib/playerState'
import { getEntitySpaceId } from '../../lib/mapSpaces'
import type { BuildingEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'

/** Membership follows the saved home anchor, even while guards chase or enter a cave. */
export function hasActiveCampGuards(owner: PlayerLike, fire: BuildingEntity): boolean {
  return owner.units.some(unit => {
    if (!isUnitAbleToHoldPlayerBuildings(unit)) return false
    const anchor = unit.campPatrolAnchor ?? unit.banditCampAnchor
    return Boolean(
      anchor &&
        anchor.i === fire.i &&
        anchor.j === fire.j &&
        (unit.campBehavior?.homeSpaceId ?? 'outside') === getEntitySpaceId(fire)
    )
  })
}
