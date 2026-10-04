import { isAiChiefResting } from '../units/chiefAvailability'
import { ACTION_TYPES, FAMILY_TYPES, PLAYER_TYPES } from '../constants'
import { isNeutralPlayer } from '../playerState'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'

// A unit mid-fight is the only thing that can't be interrupted — everything else (idle, walking,
// gathering, building) is fair game.
export function isFighting(target: UnitEntity): boolean {
  return target.action === ACTION_TYPES.attack
}

function isFriendlyAvailable(hero: UnitEntity, target: UnitEntity): boolean {
  if (
    target === hero ||
    target.isDead ||
    target.isDestroyed ||
    isAiChiefResting(target, target.context ?? hero.context)
  )
    return false
  if (target.family !== FAMILY_TYPES.unit) return false
  if (target.owner !== hero.owner && !isNeutralPlayer(target.owner)) return false
  return !isFighting(target)
}

export function isCommEligible(hero: UnitEntity, target: UnitEntity): boolean {
  if (
    target.isDead ||
    target.isDestroyed ||
    isFighting(target) ||
    isAiChiefResting(target, target.context ?? hero.context)
  )
    return false
  if (target.lookingAtHero) return true
  return isFriendlyAvailable(hero, target)
}

function isForeignTalkableNpc(hero: UnitEntity, target: UnitEntity): boolean {
  const heroOwner = hero.owner
  const targetOwner = target.owner
  if (!heroOwner || !targetOwner || targetOwner === heroOwner) return false
  if (targetOwner.type !== PLAYER_TYPES.ai) return false
  if (heroOwner.isEnemy?.(targetOwner)) return false
  if (targetOwner.isEnemy?.(heroOwner)) return false
  return true
}

// Friendly and non-hostile living characters can talk while working, but never during combat.
export function isTalkableNpc(hero: UnitEntity, target: RuntimeEntity): boolean {
  if (target === hero || target.family !== FAMILY_TYPES.unit) return false
  const unit = target as UnitEntity
  if (unit.isDead || unit.isDestroyed || isFighting(unit) || isAiChiefResting(unit, unit.context ?? hero.context))
    return false
  return unit.owner === hero.owner || isNeutralPlayer(unit.owner) || isForeignTalkableNpc(hero, unit)
}
