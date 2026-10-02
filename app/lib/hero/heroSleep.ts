import { isBedOccupied } from '../../services/rest/BedOccupancy'
import { placeUnitAtCell, stopUnitForRest } from '../../services/rest/UnitRestState'
import { getEntitySpaceGrid, getEntitySpaceMapLike, sameMapSpace } from '../mapSpaces'
import { getBedRestPoint } from '../terrain/furnitureSurface'
import { syncEntityRelief } from '../terrain/reliefSurface'
import { VILLAGE_WAKE_COMPLETE_HOUR } from '../units/villagerSchedule'
import { ACTION_TYPES, BUILDING_TYPES, FAMILY_TYPES } from '../../constants'
import { getHoursUntilNextMorning } from '../../services/TimeSkipSystem'
import { playSleepingOutsideVisual, playSleepingWakeVisual } from '../../services/rest/UnitSleepVisuals'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import { clearUnitOverheadIndicator, setUnitOverheadIndicator } from '../entities/overheadIndicator'
import { findInstancesInSight } from '../grid/visibility'
import { t } from '../lang'
import { isHeroInteractionTargetReachable } from './heroActionRange'

function isHostileToHero(hero: UnitEntity, target: RuntimeEntity): boolean {
  if (target === hero || target.isDead || target.isDestroyed) return false
  const heroOwner = hero.owner
  const targetOwner = target.owner
  if (!heroOwner || !targetOwner || targetOwner === heroOwner) return false
  // Wildlife shares an owner, but fleeing prey is not a threat to a sleeping hero.
  if (target.family === FAMILY_TYPES.animal) {
    return (
      ('strategy' in target && target.strategy === 'attack') ||
      ('action' in target && target.action === ACTION_TYPES.attack)
    )
  }
  return Boolean(heroOwner.isEnemy?.(targetOwner) || targetOwner.isEnemy?.(heroOwner))
}

export function hasHostileInHeroSight(hero: UnitEntity): boolean {
  return Boolean(getHostileInHeroSight(hero))
}

export function getHostileInHeroSight(hero: UnitEntity): RuntimeEntity | undefined {
  return findInstancesInSight(hero, target => isHostileToHero(hero, target as RuntimeEntity))[0] as
    | RuntimeEntity
    | undefined
}

export function isUsableSleepTarget(
  hero: UnitEntity,
  building: BuildingEntity | null | undefined
): building is BuildingEntity {
  return Boolean(
    building &&
      (building.type === BUILDING_TYPES.fireCamp || building.type === BUILDING_TYPES.campBedroll) &&
      sameMapSpace(hero, building) &&
      building.isBuilt &&
      !building.isDead &&
      !building.isDestroyed &&
      isHeroInteractionTargetReachable(hero, null, building)
  )
}

export function canHeroSleepAtTarget(hero: UnitEntity | null | undefined, building: BuildingEntity): boolean {
  return getHeroSleepBlockedReason(hero, building) === null
}

export function getHeroSleepBlockedReason(hero: UnitEntity | null | undefined, building: BuildingEntity) {
  if (!hero || hero.isDead || hero.isDestroyed || hero.actionLocked) return 'heroSleepUnavailable'
  const bed = building.type === BUILDING_TYPES.campBedroll
  if ((!bed && building.type !== BUILDING_TYPES.fireCamp) || building.isDead || building.isDestroyed)
    return bed ? 'heroBedSleepUnavailable' : 'heroCampfireSleepUnavailable'
  if (!building.isBuilt) return bed ? 'heroBedSleepNotBuilt' : 'heroCampfireSleepNotBuilt'
  if (!sameMapSpace(hero, building) || !isHeroInteractionTargetReachable(hero, null, building))
    return bed ? 'heroBedSleepTooFar' : 'heroCampfireSleepTooFar'
  if (bed && isBedOccupied(hero, building)) return 'heroBedSleepOccupied'
  if (bed && (building.buildingUpgrade || !getEntitySpaceGrid(building, hero.context?.map)?.[building.i]?.[building.j]))
    return 'heroBedSleepUnavailable'
  if (hasHostileInHeroSight(hero)) return 'heroCampfireSleepBlockedDescription'
  return null
}

function wakeHero(hero: UnitEntity): void {
  clearUnitOverheadIndicator(hero)
  playSleepingWakeVisual(hero, () => {
    hero.heroSleepTarget = null
    hero.actionLocked = false
  })
}

export function sleepHeroAtTarget(hero: UnitEntity | null | undefined, building: BuildingEntity): boolean {
  if (!hero || hero.actionLocked || !canHeroSleepAtTarget(hero, building)) return false
  const context = hero.context

  if (building.type === BUILDING_TYPES.campBedroll) {
    const cell = getEntitySpaceGrid(building, context?.map)?.[building.i]?.[building.j]
    if (!cell) return false
    hero.heroSleepTarget = building
    stopUnitForRest(hero)
    hero.dest = null
    hero.action = null
    placeUnitAtCell(hero, cell)
    Object.assign(hero, getBedRestPoint(building))
    syncEntityRelief(getEntitySpaceMapLike(hero, context?.map), hero)
  }
  hero.actionLocked = true
  setUnitOverheadIndicator(hero, 'sleep')
  playSleepingOutsideVisual(hero, () => {
    const dayNightState = context?.dayNight?.state
    const hours = getHoursUntilNextMorning(
      dayNightState?.hour ?? 7,
      dayNightState?.minute ?? 0,
      VILLAGE_WAKE_COMPLETE_HOUR
    )
    const result = context?.timeSkip?.start?.(hours, {
      mode: 'sleep',
      fadeToBlack: true,
      completedMessage: t('heroSleepComplete'),
      onCancel: () => wakeHero(hero),
      onComplete: () => {
        context.unitRest?.synchronizeAfterTimeJump?.()
        context.autosave?.()
        wakeHero(hero)
      },
    })
    if (!result?.ok) {
      context?.menu?.showMessage?.(result?.message ?? t('heroSleepUnavailable'), 'warning')
      wakeHero(hero)
    }
  })
  return true
}
