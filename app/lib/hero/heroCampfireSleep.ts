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

export function isUsableFireCamp(
  hero: UnitEntity,
  building: BuildingEntity | null | undefined
): building is BuildingEntity {
  return Boolean(
    building &&
      building.type === BUILDING_TYPES.fireCamp &&
      building.isBuilt &&
      !building.isDead &&
      !building.isDestroyed &&
      isHeroInteractionTargetReachable(hero, null, building)
  )
}

export function canHeroSleepAtFireCamp(hero: UnitEntity | null | undefined, building: BuildingEntity): boolean {
  return getHeroCampfireSleepBlockedReason(hero, building) === null
}

export function getHeroCampfireSleepBlockedReason(hero: UnitEntity | null | undefined, building: BuildingEntity) {
  if (!hero || hero.isDead || hero.isDestroyed || hero.actionLocked) return 'heroSleepUnavailable'
  if (building.type !== BUILDING_TYPES.fireCamp || building.isDead || building.isDestroyed)
    return 'heroCampfireSleepUnavailable'
  if (!building.isBuilt) return 'heroCampfireSleepNotBuilt'
  if (!isHeroInteractionTargetReachable(hero, null, building)) return 'heroCampfireSleepTooFar'
  if (hasHostileInHeroSight(hero)) return 'heroCampfireSleepBlockedDescription'
  return null
}

function wakeHeroFromFireCamp(hero: UnitEntity): void {
  clearUnitOverheadIndicator(hero)
  playSleepingWakeVisual(hero, () => {
    hero.actionLocked = false
  })
}

export function sleepHeroAtFireCamp(hero: UnitEntity | null | undefined, building: BuildingEntity): boolean {
  if (!hero || hero.actionLocked || !canHeroSleepAtFireCamp(hero, building)) return false
  const context = hero.context

  hero.actionLocked = true
  setUnitOverheadIndicator(hero, 'sleep')
  playSleepingOutsideVisual(hero, () => {
    const dayNightState = context?.dayNight?.state
    const hours = getHoursUntilNextMorning(dayNightState?.hour ?? 7, dayNightState?.minute ?? 0, VILLAGE_WAKE_COMPLETE_HOUR)
    const result = context?.timeSkip?.start?.(hours, {
      completedMessage: t('heroSleepComplete'),
      onCancel: () => wakeHeroFromFireCamp(hero),
      onComplete: () => {
        context.unitRest?.synchronizeAfterTimeJump?.()
        context.autosave?.()
        wakeHeroFromFireCamp(hero)
      },
    })
    if (!result?.ok) {
      context?.menu?.showMessage?.(result?.message ?? t('heroSleepUnavailable'), 'warning')
      wakeHeroFromFireCamp(hero)
    }
  })
  return true
}
