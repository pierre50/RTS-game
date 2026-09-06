import { FAMILY_TYPES, LOADING_TYPES, MINING_RESOURCE_CONFIG, UNIT_TYPES, WORK_TYPES } from '../constants'
import { showLevelUpFeedback } from '../combat/combatFeedback'
import { t } from '../lang'
import type { UnitEntity } from '../../types/entities'

// Per-skill experience buckets: every XP-earning action feeds exactly one
// category, and each category grants a bonus on the stat it exercises.
export const XP_CATEGORIES = {
  melee: 'melee',
  ranged: 'ranged',
  mining: 'mining',
  farming: 'farming',
  woodcutting: 'woodcutting',
  hunting: 'hunting',
  building: 'building',
  healing: 'healing',
  defense: 'defense',
}

export const XP_MAX_LEVEL = 20
export const XP_KILL_BONUS = 15
export const XP_CONVERT_SUCCESS = 30
export const XP_BUILD_TICK = 2
export const XP_FELL_TREE_TICK = 1
export const XP_PARRY_SUCCESS = 5

function getMiningLoadingTypes(): string[] {
  const configured = Object.values(MINING_RESOURCE_CONFIG ?? {})
    .map(config => config.loadingType)
    .filter((loadingType): loadingType is string => Boolean(loadingType))
  if (configured.length) return configured
  return [LOADING_TYPES.stone, LOADING_TYPES.gold].filter((loadingType): loadingType is string => Boolean(loadingType))
}

// Cumulative XP required to reach a level: 25·L·(L+1) → 50, 150, 300, 500…
const XP_LEVEL_FACTOR = 25
const GATHER_BONUS_LEVEL_STEP = 3 // +1 resource per swing every 3 levels
const COMBAT_BONUS_LEVEL_STEP = 2 // +1 damage per hit every 2 levels
const HEAL_BONUS_LEVEL_STEP = 2 // +1 hit point healed per chant every 2 levels
const BUILD_RATE_BONUS_PER_LEVEL = 0.05
const PARRY_CHANCE_PER_LEVEL = 0.035 // +3.5% automatic parry chance per overall level
const CRITICAL_HIT_BASE_CHANCE = 0.05
const CRITICAL_HIT_CHANCE_PER_LEVEL = 0.01
const CRITICAL_HIT_MAX_CHANCE = 0.25
export const CRITICAL_HIT_MULTIPLIER = 2

// Reflexe: the overall level shrinks the pause between two attack swings (attackRecoveryMs).
// Movement/attack orders share that same recovery lock (see combatAttackLoop.ts's actionLocked),
// so a faster reflex also makes a unit respond quicker to a new order — no separate system needed.
const REFLEX_RECOVERY_REDUCTION_PER_LEVEL = 0.025 // -2.5% attack recovery time per overall level
const MIN_REFLEX_RECOVERY_MULTIPLIER = 0.5 // never faster than half the base recovery time

// Energie: the overall level raises max stamina and how fast it regenerates.
const ENERGY_TOTAL_BONUS_PER_LEVEL = 0.04 // +4% max energy per overall level
const ENERGY_REGEN_BONUS_PER_LEVEL = 0.02 // +2% energy regen rate per overall level

// Palier d'équipement : piste indépendante du niveau de combat, réservée aux unités soldat
// (Fantassin/Archer). Alimentée par le même XP de combat (melee/ranged/defense) mais avec une
// courbe plate au lieu de la courbe accélérée du niveau — l'age du joueur plafonne la progression.
const EQUIPMENT_TIER_XP_PER_LEVEL = 200
const EQUIPMENT_TIER_CAP_BY_AGE: Record<number, number> = { 0: 5, 1: 10, 2: 15, 3: 20 }

export const WORK_XP_CATEGORY: Record<string, string> = {
  [WORK_TYPES.farmer]: XP_CATEGORIES.farming,
  [WORK_TYPES.forager]: XP_CATEGORIES.farming,
  [WORK_TYPES.woodcutter]: XP_CATEGORIES.woodcutting,
  [WORK_TYPES.stoneminer]: XP_CATEGORIES.mining,
  [WORK_TYPES.goldminer]: XP_CATEGORIES.mining,
  [WORK_TYPES.horseCapture]: XP_CATEGORIES.hunting,
  [WORK_TYPES.hunter]: XP_CATEGORIES.hunting,
  [WORK_TYPES.builder]: XP_CATEGORIES.building,
  [WORK_TYPES.attacker]: XP_CATEGORIES.melee,
  [WORK_TYPES.healer]: XP_CATEGORIES.healing,
}

