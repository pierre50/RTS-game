import { FAMILY_TYPES } from '../constants'
import { getGameDifficultyCombatBalance } from '../../config/gameDifficultyBalance'
import { getEntityWeaponPower, UNARMED_UNIT_WEAPON_POWER } from '../equipment/equipmentStats'
import { isFriendlyTarget } from './combatRelations'
import { angleDelta, getPointsDegree } from '../maths'
import type { CombatDamageType, CombatEntity, CombatOwnerLike } from '../../types/combat'

export { evaluateCombatMorale } from './combatMorale'
export { getActionCondition, isValidCondition, isWheatMature } from './combatActionConditions'
export { isFriendlyTarget } from './combatRelations'
export type { ActionProps, CombatDamageType, CombatEntity } from '../../types/combat'
export type { Condition } from '../../types/config'

function getArmorForDamageType(target: CombatEntity, damageType: CombatDamageType): number {
  return damageType === 'pierce' ? (target.pierceArmor ?? 0) : (target.meleeArmor ?? 0)
}

function getDamage(
  source: CombatEntity,
  target: CombatEntity,
  damageType: CombatDamageType,
  baseDamage = getEntityWeaponPower(source as Parameters<typeof getEntityWeaponPower>[0])
): number {
  const weaponPower = baseDamage
  const armor = Math.max(0, getArmorForDamageType(target, damageType))
  const minimumDamage = weaponPower <= UNARMED_UNIT_WEAPON_POWER ? UNARMED_UNIT_WEAPON_POWER : 1
  return Math.max(minimumDamage, weaponPower - armor)
}

function getCombatDifficulty(source: CombatEntity, target: CombatEntity): string | undefined {
  return source.context?.map?.difficulty ?? target.context?.map?.difficulty
}

function isHostileToPlayedOwner(entity: CombatEntity, playedOwner: CombatOwnerLike): boolean {
  const owner = entity.owner
  if (!owner || owner.label === playedOwner.label) return false
  return Boolean(owner.isEnemy?.(playedOwner as never) || playedOwner.isEnemy?.(owner as never))
}

function isCombatDifficultyThreat(entity: CombatEntity, playedOwner: CombatOwnerLike): boolean {
  if (entity.family === FAMILY_TYPES.animal) return getEntityWeaponPower(entity as Parameters<typeof getEntityWeaponPower>[0]) > 0
  return isHostileToPlayedOwner(entity, playedOwner)
}

function getCombatDifficultyDamageMultiplier(source: CombatEntity, target: CombatEntity): number {
  const balance = getGameDifficultyCombatBalance(getCombatDifficulty(source, target))

  if (source.owner?.isPlayed && isCombatDifficultyThreat(target, source.owner)) {
    return balance.playerDamageDealtMultiplier
  }
  if (target.owner?.isPlayed && isCombatDifficultyThreat(source, target.owner)) {
    return balance.playerDamageReceivedMultiplier
  }
  return 1
}

// Hero defense only blocks what it's actually facing — a hit landing outside this frontal
// arc (e.g. from behind) goes through untouched even while heroDefenseActive is true.
const HERO_DEFENSE_FRONTAL_HALF_ANGLE = 90

function isOutsideHeroDefenseArc(source: CombatEntity, target: CombatEntity): boolean {
  const { x: sx, y: sy } = source
  const { x: tx, y: ty, degree } = target
  if (sx == null || sy == null || tx == null || ty == null) return false
  const attackAngle = getPointsDegree(tx, ty, sx, sy)
  return angleDelta(attackAngle, degree ?? 0) > HERO_DEFENSE_FRONTAL_HALF_ANGLE
}

function applyHeroDefenseDamage(source: CombatEntity, target: CombatEntity, damage: number): number {
  if (!target.heroDefenseActive || damage <= 0 || isOutsideHeroDefenseArc(source, target)) return damage
  target.showHeroDefenseFlash?.()
  return 0
}

export function getHitPointsWithDamage(
  source: CombatEntity,
  target: CombatEntity,
  defaultDamage?: number,
  bonusDamage = 0,
  damageType: CombatDamageType = 'melee'
): number {
  if (isFriendlyTarget(source, target)) return target.hitPoints ?? 0
  const rawDamage = getDamage(source, target, damageType, defaultDamage) + Math.max(0, bonusDamage)
  const difficultyDamage = rawDamage * getCombatDifficultyDamageMultiplier(source, target)
  const damage = applyHeroDefenseDamage(source, target, difficultyDamage)
  return Math.max(0, (target.hitPoints ?? 0) - damage)
}
