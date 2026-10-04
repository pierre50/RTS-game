import { isValidCondition } from '../../lib'
import type { PlayerLike } from '../../types/player'
import type { Condition } from '../../lib/combat'

export function isBuildingEligible(player: PlayerLike, type: string): boolean {
  const config = player.config.buildings[type]
  if (!config) return false

  return (config.conditions || []).every((condition: Condition) => isValidCondition(condition, player))
}
