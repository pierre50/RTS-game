import { getHitPointsWithDamage, type CombatDamageType, type CombatEntity } from './combat'
import { showDamageFeedback, showParryFeedback } from './combatFeedback'
import { syncEntityHealthDisplay } from '../entities/entityHealthDisplay'
import { t } from '../lang'
import { attemptAutomaticParry } from './parry'
import { grantUnitXp, XP_KILL_BONUS } from '../units/unitExperience'
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
  killed: boolean
}

function updateHitPointsDisplay(target: RuntimeEntity, player?: PlayerLike | null, menu?: MenuLike | null): void {
  syncEntityHealthDisplay(target, { player, menu })
}

function applyFactionAttackPenalty(attacker: RuntimeEntity, target: RuntimeEntity, killed: boolean, damageDealt: number): void {
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
  target.hitPoints = parried || target.devInvincible
    ? beforeHitPoints
    : getHitPointsWithDamage(source, target, defaultDamage, bonusDamage, damageType)
  const damageDealt = beforeHitPoints - (target.hitPoints ?? 0)
  const killed = (target.hitPoints ?? 0) <= 0
  applyFactionAttackPenalty(attacker, target, killed, damageDealt)

  if (parried) {
    showParryFeedback(target, t('heroDefenseMissed'))
  } else {
    showDamageFeedback(target, damageDealt)
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

  return { damageDealt, killed }
}
