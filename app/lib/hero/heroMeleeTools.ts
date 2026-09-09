import { definedProperties } from '../definedProperties'
import { ACTION_TYPES, FAMILY_TYPES, SOUND_CUES } from '../constants'
import { getActionCondition, prepareAutomaticParry, type CombatEntity } from '../combat'
import { applyCombatHit } from '../combat/combatHit'
import { applyDiplomaticAggression, canTriggerDiplomaticAggression } from '../combat/diplomaticAggression'
import { getEquipmentCombatStats, getUnitWorkEquipment, UNARMED_UNIT_WEAPON_POWER } from '../equipment/equipmentStats'
import { findInstancesInSight } from '../grid/visibility'
import { SLASH_IMPACT_FRAME } from '../graphics'
import { playAudibleSoundCue } from '../audio/sound'
import { getCombatXpBonus, XP_CATEGORIES } from '../units/unitExperience'
import { spendHeroEnergy } from './heroEnergy'
import { playHeroToolAnimation } from './heroToolAnimation'
import type { CommandSound, RuntimeEntity, UnitEntity } from '../../types/entities'
import type { Point } from '../../types/grid'
import { getHeroToolEquipment, type HeroEquippedItem } from './heroToolEquipment'
import { CLICK_TARGET_SEARCH_RANGE, getHeroAimDegree } from './heroTargeting'

import { createContactStrike, isContactTouching } from '../contact/contactGeometry'
import { showContactDebug } from '../contact/contactDebug'

const HERO_WHIFF_ENERGY_ACTION = 'heroWhiff'
const HERO_SWORD_FULL_CHARGE_DAMAGE_BONUS = 0.5

type ToolActionResult = 'triggered' | 'blocked' | 'miss'

type HeroMeleeAttackOptions = {
  damageMultiplier?: number
  impactFrame?: number
  swordChargePower?: number
}

export function getHeroSwordChargeDamageMultiplier(power: number): number {
  const clampedPower = Math.max(0, Math.min(1, power))
  return 1 + clampedPower * HERO_SWORD_FULL_CHARGE_DAMAGE_BONUS
}

export function getHeroWeaponDamage(hero: UnitEntity, tool: HeroEquippedItem): number {
  const stats = getEquipmentCombatStats(getHeroToolEquipment(hero, tool))
  return stats.weaponPower || (tool === 'interact' ? UNARMED_UNIT_WEAPON_POWER : 0)
}

function getHeroWeaponCombatSource(hero: UnitEntity, tool: HeroEquippedItem): CombatEntity {
  return {
    ...hero,
    equipment: getHeroToolEquipment(hero, tool),
  }
}

function canBeHeroMeleeTarget(hero: UnitEntity, target: RuntimeEntity, tool: HeroEquippedItem): boolean {
  if (
    target === hero ||
    ![FAMILY_TYPES.building, FAMILY_TYPES.unit, FAMILY_TYPES.animal, FAMILY_TYPES.resource].includes(
      target.family ?? ''
    ) ||
    target.isDead ||
    target.isDestroyed
  ) {
    return false
  }
  const combatSource = getHeroWeaponCombatSource(hero, tool)
  return getActionCondition(combatSource, target, ACTION_TYPES.attack) || canTriggerDiplomaticAggression(hero, target)
}

function findHeroMeleeTargetInAim(
  hero: UnitEntity,
  tool: HeroEquippedItem,
  degree = hero.degree ?? 0,
  debug = false
): RuntimeEntity | null {
  const weapon = tool === 'sword' ? hero.inventory?.activeWeapons?.melee : undefined
  const candidates = findInstancesInSight<UnitEntity, RuntimeEntity>(
    hero,
    target => canBeHeroMeleeTarget(hero, target, tool),
    CLICK_TARGET_SEARCH_RANGE
  )
  if (debug) showContactDebug(hero, candidates, weapon, degree)
  const strike = createContactStrike(hero, weapon, { degree })
  let nearest: RuntimeEntity | null = null
  let minimum = Infinity
  for (const target of candidates) {
    const distance = (target.x - hero.x) ** 2 + (target.y - hero.y) ** 2
    if (distance < minimum && strike.touches(target)) {
      nearest = target
      minimum = distance
    }
  }
  return nearest
}

export function playEmptyHandWhiff(hero: UnitEntity): boolean {
  if (hero.actionLocked || !spendHeroEnergy(hero, HERO_WHIFF_ENERGY_ACTION)) return false
  const degree = hero.degree ?? 0
  playHeroToolAnimation(hero, () => resolveHeroMeleeImpact(hero, 'interact', {}, degree), SLASH_IMPACT_FRAME, {
    recoveryAnimation: 'reverseSlash',
  })
  return true
}

