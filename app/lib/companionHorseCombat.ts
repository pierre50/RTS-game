import { FAMILY_TYPES } from '../constants'
import { t } from './lang'
import type { MenuLike } from '../types/context'
import type { RuntimeEntity, UnitEntity } from '../types/entities'
import type { Point } from '../types/grid'

const COMPANION_HORSE_HIT_LIMIT = 3

type CompanionHorseRuntime = RuntimeEntity & {
  companionOwner?: UnitEntity | null
  companionHitCount?: number
  strategy?: string
  ambientMovement?: boolean
  animalBehavior?: {
    start?: () => void
  }
}

function clearCompanionHorseLink(horse: CompanionHorseRuntime, menu?: MenuLike | null): void {
  const owner = horse.companionOwner
  if (owner) owner.companionHorseColor = null
  horse.companionOwner = null
  horse.companionHitCount = 0
  ;(menu ?? owner?.context?.menu)?.showMessage(t('heroHorseLinkBroken'), 'warning')
}

function restoreWildHorseBehavior(horse: CompanionHorseRuntime): void {
  horse.strategy = 'runaway'
  horse.ambientMovement = true
  horse.animalBehavior?.start?.()
}

export function handleCompanionHorseDamage({
  attacker,
  target,
  damageDealt,
  killed,
  hitDirection,
  menu,
}: {
  attacker: RuntimeEntity
  target: RuntimeEntity
  damageDealt: number
  killed: boolean
  hitDirection?: Point
  menu?: MenuLike | null
}): boolean {
  if (damageDealt <= 0 || target.family !== FAMILY_TYPES.animal || target.type !== 'Horse') return false
  const horse = target as CompanionHorseRuntime
  if (!horse.companionOwner || horse.companionOwner !== attacker) return false
  if (killed) {
    clearCompanionHorseLink(horse, menu)
    return false
  }
  horse.companionHitCount = (horse.companionHitCount ?? 0) + 1
  if (horse.companionHitCount < COMPANION_HORSE_HIT_LIMIT) return true
  clearCompanionHorseLink(horse, menu)
  restoreWildHorseBehavior(horse)
  horse.isAttacked?.(attacker, hitDirection)
  return true
}
