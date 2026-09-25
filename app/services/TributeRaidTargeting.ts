import { PLAYER_TYPES } from '../constants'
import type { GameContextLike } from '../types/context'
import type { TributeRaidKind, TributeRaidUnit } from './tribute/TributeRaidRules'

export function hasActiveBanditCampPresence(context: GameContextLike): boolean {
  return context.players.some(player => {
    if (player.type !== PLAYER_TYPES.bandits && !(player as { banditCampOwner?: boolean }).banditCampOwner) return false
    return (
      player.units?.some(unit => !unit.isDead && !unit.isDestroyed && (unit.hitPoints ?? 1) > 0) ||
      player.buildings?.some(building => !building.isDead && !building.isDestroyed && (building.hitPoints ?? 1) > 0)
    )
  })
}

export function findRaidTarget(context: GameContextLike, _kind: TributeRaidKind): TributeRaidUnit | null {
  const hero = context.controls?.heroUnit
  return hero && !hero.isDead && !hero.isDestroyed ? (hero as TributeRaidUnit) : null
}
