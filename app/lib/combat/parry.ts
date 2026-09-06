import { FAMILY_TYPES } from '../constants'
import { isUnitMeleeWeaponEquipped } from '../equipment/equipmentStats'
import { chance } from '../random'
import { isHeroControlled } from '../units/unitControl'
import { getParryChanceBonus, grantUnitXp, XP_CATEGORIES, XP_PARRY_SUCCESS } from '../units/unitExperience'
import { showAutomaticParryVisual } from './parryVisual'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'

const BASE_PARRY_CHANCE = 0.08
const MAX_PARRY_CHANCE = 0.45
const AUTOMATIC_PARRY_ACTIVE_MS = 700
// A streak of successful parries gets progressively harder to keep up — the
// same unit blocking every hit in a flurry would trivialize melee combat.
const PARRY_FATIGUE_WINDOW_MS = 4000
const PARRY_FATIGUE_DECAY_PER_STACK = 0.5
const PARRY_FATIGUE_MAX_STACKS = 3

function getParryFatigueMultiplier(unit: UnitEntity, now: number): number {
  const lastAt = unit.lastParrySuccessAt
  if (lastAt == null || now - lastAt >= PARRY_FATIGUE_WINDOW_MS) return 1
  const streak = Math.min(unit.parryStreak ?? 0, PARRY_FATIGUE_MAX_STACKS)
  return PARRY_FATIGUE_DECAY_PER_STACK ** streak
}

export function getParryChance(unit: UnitEntity, now = performance.now()): number {
  if (!isUnitMeleeWeaponEquipped(unit)) return 0
  const base = BASE_PARRY_CHANCE + getParryChanceBonus(unit)
  return Math.max(0, Math.min(MAX_PARRY_CHANCE, base * getParryFatigueMultiplier(unit, now)))
}

function registerParrySuccess(unit: UnitEntity, now: number): void {
  const withinWindow = unit.lastParrySuccessAt != null && now - unit.lastParrySuccessAt < PARRY_FATIGUE_WINDOW_MS
  unit.parryStreak = Math.min((withinWindow ? (unit.parryStreak ?? 0) : 0) + 1, PARRY_FATIGUE_MAX_STACKS)
  unit.lastParrySuccessAt = now
}

function canUseAutomaticParry(target: RuntimeEntity): target is UnitEntity {
  if (target.family !== FAMILY_TYPES.unit) return false
  const unit = target as UnitEntity
  return (unit.hitPoints ?? 0) > 0 && !unit.isDead && !unit.isDestroyed && !isHeroControlled(unit)
}

// The automatic, chance-based counterpart to the player-controlled hero's manual
// hold-right-click block (see beginHeroDefense/heroDefenseActive in heroTools.ts) —
// used by every unit that isn't currently under direct hero control. The unit
// must first enter the guard window while the incoming melee swing is preparing.
export function prepareAutomaticParry(target: RuntimeEntity, now = performance.now()): boolean {
  if (!canUseAutomaticParry(target)) return false
  const unit = target as UnitEntity
  if (unit.automaticParryActiveUntil != null && unit.automaticParryActiveUntil > now) return true
  if (!chance(getParryChance(unit, now))) return false
  unit.automaticParryActiveUntil = now + AUTOMATIC_PARRY_ACTIVE_MS
  showAutomaticParryVisual(unit, AUTOMATIC_PARRY_ACTIVE_MS)
  return true
}

export function attemptAutomaticParry(target: RuntimeEntity, now = performance.now()): boolean {
  if (!canUseAutomaticParry(target)) return false
  const unit = target as UnitEntity
  if (unit.automaticParryActiveUntil == null || unit.automaticParryActiveUntil < now) {
    unit.automaticParryActiveUntil = null
    return false
  }
  registerParrySuccess(unit, now)
  grantUnitXp(unit, XP_CATEGORIES.defense, XP_PARRY_SUCCESS)
  unit.automaticParryActiveUntil = null
  return true
}
