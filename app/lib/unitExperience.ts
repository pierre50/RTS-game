import { FAMILY_TYPES, LOADING_TYPES, WORK_TYPES } from '../constants'
import { showLevelUpFeedback } from './combatFeedback'
import { t } from './lang'
import type { UnitEntity } from '../types/entities'

// Per-skill experience buckets: every XP-earning action feeds exactly one
// category, and each category grants a bonus on the stat it exercises.
export const XP_CATEGORIES = {
  melee: 'melee',
  ranged: 'ranged',
  mining: 'mining',
  farming: 'farming',
  woodcutting: 'woodcutting',
  fishing: 'fishing',
  hunting: 'hunting',
  building: 'building',
  healing: 'healing',
}

export const XP_MAX_LEVEL = 10
export const XP_KILL_BONUS = 15
export const XP_CONVERT_SUCCESS = 30
export const XP_BUILD_TICK = 2
export const XP_FELL_TREE_TICK = 1

// Cumulative XP required to reach a level: 25·L·(L+1) → 50, 150, 300, 500…
const XP_LEVEL_FACTOR = 25
const GATHER_BONUS_LEVEL_STEP = 3 // +1 resource per swing every 3 levels
const COMBAT_BONUS_LEVEL_STEP = 2 // +1 damage per hit every 2 levels
const HEAL_BONUS_LEVEL_STEP = 2 // +1 hit point healed per chant every 2 levels
const BUILD_RATE_BONUS_PER_LEVEL = 0.05

export const WORK_XP_CATEGORY: Record<string, string> = {
  [WORK_TYPES.farmer]: XP_CATEGORIES.farming,
  [WORK_TYPES.forager]: XP_CATEGORIES.farming,
  [WORK_TYPES.woodcutter]: XP_CATEGORIES.woodcutting,
  [WORK_TYPES.stoneminer]: XP_CATEGORIES.mining,
  [WORK_TYPES.goldminer]: XP_CATEGORIES.mining,
  [WORK_TYPES.fisher]: XP_CATEGORIES.fishing,
  [WORK_TYPES.hunter]: XP_CATEGORIES.hunting,
  [WORK_TYPES.builder]: XP_CATEGORIES.building,
  [WORK_TYPES.attacker]: XP_CATEGORIES.melee,
  [WORK_TYPES.healer]: XP_CATEGORIES.healing,
}

export const LOADING_XP_CATEGORY: Record<string, string> = {
  [LOADING_TYPES.wheat]: XP_CATEGORIES.farming,
  [LOADING_TYPES.berry]: XP_CATEGORIES.farming,
  [LOADING_TYPES.wood]: XP_CATEGORIES.woodcutting,
  [LOADING_TYPES.stone]: XP_CATEGORIES.mining,
  [LOADING_TYPES.gold]: XP_CATEGORIES.mining,
  [LOADING_TYPES.fish]: XP_CATEGORIES.fishing,
  [LOADING_TYPES.meat]: XP_CATEGORIES.hunting,
}

export type XpProgress = {
  level: number
  current: number
  next: number | null
}

export function getXpForLevel(level: number): number {
  const clamped = Math.max(0, Math.min(level, XP_MAX_LEVEL))
  return XP_LEVEL_FACTOR * clamped * (clamped + 1)
}

export function getUnitXp(unit: UnitEntity, category: string): number {
  return Math.max(0, Math.floor(unit.experience?.[category] ?? 0))
}

export function getUnitLevel(unit: UnitEntity, category: string): number {
  const xp = getUnitXp(unit, category)
  let level = 0
  while (level < XP_MAX_LEVEL && xp >= getXpForLevel(level + 1)) level++
  return level
}

export function getXpProgress(unit: UnitEntity, category: string): XpProgress {
  const xp = getUnitXp(unit, category)
  const level = getUnitLevel(unit, category)
  return {
    level,
    current: xp - getXpForLevel(level),
    next: level >= XP_MAX_LEVEL ? null : getXpForLevel(level + 1) - getXpForLevel(level),
  }
}

export function getUnitExperienceEntries(unit: UnitEntity): (XpProgress & { category: string })[] {
  const experience = unit.experience
  if (!experience) return []
  return Object.keys(experience)
    .filter(category => (experience[category] ?? 0) > 0)
    .sort((a, b) => (experience[b] ?? 0) - (experience[a] ?? 0))
    .map(category => ({ category, ...getXpProgress(unit, category) }))
}

// Bonus applied on top of gatherAmount for the category matching the unit's
// current work (a level-6 stoneminer also mines gold faster: same category).
export function getGatherXpBonus(unit: UnitEntity): number {
  const category = unit.work ? WORK_XP_CATEGORY[unit.work] : null
  if (!category) return 0
  return Math.floor(getUnitLevel(unit, category) / GATHER_BONUS_LEVEL_STEP)
}

export function getCombatXpBonus(unit: UnitEntity, category: string): number {
  return Math.floor(getUnitLevel(unit, category) / COMBAT_BONUS_LEVEL_STEP)
}

export function getHealingXpBonus(unit: UnitEntity): number {
  return Math.floor(getUnitLevel(unit, XP_CATEGORIES.healing) / HEAL_BONUS_LEVEL_STEP)
}

export function getBuildRateXpMultiplier(unit: UnitEntity): number {
  return 1 + getUnitLevel(unit, XP_CATEGORIES.building) * BUILD_RATE_BONUS_PER_LEVEL
}

export function getXpInfoId(category: string): string {
  return `xp-${category}-text`
}

export function formatXpProgressText(unit: UnitEntity, category: string): string {
  const progress = getXpProgress(unit, category)
  return progress.next == null
    ? `${progress.level} (max)`
    : `${progress.level} (${progress.current}/${progress.next})`
}

function syncExperienceInterface(unit: UnitEntity, category: string, leveledUp: boolean): void {
  const owner = unit.owner
  const menu = unit.context?.menu
  if (!owner?.isPlayed || !menu || owner.selectedUnit !== unit || !unit.selected) return
  if (leveledUp) {
    // A level can add a new row (first level in a category) — rebuild the panel.
    menu.setActionTarget(unit)
    return
  }
  menu.updateInfo(getXpInfoId(category), formatXpProgressText(unit, category))
}

export function grantUnitXp(unit: UnitEntity, category: string | null | undefined, amount: number): void {
  if (!category || !(amount > 0) || unit.isDead || unit.isDestroyed) return
  if (unit.family !== FAMILY_TYPES.unit) return
  const levelBefore = getUnitLevel(unit, category)
  unit.experience = unit.experience ?? {}
  unit.experience[category] = getUnitXp(unit, category) + Math.round(amount)
  const levelAfter = getUnitLevel(unit, category)
  if (levelAfter > levelBefore) {
    showLevelUpFeedback(unit, `★ ${t('levelShort')} ${levelAfter}`)
  }
  syncExperienceInterface(unit, category, levelAfter > levelBefore)
}
