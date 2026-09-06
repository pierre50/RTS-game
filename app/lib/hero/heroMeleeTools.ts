import { ACTION_TYPES, FAMILY_TYPES, SOUND_CUES } from '../constants'
import { getHeroInteractionTargetPoint, isHeroActionInRange } from './heroActionRange'
import { getActionCondition, prepareAutomaticParry, type CombatEntity } from '../combat'
import { applyCombatHit } from '../combat/combatHit'
import { applyDiplomaticAggression, canTriggerDiplomaticAggression } from '../combat/diplomaticAggression'
import { getEquipmentCombatStats, getUnitWorkEquipment, UNARMED_UNIT_WEAPON_POWER } from '../equipment/equipmentStats'
import { findInstancesInSight } from '../grid/visibility'
import { SLASH_IMPACT_FRAME } from '../graphics'
import { instancesDistance } from '../maths'
import { playAudibleSoundCue } from '../audio/sound'
import { getCombatXpBonus, XP_CATEGORIES } from '../units/unitExperience'
import { spendHeroEnergy } from './heroEnergy'
import { playHeroToolAnimation } from './heroToolAnimation'
import type { CommandSound, RuntimeEntity, UnitEntity } from '../../types/entities'
import type { Point } from '../../types/grid'
import { getBuildingContactDistance } from '../grid/cells'
import { getHeroToolEquipment, type HeroEquippedItem } from './heroToolEquipment'
import { CLICK_TARGET_SEARCH_RANGE, getDirectionalTarget, getHeroAimDegree, getHeroAimDelta } from './heroTargeting'

const HERO_WHIFF_ENERGY_ACTION = 'heroWhiff'
const HERO_SWORD_FULL_CHARGE_DAMAGE_BONUS = 0.5
const HERO_MELEE_STRIKE_HALF_ANGLE = 45
const HERO_MELEE_DISTANCE_TOLERANCE = 0.9

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

function isHeroMeleeTargetInRange(hero: UnitEntity, target: RuntimeEntity): boolean {
  if (isHeroActionInRange(hero, ACTION_TYPES.attack, target)) return true
  const targetSize = Math.max(1, target.size ?? target.selectionFactor ?? 1)
  const range = getBuildingContactDistance(targetSize) + HERO_MELEE_DISTANCE_TOLERANCE
  return instancesDistance(hero, target) <= range
}

function isHeroMeleeTargetInAttackZone(hero: UnitEntity, target: RuntimeEntity): boolean {
  const aimPoint = getHeroInteractionTargetPoint(hero, target)
  if (getHeroAimDelta(hero, aimPoint) > HERO_MELEE_STRIKE_HALF_ANGLE) return false
  return isHeroMeleeTargetInRange(hero, target)
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

function findHeroMeleeTargetInAim(hero: UnitEntity, tool: HeroEquippedItem): RuntimeEntity | null {
  const candidates = findInstancesInSight<UnitEntity, RuntimeEntity>(
    hero,
    target => canBeHeroMeleeTarget(hero, target, tool),
    CLICK_TARGET_SEARCH_RANGE
  )
  return getDirectionalTarget(hero, candidates, HERO_MELEE_STRIKE_HALF_ANGLE)
}

export function playEmptyHandWhiff(hero: UnitEntity): boolean {
  if (!spendHeroEnergy(hero, HERO_WHIFF_ENERGY_ACTION)) return false
  playHeroToolAnimation(
    hero,
    () => playAudibleSoundCue(hero, SOUND_CUES.hero.meleeWhiff, { profile: 'combat' }),
    SLASH_IMPACT_FRAME,
    {
      recoveryAnimation: 'reverseSlash',
    }
  )
  return true
}

function playMeleeWeaponWhiff(hero: UnitEntity, options: HeroMeleeAttackOptions = {}): boolean {
  if (!spendHeroEnergy(hero, HERO_WHIFF_ENERGY_ACTION)) return false
  playHeroToolAnimation(
    hero,
    () => playAudibleSoundCue(hero, SOUND_CUES.hero.meleeWhiff, { profile: 'combat' }),
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

function strikeHeroMeleeTarget(
  hero: UnitEntity,
  target: RuntimeEntity,
  tool: HeroEquippedItem,
  options: HeroMeleeAttackOptions = {}
): ToolActionResult {
  const resolvedTarget = isHeroMeleeTargetInAttackZone(hero, target) ? target : findHeroMeleeTargetInAim(hero, tool)
  if (!resolvedTarget || !isHeroMeleeTargetInAttackZone(hero, resolvedTarget)) {
    return 'miss'
  }
  const openingAggression = applyDiplomaticAggression(hero, resolvedTarget)
  if (openingAggression.changed && !openingAggression.hostileNow) return 'triggered'
  if (!spendHeroEnergy(hero, ACTION_TYPES.attack)) return 'blocked'
  hero.action = ACTION_TYPES.attack
  hero.setDest?.(resolvedTarget)
  prepareAutomaticParry?.(resolvedTarget)
  playHeroToolAnimation(
    hero,
    () => {
      const combatSource = getHeroWeaponCombatSource(hero, tool)
      if (!getActionCondition(combatSource, resolvedTarget, ACTION_TYPES.attack)) {
        if ((resolvedTarget.hitPoints ?? 0) <= 0) resolvedTarget.die?.()
        return
      }
      const { damageDealt } = applyCombatHit(combatSource, resolvedTarget, {
        attacker: hero,
        bonusDamage: getCombatXpBonus(hero, XP_CATEGORIES.melee),
        defaultDamage: getHeroMeleeDefaultDamage(hero, tool, options),
        isMelee: true,
        menu: hero.context?.menu,
        player: hero.context?.player,
        xpCategory: XP_CATEGORIES.melee,
        xpUnit: hero,
      })
      if (damageDealt > 0) {
        playAudibleSoundCue(hero, getHeroMeleeImpactSound(hero, resolvedTarget, tool), { profile: 'combat' })
      }
    },
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