export const LOADING_XP_CATEGORY: Record<string, string> = {
  [LOADING_TYPES.wheat]: XP_CATEGORIES.farming,
  [LOADING_TYPES.berry]: XP_CATEGORIES.farming,
  [LOADING_TYPES.herb]: XP_CATEGORIES.farming,
  [LOADING_TYPES.toxicHerb]: XP_CATEGORIES.farming,
  [LOADING_TYPES.fiber]: XP_CATEGORIES.farming,
  [LOADING_TYPES.wood]: XP_CATEGORIES.woodcutting,
  ...Object.fromEntries(getMiningLoadingTypes().map(loadingType => [loadingType, XP_CATEGORIES.mining])),
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

export function getLevelForXp(xp: number): number {
  const safeXp = Math.max(0, Math.floor(xp))
  let level = 0
  while (level < XP_MAX_LEVEL && safeXp >= getXpForLevel(level + 1)) level++
  return level
}

export function getUnitLevel(unit: UnitEntity, category: string): number {
  return getLevelForXp(getUnitXp(unit, category))
}

export function getUnitOverallLevel(unit: UnitEntity): number {
  const totalXp = Object.values(unit.experience ?? {}).reduce((sum, xp) => sum + Math.max(0, Math.floor(xp ?? 0)), 0)
  return getLevelForXp(totalXp)
}

function getCombinedUnitLevel(unit: UnitEntity, categories: readonly string[]): number {
  const totalXp = categories.reduce((sum, category) => sum + getUnitXp(unit, category), 0)
  return getLevelForXp(totalXp)
}

export function getUnitEquipmentLevel(unit: UnitEntity, category = unit.category || unit.type): number {
  if (category === 'Fantassin') return getCombinedUnitLevel(unit, [XP_CATEGORIES.melee, XP_CATEGORIES.defense])
  if (category === 'Archer') return getCombinedUnitLevel(unit, [XP_CATEGORIES.ranged, XP_CATEGORIES.defense])
  if (unit.type === 'Priest' || category === 'Priest') return getUnitLevel(unit, XP_CATEGORIES.healing)
  const workCategory = unit.work ? WORK_XP_CATEGORY[unit.work] : null
  if (workCategory) return getUnitLevel(unit, workCategory)
  return getUnitOverallLevel(unit)
}

function getEquipmentTierCapForAge(age: number): number {
  const ages = Object.keys(EQUIPMENT_TIER_CAP_BY_AGE)
    .map(Number)
    .sort((a, b) => a - b)
  let cap = 0
  for (const a of ages) {
    if (age >= a) cap = EQUIPMENT_TIER_CAP_BY_AGE[a]
  }
  return cap
}

// The new, independent equipment-unlock track: linear XP curve, soldier-only (everything else —
// villagers, Priest — has no level-gated equipment anyway), capped by the player's current age.
export function getUnitEquipmentTier(unit: UnitEntity, category = unit.category || unit.type): number {
  let totalXp = 0
  if (category === 'Fantassin') totalXp = getUnitXp(unit, XP_CATEGORIES.melee) + getUnitXp(unit, XP_CATEGORIES.defense)
  else if (category === 'Archer') totalXp = getUnitXp(unit, XP_CATEGORIES.ranged) + getUnitXp(unit, XP_CATEGORIES.defense)
  else return 0

  const tierFromXp = Math.min(XP_MAX_LEVEL, Math.floor(totalXp / EQUIPMENT_TIER_XP_PER_LEVEL))
  return Math.min(tierFromXp, getEquipmentTierCapForAge(unit.owner?.age ?? 0))
}

// Kept for legacy/debug summaries only. Gameplay unlocks should use getUnitEquipmentTier,
// and user-facing "unit level" should use getUnitOverallLevel.
function getDebugLevelCategories(unit: UnitEntity, category = unit.category || unit.type): string[] {
  if (category === 'Fantassin') return [XP_CATEGORIES.melee, XP_CATEGORIES.defense]
  if (category === 'Archer') return [XP_CATEGORIES.ranged, XP_CATEGORIES.defense]
  if (unit.type === 'Priest' || category === 'Priest') return [XP_CATEGORIES.healing]
  const workCategory = unit.work ? WORK_XP_CATEGORY[unit.work] : null
  return [workCategory ?? XP_CATEGORIES.melee]
}

export function setUnitDebugLevel(unit: UnitEntity, level: number, category = unit.category || unit.type): number {
  const clampedLevel = Math.max(0, Math.min(XP_MAX_LEVEL, Math.floor(level)))
  unit.experience = unit.experience ?? {}
  const categories = getDebugLevelCategories(unit, category)
  const totalXp = getXpForLevel(clampedLevel)
  const baseXp = Math.floor(totalXp / categories.length)
  const remainder = totalXp - baseXp * categories.length
  for (let i = 0; i < categories.length; i++) {
    unit.experience[categories[i]] = baseXp + (i < remainder ? 1 : 0)
  }
  return clampedLevel
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

export function getUnitExperienceEntries(
  unit: UnitEntity,
  options?: { includeZero?: boolean }
): (XpProgress & { category: string })[] {
  const experience = unit.experience
  if (options?.includeZero) {
    return Object.values(XP_CATEGORIES).map(category => ({ category, ...getXpProgress(unit, category) }))
  }
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

export function getParryChanceBonus(unit: UnitEntity): number {
  return getUnitOverallLevel(unit) * PARRY_CHANCE_PER_LEVEL
}

export function getCriticalHitChance(unit: UnitEntity, category: string): number {
  const level = getUnitLevel(unit, category)
  return Math.min(CRITICAL_HIT_MAX_CHANCE, CRITICAL_HIT_BASE_CHANCE + level * CRITICAL_HIT_CHANCE_PER_LEVEL)
}

export function getReflexAttackRecoveryMultiplier(unit: UnitEntity): number {
  const level = getUnitOverallLevel(unit)
  return Math.max(MIN_REFLEX_RECOVERY_MULTIPLIER, 1 - level * REFLEX_RECOVERY_REDUCTION_PER_LEVEL)
}

export function getEnergyTotalLevelMultiplier(unit: UnitEntity): number {
  return 1 + getUnitOverallLevel(unit) * ENERGY_TOTAL_BONUS_PER_LEVEL
}

export function getEnergyRegenLevelMultiplier(unit: UnitEntity): number {
  return 1 + getUnitOverallLevel(unit) * ENERGY_REGEN_BONUS_PER_LEVEL
}

export function getXpInfoId(category: string): string {
  return `xp-${category}-text`
}

export function formatXpProgressText(unit: UnitEntity, category: string): string {
  const progress = getXpProgress(unit, category)
  return progress.next == null ? `${progress.level} (max)` : `${progress.level} (${progress.current}/${progress.next})`
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

// Registered by equipmentStats.ts (which already imports this module) so that reflex/energy/
// equipment-tier caches refresh the moment a level is gained, without this module importing
// equipmentStats.ts back (that would be a circular import).
type LevelUpRefreshHandler = (unit: UnitEntity) => void
let levelUpRefreshHandler: LevelUpRefreshHandler | null = null

export function setLevelUpRefreshHandler(handler: LevelUpRefreshHandler | null): void {
  levelUpRefreshHandler = handler
}

export function grantUnitXp(unit: UnitEntity, category: string | null | undefined, amount: number): void {
  if (!category || !(amount > 0) || unit.isDead || unit.isDestroyed) return
  if (unit.type === UNIT_TYPES.villager) return
  if (unit.family !== FAMILY_TYPES.unit) return
  const overallLevelBefore = getUnitOverallLevel(unit)
  const levelBefore = getUnitLevel(unit, category)
  unit.experience = unit.experience ?? {}
  unit.experience[category] = getUnitXp(unit, category) + Math.round(amount)
  const levelAfter = getUnitLevel(unit, category)
  if (levelAfter > levelBefore) {
    showLevelUpFeedback(unit, `${t('levelShort')} ${levelAfter}`)
  }
  if (getUnitOverallLevel(unit) > overallLevelBefore) {
    levelUpRefreshHandler?.(unit)
  }
  syncExperienceInterface(unit, category, levelAfter > levelBefore)
}
