import { MENU_INFO_IDS } from '../constants'
import { getHitPointsWithDamage, type CombatEntity } from './combat'
import { showDamageFeedback } from './combatFeedback'
import { grantUnitXp, XP_KILL_BONUS } from './unitExperience'
import type { MenuLike } from '../types/context'
import type { RuntimeEntity, UnitEntity } from '../types/entities'
import type { Point } from '../types/grid'
import type { PlayerLike } from '../types/player'

export type CombatHitNotifyMode = 'always' | 'survived' | false

export type CombatHitOptions = {
  attacker?: RuntimeEntity
  bonusDamage?: number
  defaultDamage?: number
  grantKillXp?: boolean
  hitDirection?: Point
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
  if (!(target.selected || target.shouldKeepHealthBarVisible?.())) return
  target.drawHealthBar?.()
  if (player?.selectedUnit === target || player?.selectedBuilding === target || player?.selectedOther === target) {
    menu?.updateInfo?.(MENU_INFO_IDS.hitPoints, target.hitPoints + '/' + target.totalHitPoints)
  }
}

export function applyCombatHit(
  source: CombatEntity,
  target: RuntimeEntity,
  {
    attacker = source as RuntimeEntity,
    bonusDamage = 0,
    defaultDamage,
    grantKillXp = true,
    hitDirection,
    menu,
    notifyTarget = 'always',
    player,
    xpCategory,
    xpUnit,
  }: CombatHitOptions = {}
): CombatHitResult {
  const beforeHitPoints = target.hitPoints ?? 0
  target.hitPoints = getHitPointsWithDamage(source, target, defaultDamage, bonusDamage)
  const damageDealt = beforeHitPoints - (target.hitPoints ?? 0)
  const killed = (target.hitPoints ?? 0) <= 0

  showDamageFeedback(target, damageDealt)
  if (xpUnit && xpCategory) grantUnitXp(xpUnit, xpCategory, damageDealt)
  updateHitPointsDisplay(target, player, menu)
  if (notifyTarget === 'always' || (notifyTarget === 'survived' && !killed)) {
    target.isAttacked?.(attacker, hitDirection)
  }
  if (killed) {
    if (grantKillXp && xpUnit && xpCategory) grantUnitXp(xpUnit, xpCategory, XP_KILL_BONUS)
    target.die?.()
  }

  return { damageDealt, killed }
}
