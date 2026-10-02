import { isAiChiefResting } from './chiefAvailability'
import { isLivingChief } from '../chief'
import { getBuildingInteriorSpaceForUnit } from '../../../engine/services/BuildingInteriorSpaceLookup'
import type { GameContextLike } from '../../types/context'
import type { BuildingEntity, UnitEntity } from '../../types/entities'

export function getChiefEscorts(chief: UnitEntity): UnitEntity[] {
  if (!isLivingChief(chief) || chief.owner?.type !== 'AI' || chief.owner?.isPlayed || chief.controlMode === 'hero')
    return []
  return (chief.owner?.units ?? [])
    .filter(
      unit =>
        unit.type === 'Fantassin' &&
        !unit.isDead &&
        !unit.isDestroyed &&
        unit.controlMode !== 'hero' &&
        !unit.followingHero &&
        !unit.trainingTargetType
    )
    .slice(0, 2)
}

export function isChiefEscort(unit: UnitEntity): boolean {
  const chief = unit.owner?.units?.find(isLivingChief)
  return Boolean(chief && getChiefEscorts(chief).includes(unit))
}

/** A friendly visit is local to the leader's own town center, never another interior. */
export function getChiefAudienceBuilding(chief: UnitEntity, context: GameContextLike): BuildingEntity | null {
  if (isAiChiefResting(chief, context)) return null
  const hero = context.controls?.heroUnit
  if (!hero || hero.isDead || hero.isDestroyed || !hero.owner || chief.owner?.type !== 'AI' || chief.owner.isPlayed)
    return null
  if (chief.owner.isEnemy?.(hero.owner) || hero.owner.isEnemy?.(chief.owner)) return null
  const building = getBuildingInteriorSpaceForUnit(hero)?.building
  return building?.type === 'TownCenter' &&
    building.owner === chief.owner &&
    building.isBuilt &&
    !building.isDead &&
    !building.isDestroyed
    ? building
    : null
}

/** Escorts rest at their post only while their leader is settled and no visit is active. */
export function canChiefEscortRest(unit: UnitEntity): boolean {
  if (!isChiefEscort(unit)) return true
  const chief = unit.owner?.units?.find(isLivingChief)
  const rest = chief?.shelterState
  if (
    !chief ||
    !rest ||
    !['inside', 'outside'].includes(rest.status) ||
    chief.action === 'attack' ||
    chief.combatMode ||
    chief.spacePortalState ||
    (chief.context && getChiefAudienceBuilding(chief, chief.context))
  )
    return false
  const anchor = rest.shelter ?? chief
  return (
    (unit.spaceId ?? 'outside') === (anchor.spaceId ?? 'outside') &&
    Math.hypot(unit.i - anchor.i, unit.j - anchor.j) <= (anchor === chief ? 2 : (anchor.size ?? 2) + 1)
  )
}
