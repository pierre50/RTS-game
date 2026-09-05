import { getHitPointsWithDamage, type CombatDamageType, type CombatEntity } from './combat'
import { showCriticalDamageFeedback, showDamageFeedback, showParryFeedback } from './combatFeedback'
import { syncEntityHealthDisplay } from '../entities/entityHealthDisplay'
import { spawnCombatBuildingImpactFragments } from '../entities/combatBuildingImpactFragments'
import { spawnCombatBloodImpact } from '../entities/combatBloodImpact'
import { getBuildingInteriorAssaultMinimumHitPoints } from '../buildings/interiorAccess'
import { t } from '../lang'
import { attemptAutomaticParry } from './parry'
import {
  CRITICAL_HIT_MULTIPLIER,
  getCriticalHitChance,
  grantUnitXp,
  XP_KILL_BONUS,
} from '../units/unitExperience'
import { FAMILY_TYPES, UNIT_TYPES } from '../constants'
import { handleCompanionHorseDamage } from './companionHorseCombat'
import type { MenuLike } from '../../types/context'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'
import type { Point } from '../../types/grid'
import type { PlayerLike } from '../../types/player'

type CombatHitNotifyMode = 'always' | 'survived' | false

export type CombatHitOptions = {
  attacker?: RuntimeEntity
  bonusDamage?: number
  damageType?: CombatDamageType
  defaultDamage?: number
  grantKillXp?: boolean
  hitDirection?: Point
  isMelee?: boolean
  menu?: MenuLike | null
  notifyTarget?: CombatHitNotifyMode
  player?: PlayerLike | null
  xpCategory?: string | null
  xpUnit?: UnitEntity | null
}

export type CombatHitResult = {
  damageDealt: number
  critical: boolean
  killed: boolean
}

type ResolvedHitDamage = {
  critical: boolean
  hitPoints: number
}

function canRollCriticalHit(attacker: RuntimeEntity, xpCategory?: string | null): attacker is UnitEntity {
  return Boolean(
    xpCategory &&
      attacker.family === FAMILY_TYPES.unit &&
      !attacker.isDead &&
      !attacker.isDestroyed &&
      attacker.type !== UNIT_TYPES.villager
  )
}

function rollCriticalHit(attacker: RuntimeEntity, xpCategory?: string | null): boolean {
  if (!xpCategory || !canRollCriticalHit(attacker, xpCategory)) return false
  return Math.random() < getCriticalHitChance(attacker, xpCategory)
}

function getInteriorAssaultHitPointFloor(source: CombatEntity, target: RuntimeEntity): number | null {
  return getBuildingInteriorAssaultMinimumHitPoints(source as UnitEntity, target)
}

function resolveHitDamage(
  source: CombatEntity,
  target: RuntimeEntity,
  attacker: RuntimeEntity,
  {
    bonusDamage,
    damageType,
    defaultDamage,
    xpCategory,
  }: Pick<CombatHitOptions, 'bonusDamage' | 'damageType' | 'defaultDamage' | 'xpCategory'>
): ResolvedHitDamage {
  const beforeHitPoints = target.hitPoints ?? 0
  const normalHitPoints = getHitPointsWithDamage(source, target, defaultDamage, bonusDamage, damageType)
  const normalDamageDealt = beforeHitPoints - normalHitPoints
  const criticalRoll = normalDamageDealt > 0 && rollCriticalHit(attacker, xpCategory)
  let hitPoints = criticalRoll ? Math.max(0, beforeHitPoints - normalDamageDealt * CRITICAL_HIT_MULTIPLIER) : normalHitPoints
  const assaultMinimumHitPoints = getInteriorAssaultHitPointFloor(source, target)
  if (assaultMinimumHitPoints != null) {
    hitPoints = Math.max(hitPoints, assaultMinimumHitPoints)
  }
  return {
    critical: criticalRoll && beforeHitPoints - hitPoints > 0,
    hitPoints,
  }
}

function updateHitPointsDisplay(target: RuntimeEntity, player?: PlayerLike | null, menu?: MenuLike | null): void {
  syncEntityHealthDisplay(target, { player, menu })
}

function applyFactionAttackPenalty(
  attacker: RuntimeEntity,
  target: RuntimeEntity,
  killed: boolean,
  damageDealt: number
): void {
  if (damageDealt <= 0 || !attacker.owner?.isPlayed) return
  const factionId = target.owner?.factionId
  if (!factionId) return
  const faction = attacker.context?.getCampaignFactions?.()?.[factionId]
  if (!faction || faction.relationState === 'hostile') return
  attacker.context?.changeFactionRelation?.(factionId, killed ? -25 : -8, 'attack')
}

export function applyCombatHit(
  source: CombatEntity,
  target: RuntimeEntity,
  {
    attacker = source as RuntimeEntity,
    bonusDamage = 0,
    damageType = 'melee',
    defaultDamage,
    grantKillXp = true,
    hitDirection,
    isMelee = false,
    menu,
    notifyTarget = 'always',
    player,
    xpCategory,
    xpUnit,
  }: CombatHitOptions = {}
): CombatHitResult {
  const beforeHitPoints = target.hitPoints ?? 0
  const parried = isMelee && attemptAutomaticParry(target)
  let critical = false
  if (parried || target.devInvincible || target.indestructible) {
    target.hitPoints = beforeHitPoints
  } else {
    const resolvedDamage = resolveHitDamage(source, target, attacker, {
      bonusDamage,
      damageType,
      defaultDamage,
      xpCategory,
    })
    target.hitPoints = resolvedDamage.hitPoints
    critical = resolvedDamage.critical
  }
  const damageDealt = beforeHitPoints - (target.hitPoints ?? 0)
  const killed = (target.hitPoints ?? 0) <= 0
  applyFactionAttackPenalty(attacker, target, killed, damageDealt)
  if (damageDealt > 0) {
    spawnCombatBloodImpact(attacker, target, { damage: damageDealt, hitDirection })
    spawnCombatBuildingImpactFragments(target, damageDealt)
  }

  if (parried) {
    showParryFeedback(target, t('heroDefenseMissed'))
  } else {
    if (critical) showCriticalDamageFeedback(target, damageDealt)
    else showDamageFeedback(target, damageDealt)
    if (xpUnit && xpCategory) grantUnitXp(xpUnit, xpCategory, damageDealt)
  }
  updateHitPointsDisplay(target, player, menu)
  const companionHorseHandled = handleCompanionHorseDamage({
    attacker,
    target,
    damageDealt,
    killed,
    hitDirection,
    menu,
  })
  if (notifyTarget === 'always' || (notifyTarget === 'survived' && !killed)) {
    if (!companionHorseHandled) target.isAttacked?.(attacker, hitDirection)
  }
  if (killed) {
    if (grantKillXp && xpUnit && xpCategory) grantUnitXp(xpUnit, xpCategory, XP_KILL_BONUS)
    target.die?.()
  }

  return { damageDealt, critical, killed }
}