function playMeleeWeaponWhiff(hero: UnitEntity, options: HeroMeleeAttackOptions = {}): boolean {
  if (hero.actionLocked || !spendHeroEnergy(hero, HERO_WHIFF_ENERGY_ACTION)) return false
  const degree = hero.degree ?? 0
  playHeroToolAnimation(
    hero,
    () => resolveHeroMeleeImpact(hero, 'sword', options, degree),
    options.impactFrame ?? SLASH_IMPACT_FRAME,
    {
      recoveryAnimation: 'reverseSlash',
      swordChargePower: options.swordChargePower,
    }
  )
  return true
}

function getHeroMeleeDefaultDamage(hero: UnitEntity, tool: HeroEquippedItem, options: HeroMeleeAttackOptions): number {
  const damage = getHeroWeaponDamage(hero, tool)
  if (options.damageMultiplier == null) return damage
  return Math.max(0, Math.round(damage * options.damageMultiplier))
}

function hasAxeEquipment(equipment: readonly string[]): boolean {
  return equipment.some(item => item === 'axe' || item.startsWith('axe_'))
}

function getHeroMeleeImpactSound(hero: UnitEntity, target: RuntimeEntity, tool: HeroEquippedItem): CommandSound {
  if (tool === 'sword') return SOUND_CUES.unit.swordAttack
  if (target.family === FAMILY_TYPES.unit && hasAxeEquipment(getUnitWorkEquipment(hero.work, hero.owner?.age))) {
    return SOUND_CUES.unit.swordAttack
  }
  return hero.sounds?.hit
}

function resolveHeroMeleeImpact(
  hero: UnitEntity,
  tool: HeroEquippedItem,
  options: HeroMeleeAttackOptions,
  degree: number
): void {
  if (hero.isDead || hero.isDestroyed) return
  // Re-query at release: an escaped target misses; a newcomer can receive the blow.
  const target = findHeroMeleeTargetInAim(hero, tool, degree, true)
  if (!target) {
    playAudibleSoundCue(hero, SOUND_CUES.hero.meleeWhiff, { profile: 'combat' })
    return
  }
  const aggression = applyDiplomaticAggression(hero, target)
  if (aggression.changed && !aggression.hostileNow) return
  const combatSource = getHeroWeaponCombatSource(hero, tool)
  if (!getActionCondition(combatSource, target, ACTION_TYPES.attack)) return
  const { damageDealt } = applyCombatHit(
    combatSource,
    target,
    definedProperties({
      attacker: hero,
      bonusDamage: getCombatXpBonus(hero, XP_CATEGORIES.melee),
      defaultDamage: getHeroMeleeDefaultDamage(hero, tool, options),
      isMelee: true,
      menu: hero.context?.menu,
      player: hero.context?.player,
      xpCategory: XP_CATEGORIES.melee,
      xpUnit: hero,
    })
  )
  if (damageDealt > 0) {
    playAudibleSoundCue(hero, getHeroMeleeImpactSound(hero, target, tool), { profile: 'combat' })
  }
}

function strikeHeroMeleeTarget(
  hero: UnitEntity,
  target: RuntimeEntity,
  tool: HeroEquippedItem,
  options: HeroMeleeAttackOptions = {}
): ToolActionResult {
  if (hero.actionLocked) return 'blocked'
  const weapon = tool === 'sword' ? hero.inventory?.activeWeapons?.melee : undefined
  const resolvedTarget = isContactTouching(hero, target, weapon) ? target : findHeroMeleeTargetInAim(hero, tool)
  if (!resolvedTarget) {
    return 'miss'
  }
  const openingAggression = applyDiplomaticAggression(hero, resolvedTarget)
  if (openingAggression.changed && !openingAggression.hostileNow) return 'triggered'
  if (!spendHeroEnergy(hero, ACTION_TYPES.attack)) return 'blocked'
  hero.action = ACTION_TYPES.attack
  hero.setDest?.(resolvedTarget)
  prepareAutomaticParry?.(resolvedTarget)
  const degree = hero.degree ?? 0
  playHeroToolAnimation(
    hero,
    () => resolveHeroMeleeImpact(hero, tool, options, degree),
    options.impactFrame ?? SLASH_IMPACT_FRAME,
    { recoveryAnimation: 'reverseSlash', swordChargePower: options.swordChargePower }
  )
  return 'triggered'
}

export function triggerSwordAttackAt(
  hero: UnitEntity,
  destination?: Point | null,
  options: HeroMeleeAttackOptions = {}
): boolean {
  if (hero.actionLocked) return false
  if (destination) hero.degree = getHeroAimDegree(hero, destination)
  const meleeTarget = findHeroMeleeTargetInAim(hero, 'sword')
  if (meleeTarget) {
    const meleeResult = strikeHeroMeleeTarget(hero, meleeTarget, 'sword', options)
    if (meleeResult === 'triggered') return true
    if (meleeResult === 'blocked') return false
  }
  return playMeleeWeaponWhiff(hero, options)
}

export function triggerInteractMeleeAt(hero: UnitEntity): ToolActionResult {
  const meleeTarget = findHeroMeleeTargetInAim(hero, 'interact')
  return meleeTarget ? strikeHeroMeleeTarget(hero, meleeTarget, 'interact') : 'miss'
}
